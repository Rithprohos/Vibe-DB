use async_trait::async_trait;
use sqlx::postgres::{PgPool, PgPoolOptions, PgRow};
use sqlx::{Column, Row, TypeInfo};
use tokio::sync::RwLock;

use super::row_decode;
use super::safety;
use super::traits::DatabaseEngine;
use super::types::{
    ColumnInfo, ConnectionConfig, ForeignKeyInfo, IndexInfo, QueryResult, TableInfo, TableStructure,
};
use super::{EngineError, EngineResult};

/// PostgreSQL database engine implementation using sqlx.
///
/// Supports connection pooling and full PostgreSQL feature set including
/// schemas, JSON/JSONB, arrays, and advanced types.
pub struct PostgresEngine {
    pool: RwLock<Option<PgPool>>,
    config: RwLock<Option<ConnectionConfig>>,
}

impl PostgresEngine {
    /// Creates a new disconnected PostgreSQL engine.
    pub fn new() -> Self {
        Self {
            pool: RwLock::new(None),
            config: RwLock::new(None),
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

        // Prevent control characters in identifiers
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

        Ok(())
    }

    /// Validates a schema name before embedding it as a quoted SQL identifier.
    pub fn validate_schema_name(name: &str) -> EngineResult<()> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(EngineError::QueryError(
                "Schema name cannot be empty".to_string(),
            ));
        }

        if trimmed.chars().any(|c| c.is_control()) {
            return Err(EngineError::QueryError(format!(
                "Invalid schema name '{}': contains control characters",
                trimmed
            )));
        }

        if trimmed.contains(';') {
            return Err(EngineError::QueryError(format!(
                "Invalid schema name '{}': contains semicolon",
                trimmed
            )));
        }

        Ok(())
    }

    fn quote_identifier(identifier: &str) -> String {
        format!("\"{}\"", identifier.replace('"', "\"\""))
    }

    /// Builds a connection string from the configuration.
    fn build_connection_string(config: &ConnectionConfig) -> EngineResult<String> {
        let host = config.host.as_ref().ok_or_else(|| {
            EngineError::ConfigError("Host is required for PostgreSQL connection".to_string())
        })?;

        let port = config.port.unwrap_or(5432);

        let username = config.username.as_ref().ok_or_else(|| {
            EngineError::ConfigError("Username is required for PostgreSQL connection".to_string())
        })?;

        let database = config.database.as_deref().unwrap_or("postgres");

        // Build connection string
        let mut conn_str = if let Some(password) = &config.password {
            format!(
                "postgres://{}:{}@{}:{}/{}",
                urlencoding::encode(username),
                urlencoding::encode(password),
                host,
                port,
                database
            )
        } else {
            format!(
                "postgres://{}@{}:{}/{}",
                urlencoding::encode(username),
                host,
                port,
                database
            )
        };

        // Add SSL mode (default to prefer)
        let ssl_mode = config.ssl_mode.as_deref().unwrap_or("prefer");
        conn_str.push_str(&format!("?sslmode={}", ssl_mode));

        Ok(conn_str)
    }

    /// Detects dangerous query patterns like DELETE/UPDATE without WHERE clauses.
    /// Returns an error if the query appears unsafe.
    pub fn validate_query_safety(query: &str) -> EngineResult<()> {
        safety::validate_query_safety(query)
    }

    /// Converts a PostgreSQL row value to JSON based on the column type info.
    fn json_from_row(row: &PgRow, col_idx: usize) -> serde_json::Value {
        let columns = row.columns();
        let col = match columns.get(col_idx) {
            Some(c) => c,
            None => return serde_json::Value::Null,
        };
        let col_name = col.name();
        let type_info = col.type_info();
        let type_name = type_info.name();

        // Handle PostgreSQL-specific types
        match type_name {
            // JSON and JSONB types
            "JSON" | "JSONB" => {
                if let Ok(val) = row.try_get::<Option<serde_json::Value>, _>(col_name) {
                    val.unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            // Array types - convert to JSON array
            _ if type_name.ends_with("[]") => {
                if let Ok(val) = row.try_get::<Option<Vec<String>>, _>(col_name) {
                    match val {
                        Some(arr) => serde_json::json!(arr),
                        None => serde_json::Value::Null,
                    }
                } else if let Ok(val) = row.try_get::<Option<Vec<i64>>, _>(col_name) {
                    match val {
                        Some(arr) => serde_json::json!(arr),
                        None => serde_json::Value::Null,
                    }
                } else if let Ok(val) = row.try_get::<Option<Vec<f64>>, _>(col_name) {
                    match val {
                        Some(arr) => serde_json::json!(arr),
                        None => serde_json::Value::Null,
                    }
                } else {
                    serde_json::Value::Null
                }
            }
            // UUID type
            "UUID" => {
                if let Ok(val) = row.try_get::<Option<String>, _>(col_name) {
                    val.map(|v| serde_json::json!(v))
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            // Timestamp types
            "TIMESTAMP" | "TIMESTAMPTZ" | "DATE" | "TIME" | "TIMETZ" => {
                if let Ok(val) = row.try_get::<Option<String>, _>(col_name) {
                    val.map(|v| serde_json::json!(v))
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            // Bytea (binary data)
            "BYTEA" => {
                if let Ok(val) = row.try_get::<Option<Vec<u8>>, _>(col_name) {
                    val.map(|v| serde_json::json!(format!("<BLOB {} bytes>", v.len())))
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            // Network address types
            "INET" | "CIDR" | "MACADDR" | "MACADDR8" => {
                if let Ok(val) = row.try_get::<Option<String>, _>(col_name) {
                    val.map(|v| serde_json::json!(v))
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            // Numeric/Decimal - handle as string to preserve precision
            "NUMERIC" | "DECIMAL" => {
                if let Ok(val) = row.try_get::<Option<String>, _>(col_name) {
                    val.map(|v| serde_json::json!(v))
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            // Boolean
            "BOOL" => {
                if let Ok(val) = row.try_get::<Option<bool>, _>(col_name) {
                    val.map(|v| serde_json::json!(v))
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            // Integer types
            "INT2" | "INT4" => {
                if let Ok(val) = row.try_get::<Option<i32>, _>(col_name) {
                    val.map(|v| serde_json::json!(v as i64))
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            "INT8" => {
                if let Ok(val) = row.try_get::<Option<i64>, _>(col_name) {
                    val.map(|v| serde_json::json!(v))
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            // Float types
            "FLOAT4" => {
                if let Ok(val) = row.try_get::<Option<f32>, _>(col_name) {
                    val.map(|v| serde_json::json!(v as f64))
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            "FLOAT8" => {
                if let Ok(val) = row.try_get::<Option<f64>, _>(col_name) {
                    val.map(|v| serde_json::json!(v))
                        .unwrap_or(serde_json::Value::Null)
                } else {
                    serde_json::Value::Null
                }
            }
            // Default handling for other types
            _ => {
                // Try common types in order of likelihood
                if let Ok(Some(val)) = row.try_get::<Option<String>, _>(col_name) {
                    serde_json::json!(val)
                } else if let Ok(Some(val)) = row.try_get::<Option<i64>, _>(col_name) {
                    serde_json::json!(val)
                } else if let Ok(Some(val)) = row.try_get::<Option<f64>, _>(col_name) {
                    serde_json::json!(val)
                } else if let Ok(Some(val)) = row.try_get::<Option<bool>, _>(col_name) {
                    serde_json::json!(val)
                } else {
                    serde_json::Value::Null
                }
            }
        }
    }
}

impl Default for PostgresEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DatabaseEngine for PostgresEngine {
    async fn connect(&self, config: &ConnectionConfig) -> EngineResult<()> {
        let conn_str = Self::build_connection_string(config)?;

        // Create connection pool
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&conn_str)
            .await
            .map_err(|e| EngineError::ConnectionFailed(e.to_string()))?;

        // Test the connection
        sqlx::query("SELECT 1")
            .fetch_one(&pool)
            .await
            .map_err(|e| EngineError::ConnectionFailed(e.to_string()))?;

        let mut p = self.pool.write().await;
        *p = Some(pool);

        let mut c = self.config.write().await;
        *c = Some(config.clone());

        Ok(())
    }

    async fn disconnect(&self) {
        let mut pool = self.pool.write().await;
        if let Some(p) = pool.take() {
            p.close().await;
        }
        let mut config = self.config.write().await;
        *config = None;
    }

    async fn is_connected(&self) -> bool {
        self.pool.read().await.is_some()
    }

    async fn list_tables(&self) -> EngineResult<Vec<TableInfo>> {
        let pool = self.pool.read().await;
        let pool = pool.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        // Query information_schema.tables for PostgreSQL
        let rows = sqlx::query(
            r#"
            SELECT
                table_name as name,
                CASE
                    WHEN table_type = 'BASE TABLE' THEN 'table'
                    WHEN table_type = 'VIEW' THEN 'view'
                    ELSE LOWER(table_type)
                END as table_type,
                table_schema as schema
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
              AND table_schema NOT LIKE 'pg_toast%'
              AND table_schema NOT LIKE 'pg_temp%'
            ORDER BY table_schema, table_name
            "#,
        )
        .fetch_all(pool)
        .await
        .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let tables = rows
            .iter()
            .map(|row| TableInfo {
                name: row.get("name"),
                table_type: row.get("table_type"),
                schema: row.get("schema"),
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

        // Parse schema and table name (handle "schema.table" format)
        let (schema, table) = if table_name.contains('.') {
            let parts: Vec<&str> = table_name.splitn(2, '.').collect();
            (parts[0].to_string(), parts[1].to_string())
        } else {
            ("public".to_string(), table_name.to_string())
        };

        let _quoted_schema = Self::quote_identifier(&schema);
        let _quoted_table = Self::quote_identifier(&table);

        // Get columns from information_schema.columns
        let column_rows = sqlx::query(
            r#"
            SELECT
                ordinal_position as cid,
                column_name as name,
                data_type as col_type,
                CASE WHEN is_nullable = 'NO' THEN 1 ELSE 0 END as notnull,
                column_default as dflt_value,
                CASE WHEN EXISTS (
                    SELECT 1 FROM information_schema.table_constraints tc
                    JOIN information_schema.constraint_column_usage ccu
                        ON tc.constraint_name = ccu.constraint_name
                    WHERE tc.table_schema = $1
                      AND tc.table_name = $2
                      AND tc.constraint_type = 'PRIMARY KEY'
                      AND ccu.column_name = columns.column_name
                ) THEN 1 ELSE 0 END as pk
            FROM information_schema.columns
            WHERE table_schema = $1
              AND table_name = $2
            ORDER BY ordinal_position
            "#,
        )
        .bind(&schema)
        .bind(&table)
        .fetch_all(pool)
        .await
        .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let columns: Vec<ColumnInfo> = column_rows
            .iter()
            .map(|row| {
                Ok(ColumnInfo {
                    cid: row_decode::decode_postgres_i64(row, "cid")? - 1, // PostgreSQL is 1-indexed, we want 0-indexed
                    name: row.get("name"),
                    col_type: row.get("col_type"),
                    notnull: row.get::<i32, _>("notnull") != 0,
                    dflt_value: row.get("dflt_value"),
                    pk: row.get::<i32, _>("pk") != 0,
                })
            })
            .collect::<EngineResult<Vec<_>>>()?;

        // Get indexes from pg_indexes
        let index_rows = sqlx::query(
            r#"
            SELECT
                indexname as name,
                indexdef as definition
            FROM pg_indexes
            WHERE schemaname = $1
              AND tablename = $2
            "#,
        )
        .bind(&schema)
        .bind(&table)
        .fetch_all(pool)
        .await
        .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let mut indexes: Vec<IndexInfo> = Vec::new();
        for row in &index_rows {
            let index_name: String = row.get("name");
            let index_def: String = row.get("definition");

            // Parse index definition to extract column names
            // CREATE [UNIQUE] INDEX name ON schema.table USING method (col1, col2, ...)
            let is_unique = index_def.contains(" UNIQUE INDEX ");

            // Extract columns from parentheses
            let columns = if let Some(start) = index_def.find('(') {
                if let Some(end) = index_def.find(')') {
                    let cols_str = &index_def[start + 1..end];
                    cols_str
                        .split(',')
                        .map(|s| s.trim().trim_matches('"').to_string())
                        .collect()
                } else {
                    Vec::new()
                }
            } else {
                Vec::new()
            };

            indexes.push(IndexInfo {
                name: index_name,
                unique: is_unique,
                columns,
            });
        }

        // Get foreign keys from information_schema
        let fk_rows = sqlx::query(
            r#"
            SELECT
                kcu.column_name as from_col,
                ccu.table_name as to_table,
                ccu.column_name as to_col
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = $1
              AND tc.table_name = $2
            "#,
        )
        .bind(&schema)
        .bind(&table)
        .fetch_all(pool)
        .await
        .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let foreign_keys: Vec<ForeignKeyInfo> = fk_rows
            .iter()
            .map(|row| ForeignKeyInfo {
                from_col: row.get("from_col"),
                to_table: row.get("to_table"),
                to_col: row.get("to_col"),
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
                        .map(|i| Self::json_from_row(row, i))
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

    async fn get_table_row_count(&self, table_name: &str) -> EngineResult<i64> {
        Self::validate_table_name(table_name)?;

        let pool = self.pool.read().await;
        let pool = pool.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        // Parse schema and table name
        let (schema, table) = if table_name.contains('.') {
            let parts: Vec<&str> = table_name.splitn(2, '.').collect();
            (parts[0].to_string(), parts[1].to_string())
        } else {
            ("public".to_string(), table_name.to_string())
        };

        let query = format!(
            "SELECT COUNT(*) as count FROM {}.{}",
            Self::quote_identifier(&schema),
            Self::quote_identifier(&table)
        );

        let row = sqlx::query(&query)
            .fetch_one(pool)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let count: i64 = row.get("count");
        Ok(count)
    }

    async fn create_database(&self, _path: &str) -> EngineResult<String> {
        // PostgreSQL doesn't create databases via file paths
        // Database creation requires connecting to template1 and running CREATE DATABASE
        Err(EngineError::UnsupportedEngine(
            "PostgreSQL database creation not supported via this API. Use CREATE DATABASE SQL command.".to_string(),
        ))
    }

    async fn get_version(&self) -> EngineResult<String> {
        let pool = self.pool.read().await;
        let pool = pool.as_ref().ok_or_else(|| {
            EngineError::ConnectionFailed("Not connected to database".to_string())
        })?;

        let row = sqlx::query("SELECT version() as version")
            .fetch_one(pool)
            .await
            .map_err(|e| EngineError::QueryError(e.to_string()))?;

        let version: String = row.get("version");
        Ok(version)
    }
}
