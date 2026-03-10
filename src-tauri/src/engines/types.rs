use serde::{Deserialize, Serialize};

/// Supported database engine types.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum EngineType {
    /// SQLite file-based database
    #[default]
    Sqlite,
    /// Turso/LibSQL edge database
    Turso,
    /// PostgreSQL database
    Postgres,
    /// MySQL/MariaDB database
    Mysql,
}

/// Configuration for a database connection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    /// Unique identifier for this connection
    pub id: String,
    /// Human-readable name for the connection
    pub name: String,
    /// Type of database engine
    pub engine_type: EngineType,
    /// File path (for SQLite/Turso local)
    pub path: Option<String>,
    /// Host address (for remote databases)
    pub host: Option<String>,
    /// Port number
    pub port: Option<u16>,
    /// Username for authentication
    pub username: Option<String>,
    /// Password for authentication
    pub password: Option<String>,
    /// Database name
    pub database: Option<String>,
    /// Authentication token (for Turso, etc.)
    pub auth_token: Option<String>,
    /// SSL mode (for PostgreSQL)
    pub ssl_mode: Option<String>,
}

impl ConnectionConfig {
    /// Creates a SQLite connection configuration.
    pub fn sqlite(id: String, name: String, path: String) -> Self {
        Self {
            id,
            name,
            engine_type: EngineType::Sqlite,
            path: Some(path),
            host: None,
            port: None,
            username: None,
            password: None,
            database: None,
            auth_token: None,
            ssl_mode: None,
        }
    }

    /// Creates a Turso remote connection configuration.
    pub fn turso_remote(id: String, name: String, host: String, auth_token: String) -> Self {
        Self {
            id,
            name,
            engine_type: EngineType::Turso,
            path: None,
            host: Some(host),
            port: None,
            username: None,
            password: None,
            database: None,
            auth_token: Some(auth_token),
            ssl_mode: None,
        }
    }

    /// Creates a Turso local file connection configuration.
    pub fn turso_local(id: String, name: String, path: String) -> Self {
        Self {
            id,
            name,
            engine_type: EngineType::Turso,
            path: Some(path),
            host: None,
            port: None,
            username: None,
            password: None,
            database: None,
            auth_token: None,
            ssl_mode: None,
        }
    }

    /// Creates a PostgreSQL connection configuration.
    pub fn postgres(
        id: String,
        name: String,
        host: String,
        port: u16,
        username: String,
        password: Option<String>,
        database: Option<String>,
        ssl_mode: Option<String>,
    ) -> Self {
        Self {
            id,
            name,
            engine_type: EngineType::Postgres,
            path: None,
            host: Some(host),
            port: Some(port),
            username: Some(username),
            password,
            database,
            auth_token: None,
            ssl_mode,
        }
    }
}

/// Information about a database table or view.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableInfo {
    /// Table name
    pub name: String,
    /// Type: "table" or "view"
    pub table_type: String,
    /// Schema name (for multi-schema databases)
    pub schema: Option<String>,
}

/// Information about a table column.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    /// Column index
    pub cid: i64,
    /// Column name
    pub name: String,
    /// Column data type
    pub col_type: String,
    /// Whether the column is NOT NULL
    pub notnull: bool,
    /// Default value for the column
    pub dflt_value: Option<String>,
    /// Whether this column is part of the primary key
    pub pk: bool,
}

/// Information about a table index.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
    /// Index name
    pub name: String,
    /// Whether this is a unique index
    pub unique: bool,
    /// Column names in the index
    pub columns: Vec<String>,
}

/// Information about a foreign key constraint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForeignKeyInfo {
    /// Column name in the source table
    pub from_col: String,
    /// Target table name
    pub to_table: String,
    /// Column name in the target table
    pub to_col: String,
}

/// Complete table structure including columns, indexes, and foreign keys.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableStructure {
    /// Table columns
    pub columns: Vec<ColumnInfo>,
    /// Table indexes
    pub indexes: Vec<IndexInfo>,
    /// Foreign key constraints
    pub foreign_keys: Vec<ForeignKeyInfo>,
}

/// Result of a SQL query execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    /// Column names in the result set
    pub columns: Vec<String>,
    /// Row data as JSON values
    pub rows: Vec<Vec<serde_json::Value>>,
    /// Number of rows affected (for DML statements)
    pub rows_affected: u64,
    /// Human-readable result message
    pub message: String,
}
