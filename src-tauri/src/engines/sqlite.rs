use async_trait::async_trait;
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use sqlx::{Column, Row};
use tokio::sync::RwLock;

use super::row_decode;
use super::safety;
use super::traits::DatabaseEngine;
use super::types::{
    ColumnInfo, ConnectionConfig, ForeignKeyInfo, IndexInfo, QueryResult, TableInfo, TableStructure,
};
use super::{EngineError, EngineResult};

/// SQLite database engine implementation using sqlx.
///
/// Connection pools are managed internally and automatically closed on drop.
pub struct SqliteEngine {
    pool: RwLock<Option<SqlitePool>>,
}

impl SqliteEngine {
    /// Creates a new disconnected SQLite engine.
    pub fn new() -> Self {
        Self {
            pool: RwLock::new(None),
        }
    }

    /// Validates a table name before embedding it as a quoted SQL identifier.
    pub fn validate_table_name(name: &str) -> EngineResult<()> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(EngineError::QueryError(
                "Table name cannot be empty".to_string(),
            ));
        }

        // Prevent control characters and statement separators in identifiers
        if trimmed.chars().any(|c| c.is_control()) {
            return Err(EngineError::QueryError(format!(
                "Invalid table name '{}': contains control characters",
                trimmed
            )));
        }

        // Reject semicolons (statement separator) to prevent injection
        if trimmed.contains(';') {
            return Err(EngineError::QueryError(format!(
                "Invalid table name '{}': contains semicolon",
                trimmed
            )));
        }

        // Reject hyphens - they require quoting and can be ambiguous
        if trimmed.contains('-') {
            return Err(EngineError::QueryError(format!(
                "Invalid table name '{}': contains hyphen",
                trimmed
            )));
        }
        Ok(())
    }

    fn quote_identifier(identifier: &str) -> String {
        format!("\"{}\"", identifier.replace('\"', "\"\""))
    }

    fn quote_qualified_identifier(identifier: &str) -> String {
        identifier
            .split('.')
            .map(str::trim)
            .map(Self::quote_identifier)
            .collect::<Vec<_>>()
            .join(".")
    }

    /// Detects dangerous query patterns like DELETE/UPDATE with tautological WHERE clauses.
    /// Returns an error if the query appears unsafe.
    pub fn validate_query_safety(query: &str) -> EngineResult<()> {
        safety::validate_query_safety(query)
    }
}

impl Default for SqliteEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Converts a SQLite row value to JSON based on the column type info.
/// Uses sqlx's type information for more efficient type detection.
fn json_from_row(row: &sqlx::sqlite::SqliteRow, col_idx: usize) -> serde_json::Value {
    let columns = row.columns();
    let col = match columns.get(col_idx) {
        Some(c) => c,
        None => return serde_json::Value::Null,
    };
    let col_name = col.name();

    // Try types in order of likelihood for SQLite
    // SQLite is dynamically typed, so we try common types
    if let Ok(Some(val)) = row.try_get::<Option<i64>, _>(col_name) {
        serde_json::json!(val)
    } else if let Ok(Some(val)) = row.try_get::<Option<f64>, _>(col_name) {
        serde_json::json!(val)
    } else if let Ok(Some(val)) = row.try_get::<Option<String>, _>(col_name) {
        serde_json::json!(val)
    } else if let Ok(Some(val)) = row.try_get::<Option<Vec<u8>>, _>(col_name) {
        serde_json::json!(format!("<BLOB {} bytes>", val.len()))
    } else if let Ok(Some(val)) = row.try_get::<Option<bool>, _>(col_name) {
        serde_json::json!(val)
    } else {
        serde_json::Value::Null
    }
}

#[async_trait]
impl DatabaseEngine for SqliteEngine {
    async fn connect(&self, config: &ConnectionConfig) -> EngineResult<()> {
        let path = config.path.as_ref().ok_or_else(|| {
            EngineError::ConfigError("Database path is required for SQLite".to_string())
        })?;

        // Create file if it doesn't exist (rwc = read-write-create)
        let connection_string = format!("sqlite:{}?mode=rwc", path);

        // Keep a single SQLite connection to avoid schema visibility races
        // across pooled connections after ALTER TABLE operations.
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&connection_string)
            .await
            .map_err(|e| EngineError::ConnectionFailed(e.to_string()))?;

        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .map_err(|e| EngineError::ConnectionFailed(e.to_string()))?;

        let mut p = self.pool.write().await;
        *p = Some(pool);
        Ok(())
    }

    async fn disconnect(&self) {
        let mut pool = self.pool.write().await;
        if let Some(p) = pool.take() {
            p.close().await;
        }
    }

    async fn is_connected(&self) -> bool {
        self.pool.read().await.is_some()
    }

    async fn list_tables(&self) -> EngineResult<Vec<TableInfo>> {
        let pool = self.pool.read().await;
        let pool = pool.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let rows = sqlx::query(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name",
        )
        .fetch_all(pool)
        .await
        .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let tables = rows
            .iter()
            .map(|row| TableInfo {
                name: row.get("name"),
                table_type: row.get("type"),
                schema: None,
            })
            .collect();

        Ok(tables)
    }

    async fn get_table_structure(&self, table_name: &str) -> EngineResult<TableStructure> {
        Self::validate_table_name(table_name)?;

        let pool = self.pool.read().await;
        let pool = pool.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let table_name_trimmed = table_name.trim();
        let quoted_table = Self::quote_identifier(table_name_trimmed);

        // Get columns
        let column_query = format!("PRAGMA table_info({})", quoted_table);
        let column_rows = sqlx::query(&column_query)
            .fetch_all(pool)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let columns: Vec<ColumnInfo> = column_rows
            .iter()
            .map(|row| {
                Ok(ColumnInfo {
                    cid: row_decode::decode_sqlite_i64(row, "cid")?,
                    name: row.get("name"),
                    col_type: row.get("type"),
                    notnull: row.get::<i32, _>("notnull") != 0,
                    dflt_value: row.get("dflt_value"),
                    pk: row.get::<i32, _>("pk") != 0,
                })
            })
            .collect::<EngineResult<Vec<_>>>()?;

        // Get indexes
        let index_query = format!("PRAGMA index_list({})", quoted_table);
        let index_rows = sqlx::query(&index_query)
            .fetch_all(pool)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let mut indexes: Vec<IndexInfo> = Vec::new();
        for index_row in &index_rows {
            let index_name: String = index_row.get("name");
            let unique: i32 = index_row.get("unique");

            // Get columns for this index
            let index_info_query =
                format!("PRAGMA index_info({})", Self::quote_identifier(&index_name));
            let index_info_rows = sqlx::query(&index_info_query)
                .fetch_all(pool)
                .await
                .map_err(|e| EngineError::QueryError(e.to_string()))?;

            let index_columns: Vec<String> = index_info_rows
                .iter()
                .map(|row| row.get::<String, _>("name"))
                .collect();

            indexes.push(IndexInfo {
                name: index_name,
                unique: unique != 0,
                columns: index_columns,
            });
        }

        // Get foreign keys
        let fk_query = format!("PRAGMA foreign_key_list({})", quoted_table);
        let fk_rows = sqlx::query(&fk_query)
            .fetch_all(pool)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let foreign_keys: Vec<ForeignKeyInfo> = fk_rows
            .iter()
            .map(|row| ForeignKeyInfo {
                from_col: row.get("from"),
                to_table: row.get("table"),
                to_col: row.get("to"),
            })
            .collect();

        Ok(TableStructure {
            columns,
            indexes,
            foreign_keys,
        })
    }

    async fn execute_query(&self, query: &str) -> EngineResult<QueryResult> {
        Self::validate_query_safety(query)?;

        let pool = self.pool.read().await;
        let pool = pool.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let trimmed = query.trim();

        let stripped = trimmed
            .lines()
            .filter(|line| !line.trim().starts_with("--"))
            .collect::<Vec<_>>()
            .join("\n");

        let upper = stripped.trim().to_uppercase();

        // Check if this is a query that returns rows
        let is_select = upper.starts_with("SELECT")
            || upper.starts_with("PRAGMA")
            || upper.starts_with("EXPLAIN")
            || upper.starts_with("WITH")
            || upper.starts_with("TABLE");

        if is_select {
            let rows = sqlx::query(trimmed)
                .fetch_all(pool)
                .await
                .map_err(|e| EngineError::QueryError(e.to_string()))?;

            if rows.is_empty() {
                return Ok(QueryResult {
                    columns: vec![],
                    rows: vec![],
                    rows_affected: 0,
                    message: "0 rows returned".to_string(),
                });
            }

            let columns: Vec<String> = rows[0]
                .columns()
                .iter()
                .map(|c| c.name().to_string())
                .collect();

            let result_rows: Vec<Vec<serde_json::Value>> = rows
                .iter()
                .map(|row| (0..row.len()).map(|i| json_from_row(row, i)).collect())
                .collect();

            let row_count = result_rows.len();
            Ok(QueryResult {
                columns,
                rows: result_rows,
                rows_affected: row_count as u64,
                message: format!("{} row(s) returned", row_count),
            })
        } else {
            let result = sqlx::query(trimmed)
                .execute(pool)
                .await
                .map_err(|e| EngineError::QueryError(e.to_string()))?;

            let rows_affected = result.rows_affected();
            Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                rows_affected,
                message: format!("{} row(s) affected", rows_affected),
            })
        }
    }

    async fn execute_transaction(&self, queries: &[String]) -> EngineResult<QueryResult> {
        if queries.is_empty() {
            return Err(EngineError::QueryError(
                "No queries provided for transaction".to_string(),
            ));
        }

        let pool = self.pool.read().await;
        let pool = pool.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let mut tx = pool
            .begin()
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let mut rows_affected_total = 0_u64;
        let mut statements_executed = 0_u64;

        for query in queries {
            let trimmed = query.trim();
            if trimmed.is_empty() {
                continue;
            }

            Self::validate_query_safety(trimmed)?;

            let stripped = trimmed
                .lines()
                .filter(|line| !line.trim().starts_with("--"))
                .collect::<Vec<_>>()
                .join("\n");
            let normalized = stripped.trim().to_uppercase();
            let first_keyword = normalized.split_whitespace().next().unwrap_or_default();

            if !matches!(first_keyword, "INSERT" | "UPDATE" | "DELETE") {
                return Err(EngineError::QueryError(
                    "Transaction only supports INSERT/UPDATE/DELETE statements".to_string(),
                ));
            }

            let result = sqlx::query(trimmed)
                .execute(&mut *tx)
                .await
                .map_err(|e| EngineError::QueryError(e.to_string()))?;

            statements_executed += 1;
            rows_affected_total += result.rows_affected();
        }

        tx.commit()
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            rows_affected: rows_affected_total,
            message: format!(
                "Committed {} statement(s), {} row(s) affected",
                statements_executed, rows_affected_total
            ),
        })
    }

    async fn truncate_table(
        &self,
        table_name: &str,
        _restart_identity: bool,
        _cascade: bool,
    ) -> EngineResult<QueryResult> {
        Self::validate_table_name(table_name)?;

        let pool = self.pool.read().await;
        let pool = pool.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let trimmed_table = table_name.trim();
        let sql = format!(
            "DELETE FROM {}",
            Self::quote_qualified_identifier(trimmed_table)
        );

        let result = sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;
        let rows_affected = result.rows_affected();

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            rows_affected,
            message: format!("{rows_affected} row(s) affected"),
        })
    }

    async fn drop_table(&self, table_name: &str) -> EngineResult<QueryResult> {
        Self::validate_table_name(table_name)?;

        let pool = self.pool.read().await;
        let pool = pool.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let trimmed_table = table_name.trim();
        let sql = format!(
            "DROP TABLE {}",
            Self::quote_qualified_identifier(trimmed_table)
        );

        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        Ok(QueryResult {
            columns: vec![],
            rows: vec![],
            rows_affected: 0,
            message: format!("Table '{trimmed_table}' dropped"),
        })
    }

    async fn get_table_row_count(&self, table_name: &str) -> EngineResult<i64> {
        Self::validate_table_name(table_name)?;

        let pool = self.pool.read().await;
        let pool = pool.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let query = format!(
            "SELECT COUNT(*) as count FROM {}",
            Self::quote_identifier(table_name.trim())
        );

        let row = sqlx::query(&query)
            .fetch_one(pool)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let count: i64 = row.get("count");
        Ok(count)
    }

    async fn create_database(&self, path: &str) -> EngineResult<String> {
        let connection_string = format!("sqlite:{}?mode=rwc", path);

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&connection_string)
            .await
            .map_err(|e| EngineError::ConnectionFailed(e.to_string()))?;

        sqlx::query("PRAGMA journal_mode=WAL")
            .execute(&pool)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        pool.close().await;
        Ok(path.to_string())
    }

    async fn get_version(&self) -> EngineResult<String> {
        let pool = self.pool.read().await;
        let pool = pool.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let row = sqlx::query("SELECT sqlite_version() as version")
            .fetch_one(pool)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let version: String = row.get("version");
        Ok(version)
    }
}
