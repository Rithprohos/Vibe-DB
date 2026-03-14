use super::EngineResult;
use super::types::{ConnectionConfig, QueryResult, TableInfo, TableStructure};
use async_trait::async_trait;

/// Trait for database engine implementations.
///
/// All database engines must implement this trait to provide a consistent
/// interface for database operations. Implementations must be `Send + Sync`
/// for use across async boundaries.
#[async_trait]
pub trait DatabaseEngine: Send + Sync {
    /// Connects to the database using the provided configuration.
    ///
    /// Returns an error if the connection cannot be established.
    async fn connect(&self, config: &ConnectionConfig) -> EngineResult<()>;

    /// Disconnects from the database and releases resources.
    ///
    /// This should be called before dropping the engine to ensure
    /// proper cleanup of connection pools.
    async fn disconnect(&self);

    /// Checks if the engine is currently connected.
    #[allow(dead_code)]
    async fn is_connected(&self) -> bool;

    /// Lists all tables and views in the database.
    async fn list_tables(&self) -> EngineResult<Vec<TableInfo>>;

    /// Gets the complete structure for a specific table including columns, indexes, and foreign keys.
    async fn get_table_structure(&self, table_name: &str) -> EngineResult<TableStructure>;

    /// Executes a SQL query and returns the results.
    ///
    /// For SELECT queries, returns the row data.
    /// For DML/DDL queries, returns the number of affected rows.
    async fn execute_query(&self, query: &str) -> EngineResult<QueryResult>;

    /// Executes multiple SQL statements in a single transaction.
    ///
    /// The implementation must commit only if all statements succeed.
    async fn execute_transaction(&self, queries: &[String]) -> EngineResult<QueryResult>;

    /// Truncates a table by deleting all rows.
    ///
    /// `restart_identity` and `cascade` are honored by engines that support them
    /// (e.g. PostgreSQL) and ignored by engines that do not.
    async fn truncate_table(
        &self,
        table_name: &str,
        restart_identity: bool,
        cascade: bool,
    ) -> EngineResult<QueryResult>;

    /// Gets the total number of rows in a table.
    async fn get_table_row_count(&self, table_name: &str) -> EngineResult<i64>;

    /// Creates a new database file at the specified path.
    async fn create_database(&self, path: &str) -> EngineResult<String>;

    /// Gets the database version information.
    async fn get_version(&self) -> EngineResult<String>;
}
