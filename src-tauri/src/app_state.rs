use crate::engines::EngineRegistry;
use tokio::sync::RwLock;

/// Global application state shared across Tauri commands.
pub struct AppState {
    /// Database engine registry.
    pub registry: EngineRegistry,
    /// Currently active connection ID.
    pub active_connection: RwLock<Option<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            registry: EngineRegistry::new(),
            active_connection: RwLock::new(None),
        }
    }
}
