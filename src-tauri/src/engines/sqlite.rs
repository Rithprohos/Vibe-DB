use async_trait::async_trait;
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use sqlx::{Row, Column};
use tokio::sync::RwLock;

use super::traits::DatabaseEngine;
use super::types::{TableInfo, ColumnInfo, QueryResult, ConnectionConfig};
use super::{EngineResult, EngineError};

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

    /// Validates a table name to prevent SQL injection.
    /// Only allows alphanumeric characters and underscores.
    fn validate_table_name(name: &str) -> EngineResult<()> {
        if name.is_empty() {
            return Err(EngineError::QueryError("Table name cannot be empty".to_string()));
        }
        if !name.chars().all(|c| c.is_alphanumeric() || c == '_') {
            return Err(EngineError::QueryError(
                format!("Invalid table name '{}': only alphanumeric characters and underscores allowed", name)
            ));
        }
        Ok(())
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
        let path = config.path.as_ref()
            .ok_or_else(|| EngineError::ConfigError("Database path is required for SQLite".to_string()))?;

        let connection_string = format!("sqlite:{}?mode=rwc", path);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&connection_string)
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
        let pool = pool.as_ref()
            .ok_or_else(|| EngineError::ConnectionFailed("Not connected to database".to_string()))?;

        let rows = sqlx::query(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name"
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

    async fn get_table_structure(&self, table_name: &str) -> EngineResult<Vec<ColumnInfo>> {
        Self::validate_table_name(table_name)?;
        
        let pool = self.pool.read().await;
        let pool = pool.as_ref()
            .ok_or_else(|| EngineError::ConnectionFailed("Not connected to database".to_string()))?;

        // Safe because we validated the table name
        let query = format!("PRAGMA table_info(\"{}\")", table_name);

        let rows = sqlx::query(&query)
            .fetch_all(pool)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let columns = rows
            .iter()
            .map(|row| ColumnInfo {
                cid: row.get("cid"),
                name: row.get("name"),
                col_type: row.get("type"),
                notnull: row.get::<i32, _>("notnull") != 0,
                dflt_value: row.get("dflt_value"),
                pk: row.get::<i32, _>("pk") != 0,
            })
            .collect();

        Ok(columns)
    }

    async fn execute_query(&self, query: &str) -> EngineResult<QueryResult> {
        let pool = self.pool.read().await;
        let pool = pool.as_ref()
            .ok_or_else(|| EngineError::ConnectionFailed("Not connected to database".to_string()))?;

        let trimmed = query.trim();
        
        // Strip leading single-line comments (-- ...) to find actual statement
        let stripped = trimmed.lines()
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
                .map(|row| {
                    (0..row.len())
                        .map(|i| json_from_row(row, i))
                        .collect()
                })
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

    async fn get_table_row_count(&self, table_name: &str) -> EngineResult<i64> {
        Self::validate_table_name(table_name)?;
        
        let pool = self.pool.read().await;
        let pool = pool.as_ref()
            .ok_or_else(|| EngineError::ConnectionFailed("Not connected to database".to_string()))?;

        // Safe because we validated the table name
        let query = format!("SELECT COUNT(*) as count FROM \"{}\"", table_name);

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
}