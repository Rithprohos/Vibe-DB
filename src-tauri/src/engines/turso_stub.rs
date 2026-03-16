use async_trait::async_trait;

use super::traits::DatabaseEngine;
use super::types::{ConnectionConfig, QueryResult, TableInfo, TableStructure};
use super::{EngineError, EngineResult};

const TURSO_WINDOWS_UNSUPPORTED: &str = "Turso engine is unavailable in Windows builds due to a native SQLite linker conflict. Use SQLite or PostgreSQL on Windows.";

/// Windows fallback implementation for the Turso engine.
///
/// This stub keeps the engine type compile-safe while returning a clear
/// unsupported error for all Turso operations.
pub struct TursoEngine;

impl TursoEngine {
    pub fn new() -> Self {
        Self
    }
}

impl Default for TursoEngine {
    fn default() -> Self {
        Self::new()
    }
}

fn unsupported<T>() -> EngineResult<T> {
    Err(EngineError::UnsupportedEngine(
        TURSO_WINDOWS_UNSUPPORTED.to_string(),
    ))
}

#[async_trait]
impl DatabaseEngine for TursoEngine {
    async fn connect(&self, _config: &ConnectionConfig) -> EngineResult<()> {
        unsupported()
    }

    async fn disconnect(&self) {}

    async fn is_connected(&self) -> bool {
        false
    }

    async fn list_tables(&self) -> EngineResult<Vec<TableInfo>> {
        unsupported()
    }

    async fn get_table_structure(&self, _table_name: &str) -> EngineResult<TableStructure> {
        unsupported()
    }

    async fn execute_query(&self, _query: &str) -> EngineResult<QueryResult> {
        unsupported()
    }

    async fn execute_transaction(&self, _queries: &[String]) -> EngineResult<QueryResult> {
        unsupported()
    }

    async fn truncate_table(
        &self,
        _table_name: &str,
        _restart_identity: bool,
        _cascade: bool,
    ) -> EngineResult<QueryResult> {
        unsupported()
    }

    async fn drop_table(&self, _table_name: &str) -> EngineResult<QueryResult> {
        unsupported()
    }

    async fn get_table_row_count(&self, _table_name: &str) -> EngineResult<i64> {
        unsupported()
    }

    async fn create_database(&self, _path: &str) -> EngineResult<String> {
        unsupported()
    }

    async fn get_version(&self) -> EngineResult<String> {
        unsupported()
    }
}
