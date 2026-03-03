mod traits;
mod types;
mod sqlite;

pub use traits::DatabaseEngine;
pub use types::{TableInfo, ColumnInfo, QueryResult, EngineType, ConnectionConfig};
pub use sqlite::SqliteEngine;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use thiserror::Error;

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
pub struct EngineRegistry {
    connections: RwLock<HashMap<String, Arc<dyn DatabaseEngine>>>,
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
            #[allow(unreachable_patterns)]
            _ => return Err(EngineError::UnsupportedEngine(format!("{:?}", config.engine_type))),
        };

        engine.connect(&config).await?;
        let conn_id = config.id;
        let mut connections = self.connections.write().await;
        connections.insert(conn_id.clone(), engine);
        Ok(conn_id)
    }

    /// Disconnects and removes a connection from the registry.
    pub async fn disconnect(&self, conn_id: &str) -> EngineResult<()> {
        let mut connections = self.connections.write().await;
        if let Some(engine) = connections.remove(conn_id) {
            engine.disconnect().await;
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
            .cloned()
            .ok_or_else(|| EngineError::ConnectionFailed(format!("No connection found: {}", conn_id)))
    }
}

impl Default for EngineRegistry {
    fn default() -> Self {
        Self::new()
    }
}