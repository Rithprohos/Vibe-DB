pub mod postgres;
mod row_decode;
mod safety;
pub mod sqlite;
mod traits;
#[cfg(not(windows))]
pub mod turso;
#[cfg(windows)]
#[path = "turso_stub.rs"]
pub mod turso;
pub mod types;

pub use postgres::PostgresEngine;
pub use sqlite::SqliteEngine;
pub use traits::DatabaseEngine;
pub use turso::TursoEngine;
pub use types::{
    ColumnInfo, ConnectionConfig, ConnectionTag, EngineType, ForeignKeyInfo, IndexInfo,
    QueryResult, TableInfo, TableStructure,
};

use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;

/// Errors that can occur during database engine operations.
#[derive(Error, Debug)]
pub enum EngineError {
    /// Failed to connect to the database
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    /// Query execution failed
    #[error("Query error: {0}")]
    QueryError(String),

    /// Requested engine type is not supported
    #[error("Unsupported engine: {0}")]
    UnsupportedEngine(String),

    /// Invalid configuration provided
    #[error("Configuration error: {0}")]
    ConfigError(String),
}

pub type EngineResult<T> = Result<T, EngineError>;

/// Registry for managing multiple database connections.
///
/// The registry maintains a map of connection IDs to engine instances,
/// allowing multiple simultaneous connections to different databases.
/// Connection entry storing both the engine and its type.
struct ConnectionEntry {
    engine: Arc<dyn DatabaseEngine>,
    engine_type: EngineType,
    tag: Option<ConnectionTag>,
}

pub struct EngineRegistry {
    connections: RwLock<HashMap<String, ConnectionEntry>>,
}

impl EngineRegistry {
    /// Creates a new empty registry.
    pub fn new() -> Self {
        Self {
            connections: RwLock::new(HashMap::new()),
        }
    }

    /// Connects to a database and registers it with the given configuration.
    ///
    /// Returns the connection ID on success.
    pub async fn connect(&self, config: ConnectionConfig) -> EngineResult<String> {
        let engine: Arc<dyn DatabaseEngine> = match config.engine_type {
            EngineType::Sqlite => Arc::new(SqliteEngine::new()),
            EngineType::Turso => Arc::new(TursoEngine::new()),
            EngineType::Postgres => Arc::new(PostgresEngine::new()),
            EngineType::Mysql => {
                return Err(EngineError::UnsupportedEngine(
                    "MySQL engine not yet implemented".to_string(),
                ));
            }
        };

        engine.connect(&config).await?;
        let conn_id = config.id;
        let engine_type = config.engine_type;
        let entry = ConnectionEntry {
            engine,
            engine_type,
            tag: config.tag,
        };
        let mut connections = self.connections.write().await;
        connections.insert(conn_id.clone(), entry);
        Ok(conn_id)
    }

    /// Disconnects and removes a connection from the registry.
    pub async fn disconnect(&self, conn_id: &str) -> EngineResult<()> {
        let mut connections = self.connections.write().await;
        if let Some(entry) = connections.remove(conn_id) {
            entry.engine.disconnect().await;
        }
        Ok(())
    }

    /// Gets a reference to a database engine by connection ID.
    ///
    /// Returns an error if the connection is not found.
    pub async fn get_engine(&self, conn_id: &str) -> EngineResult<Arc<dyn DatabaseEngine>> {
        let connections = self.connections.read().await;
        connections
            .get(conn_id)
            .map(|entry| entry.engine.clone())
            .ok_or_else(|| {
                EngineError::ConnectionFailed(format!("No connection found: {}", conn_id))
            })
    }

    /// Gets the engine type for a connection by ID.
    ///
    /// Returns an error if the connection is not found.
    pub async fn get_connection_type(&self, conn_id: &str) -> EngineResult<EngineType> {
        let connections = self.connections.read().await;
        connections
            .get(conn_id)
            .map(|entry| entry.engine_type)
            .ok_or_else(|| {
                EngineError::ConnectionFailed(format!("No connection found: {}", conn_id))
            })
    }

    /// Gets the user-assigned environment tag for a connection by ID.
    pub async fn get_connection_tag(&self, conn_id: &str) -> EngineResult<Option<ConnectionTag>> {
        let connections = self.connections.read().await;
        connections
            .get(conn_id)
            .map(|entry| entry.tag)
            .ok_or_else(|| {
                EngineError::ConnectionFailed(format!("No connection found: {}", conn_id))
            })
    }

    /// Updates the user-assigned environment tag for a live connection.
    pub async fn set_connection_tag(
        &self,
        conn_id: &str,
        tag: Option<ConnectionTag>,
    ) -> EngineResult<()> {
        let mut connections = self.connections.write().await;
        let entry = connections.get_mut(conn_id).ok_or_else(|| {
            EngineError::ConnectionFailed(format!("No connection found: {}", conn_id))
        })?;
        entry.tag = tag;
        Ok(())
    }
}

impl Default for EngineRegistry {
    fn default() -> Self {
        Self::new()
    }
}
