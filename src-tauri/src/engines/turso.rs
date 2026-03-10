use async_trait::async_trait;
use libsql::{Builder, Connection};
use tokio::sync::RwLock;

use super::traits::DatabaseEngine;
use super::types::{ColumnInfo, ConnectionConfig, QueryResult, TableInfo};
use super::{EngineError, EngineResult};

/// Turso/libSQL database engine implementation.
///
/// Supports both remote Turso databases (via libsql:// URL) and
/// local libSQL files. Uses the official libsql Rust client.
pub struct TursoEngine {
    connection: RwLock<Option<Connection>>,
    db_path: RwLock<Option<String>>,
}

impl TursoEngine {
    /// Creates a new disconnected Turso engine.
    pub fn new() -> Self {
        Self {
            connection: RwLock::new(None),
            db_path: RwLock::new(None),
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

        if trimmed.chars().any(|c| c.is_control()) {
            return Err(EngineError::QueryError(format!(
                "Invalid table name '{}': contains control characters",
                trimmed
            )));
        }
        Ok(())
    }

    fn quote_identifier(identifier: &str) -> String {
        format!("\"{}\"", identifier.replace('"', "\"\""))
    }

    /// Detects dangerous query patterns like DELETE/UPDATE with tautological WHERE clauses.
    pub fn validate_query_safety(query: &str) -> EngineResult<()> {
        let stripped = query
            .lines()
            .filter(|line| !line.trim().starts_with("--"))
            .collect::<Vec<_>>()
            .join(" ");

        let upper = stripped.to_uppercase();
        let upper = upper.trim();

        let is_dangerous = upper.starts_with("DELETE")
            || upper.starts_with("UPDATE")
            || upper.starts_with("DROP")
            || upper.starts_with("TRUNCATE");

        if !is_dangerous {
            return Ok(());
        }

        let has_tautology = Self::detect_tautology(&upper);

        if has_tautology {
            return Err(EngineError::QueryError(
                "Unsafe query blocked: WHERE clause with tautology detected (e.g., 'WHERE 1=1'). \
                 This would affect all rows. Add an explicit LIMIT or use a specific WHERE condition.".to_string()
            ));
        }

        if upper.starts_with("DELETE") && !upper.contains("WHERE") {
            return Err(EngineError::QueryError(
                "Unsafe query blocked: DELETE without WHERE clause would delete all rows. \
                 Add a WHERE clause to specify which rows to delete."
                    .to_string(),
            ));
        }

        if upper.starts_with("UPDATE") && !upper.contains("WHERE") {
            return Err(EngineError::QueryError(
                "Unsafe query blocked: UPDATE without WHERE clause would update all rows. \
                 Add a WHERE clause to specify which rows to update."
                    .to_string(),
            ));
        }

        Ok(())
    }

    fn detect_tautology(upper_query: &str) -> bool {
        let patterns = [
            "WHERE 1=1",
            "WHERE 1 = 1",
            "WHERE '1'='1'",
            "WHERE '1' = '1'",
            "WHERE TRUE",
            "WHERE (1=1)",
            "WHERE (1 = 1)",
            "WHERE 0=0",
            "WHERE 0 = 0",
            "WHERE 'A'='A'",
            "WHERE 'A' = 'A'",
            "WHERE 1<>0",
            "WHERE 1 <> 0",
            "WHERE 1!=0",
            "WHERE 1 != 0",
            "WHERE NOT FALSE",
        ];

        let query_lower = upper_query
            .replace("(", " ")
            .replace(")", " ")
            .replace("  ", " ");

        for pattern in patterns {
            let pattern_normalized = pattern.to_uppercase().replace("  ", " ");
            if query_lower.contains(&pattern_normalized) {
                return true;
            }
        }

        let or_patterns = ["OR 1=1", "OR 1 = 1", "OR '1'='1'", "OR TRUE"];
        for pattern in or_patterns {
            if query_lower.contains(pattern) {
                return true;
            }
        }

        false
    }

    /// Converts a libsql row value to JSON.
    fn json_from_value(value: libsql::Value) -> serde_json::Value {
        match value {
            libsql::Value::Null => serde_json::Value::Null,
            libsql::Value::Integer(i) => serde_json::json!(i),
            libsql::Value::Real(f) => serde_json::json!(f),
            libsql::Value::Text(s) => serde_json::json!(s),
            libsql::Value::Blob(b) => serde_json::json!(format!("<BLOB {} bytes>", b.len())),
        }
    }
}

impl Default for TursoEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DatabaseEngine for TursoEngine {
    async fn connect(&self, config: &ConnectionConfig) -> EngineResult<()> {
        // Determine connection URL
        let url = if let Some(host) = &config.host {
            // Remote Turso database
            if host.starts_with("libsql://") || host.starts_with("https://") {
                host.clone()
            } else {
                format!("libsql://{}", host)
            }
        } else if let Some(path) = &config.path {
            // Local libSQL file
            path.clone()
        } else {
            return Err(EngineError::ConfigError(
                "Either host or path is required for Turso connection".to_string(),
            ));
        };

        // Build connection - local and remote have different builder types
        let conn = if let Some(token) = &config.auth_token {
            // Remote connection with auth token
            let db = Builder::new_remote(url.clone(), token.clone())
                .build()
                .await
                .map_err(|e| EngineError::ConnectionFailed(e.to_string()))?;
            db.connect()
                .map_err(|e| EngineError::ConnectionFailed(e.to_string()))?
        } else if url.starts_with("libsql://") || url.starts_with("https://") {
            return Err(EngineError::ConfigError(
                "Auth token is required for remote Turso connections".to_string(),
            ));
        } else {
            // Local file connection
            let db = Builder::new_local(&url)
                .build()
                .await
                .map_err(|e| EngineError::ConnectionFailed(e.to_string()))?;
            db.connect()
                .map_err(|e| EngineError::ConnectionFailed(e.to_string()))?
        };

        let mut connection = self.connection.write().await;
        *connection = Some(conn);

        let mut db_path = self.db_path.write().await;
        *db_path = Some(url);

        Ok(())
    }

    async fn disconnect(&self) {
        let mut connection = self.connection.write().await;
        *connection = None;
        let mut db_path = self.db_path.write().await;
        *db_path = None;
    }

    async fn is_connected(&self) -> bool {
        self.connection.read().await.is_some()
    }

    async fn list_tables(&self) -> EngineResult<Vec<TableInfo>> {
        let connection = self.connection.read().await;
        let conn = connection.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let stmt = conn
            .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name")
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let rows = stmt
            .query(())
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let mut tables = Vec::new();
        let mut rows = rows;

        loop {
            match rows.next().await {
                Ok(Some(row)) => {
                    let name: String = row
                        .get(0)
                        .map_err(|e| EngineError::QueryError(e.to_string()))?;
                    let table_type: String = row
                        .get(1)
                        .map_err(|e| EngineError::QueryError(e.to_string()))?;
                    tables.push(TableInfo {
                        name,
                        table_type,
                        schema: None,
                    });
                }
                Ok(None) => break,
                Err(e) => return Err(EngineError::QueryError(e.to_string())),
            }
        }

        Ok(tables)
    }

    async fn get_table_structure(&self, table_name: &str) -> EngineResult<Vec<ColumnInfo>> {
        Self::validate_table_name(table_name)?;

        let connection = self.connection.read().await;
        let conn = connection.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let query = format!(
            "PRAGMA table_info({})",
            Self::quote_identifier(table_name.trim())
        );

        let stmt = conn
            .prepare(&query)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let rows = stmt
            .query(())
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let mut columns = Vec::new();
        let mut rows = rows;

        loop {
            match rows.next().await {
                Ok(Some(row)) => {
                    let cid: i64 = row
                        .get(0)
                        .map_err(|e| EngineError::QueryError(e.to_string()))?;
                    let name: String = row
                        .get(1)
                        .map_err(|e| EngineError::QueryError(e.to_string()))?;
                    let col_type: String = row
                        .get(2)
                        .map_err(|e| EngineError::QueryError(e.to_string()))?;
                    let notnull: i32 = row
                        .get(3)
                        .map_err(|e| EngineError::QueryError(e.to_string()))?;
                    let dflt_value: Option<String> = row.get(4).ok();
                    let pk: i32 = row
                        .get(5)
                        .map_err(|e| EngineError::QueryError(e.to_string()))?;

                    columns.push(ColumnInfo {
                        cid,
                        name,
                        col_type,
                        notnull: notnull != 0,
                        dflt_value,
                        pk: pk != 0,
                    });
                }
                Ok(None) => break,
                Err(e) => return Err(EngineError::QueryError(e.to_string())),
            }
        }

        Ok(columns)
    }

    async fn execute_query(&self, query: &str) -> EngineResult<QueryResult> {
        Self::validate_query_safety(query)?;

        let connection = self.connection.read().await;
        let conn = connection.as_ref().ok_or_else(|| {
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
            let stmt = conn
                .prepare(trimmed)
                .await
                .map_err(|e| EngineError::QueryError(e.to_string()))?;

            let rows = stmt
                .query(())
                .await
                .map_err(|e| EngineError::QueryError(e.to_string()))?;

            let mut result_rows: Vec<Vec<serde_json::Value>> = Vec::new();
            let mut columns: Vec<String> = Vec::new();
            let mut rows = rows;

            // Get column names
            let cols = stmt.columns();
            let column_count = cols.len();
            for col in &cols {
                columns.push(col.name().to_string());
            }

            loop {
                match rows.next().await {
                    Ok(Some(row)) => {
                        let mut row_values = Vec::with_capacity(column_count);
                        for i in 0..column_count {
                            let idx: i32 = i as i32;
                            let value: libsql::Value = row
                                .get(idx)
                                .map_err(|e| EngineError::QueryError(e.to_string()))?;
                            row_values.push(Self::json_from_value(value));
                        }
                        result_rows.push(row_values);
                    }
                    Ok(None) => break,
                    Err(e) => return Err(EngineError::QueryError(e.to_string())),
                }
            }

            let row_count = result_rows.len();
            Ok(QueryResult {
                columns,
                rows: result_rows,
                rows_affected: row_count as u64,
                message: format!("{} row(s) returned", row_count),
            })
        } else {
            let result = conn
                .execute(trimmed, ())
                .await
                .map_err(|e| EngineError::QueryError(e.to_string()))?;

            Ok(QueryResult {
                columns: vec![],
                rows: vec![],
                rows_affected: result as u64,
                message: format!("{} row(s) affected", result),
            })
        }
    }

    async fn execute_transaction(&self, queries: &[String]) -> EngineResult<QueryResult> {
        if queries.is_empty() {
            return Err(EngineError::QueryError(
                "No queries provided for transaction".to_string(),
            ));
        }

        let connection = self.connection.read().await;
        let conn = connection.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let mut rows_affected_total = 0_u64;
        let mut statements_executed = 0_u64;

        // Begin transaction
        conn.execute("BEGIN", ())
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let transaction_result: EngineResult<()> = async {
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

                let affected = conn
                    .execute(trimmed, ())
                    .await
                    .map_err(|e| EngineError::QueryError(e.to_string()))?;

                statements_executed += 1;
                rows_affected_total += affected as u64;
            }

            Ok(())
        }
        .await;

        if let Err(error) = transaction_result {
            if let Err(rollback_error) = conn.execute("ROLLBACK", ()).await {
                return Err(EngineError::QueryError(format!(
                    "{error}; rollback failed: {rollback_error}"
                )));
            }
            return Err(error);
        }

        if let Err(commit_error) = conn.execute("COMMIT", ()).await {
            if let Err(rollback_error) = conn.execute("ROLLBACK", ()).await {
                return Err(EngineError::QueryError(format!(
                    "{commit_error}; rollback failed after commit error: {rollback_error}"
                )));
            }
            return Err(EngineError::QueryError(commit_error.to_string()));
        }

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

    async fn get_table_row_count(&self, table_name: &str) -> EngineResult<i64> {
        Self::validate_table_name(table_name)?;

        let connection = self.connection.read().await;
        let conn = connection.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let query = format!(
            "SELECT COUNT(*) as count FROM {}",
            Self::quote_identifier(table_name.trim())
        );

        let stmt = conn
            .prepare(&query)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let mut rows = stmt
            .query(())
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        match rows.next().await {
            Ok(Some(row)) => {
                let count: i64 = row
                    .get(0)
                    .map_err(|e| EngineError::QueryError(e.to_string()))?;
                Ok(count)
            }
            Ok(None) => Err(EngineError::QueryError(
                "Failed to get row count".to_string(),
            )),
            Err(e) => Err(EngineError::QueryError(e.to_string())),
        }
    }

    async fn create_database(&self, path: &str) -> EngineResult<String> {
        // For Turso, creating a local database means just opening it
        // The libsql builder will create the file if it doesn't exist
        let db = Builder::new_local(path)
            .build()
            .await
            .map_err(|e| EngineError::ConnectionFailed(e.to_string()))?;

        let conn = db
            .connect()
            .map_err(|e| EngineError::ConnectionFailed(e.to_string()))?;

        // Execute a simple query to ensure the database is valid
        conn.execute("SELECT 1", ())
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        Ok(path.to_string())
    }

    async fn get_version(&self) -> EngineResult<String> {
        let connection = self.connection.read().await;
        let conn = connection.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let stmt = conn
            .prepare("SELECT sqlite_version() as version")
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let mut rows = stmt
            .query(())
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        match rows.next().await {
            Ok(Some(row)) => {
                let version: String = row
                    .get(0)
                    .map_err(|e| EngineError::QueryError(e.to_string()))?;
                Ok(format!("Turso (SQLite {})", version))
            }
            Ok(None) => Ok("Turso".to_string()),
            Err(e) => Err(EngineError::QueryError(e.to_string())),
        }
    }
}
