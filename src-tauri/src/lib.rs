pub mod engines;

use engines::{
    ColumnInfo, ConnectionConfig, DatabaseEngine, EngineRegistry, QueryResult, TableInfo,
};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Global application state shared across Tauri commands.
pub struct AppState {
    /// Database engine registry
    registry: EngineRegistry,
    /// Currently active connection ID
    active_connection: RwLock<Option<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            registry: EngineRegistry::new(),
            active_connection: RwLock::new(None),
        }
    }
}

/// Connects to a SQLite database file.
#[tauri::command]
async fn connect_database(
    state: tauri::State<'_, Arc<AppState>>,
    path: String,
    name: String,
) -> Result<String, String> {
    let id = format!("conn-{}", uuid::Uuid::new_v4());
    let config = ConnectionConfig::sqlite(id.clone(), name, path);

    state
        .registry
        .connect(config)
        .await
        .map_err(|e| e.to_string())?;

    let mut active = state.active_connection.write().await;
    *active = Some(id.clone());

    Ok(id)
}

/// Disconnects from a database.
#[tauri::command]
async fn disconnect_database(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: String,
) -> Result<(), String> {
    state
        .registry
        .disconnect(&conn_id)
        .await
        .map_err(|e| e.to_string())
}

/// Sets the active connection for subsequent queries.
#[tauri::command]
async fn set_active_connection(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: String,
) -> Result<(), String> {
    let mut active = state.active_connection.write().await;
    *active = Some(conn_id);
    Ok(())
}

/// Lists all tables in the database.
#[tauri::command]
async fn list_tables(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
) -> Result<Vec<TableInfo>, String> {
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|e| e.to_string())?;
    engine.list_tables().await.map_err(|e| e.to_string())
}

/// Gets the column structure of a table.
#[tauri::command]
async fn get_table_structure(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
) -> Result<Vec<ColumnInfo>, String> {
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|e| e.to_string())?;
    engine
        .get_table_structure(&table_name)
        .await
        .map_err(|e| e.to_string())
}

/// Executes a SQL query.
#[tauri::command]
async fn execute_query(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    query: String,
) -> Result<QueryResult, String> {
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|e| e.to_string())?;
    engine
        .execute_query(&query)
        .await
        .map_err(|e| e.to_string())
}

/// Gets the row count of a table.
#[tauri::command]
async fn get_table_row_count(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
) -> Result<i64, String> {
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|e| e.to_string())?;
    engine
        .get_table_row_count(&table_name)
        .await
        .map_err(|e| e.to_string())
}

/// Creates a new SQLite database file.
#[tauri::command]
async fn create_database(db_path: String) -> Result<String, String> {
    let engine = engines::SqliteEngine::new();
    engine
        .create_database(&db_path)
        .await
        .map_err(|e| e.to_string())
}

/// Resolves the connection ID from optional parameter or active connection.
async fn get_connection_id(
    state: &tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
) -> Result<String, String> {
    match conn_id {
        Some(id) => Ok(id),
        None => {
            let active = state.active_connection.read().await;
            active
                .clone()
                .ok_or_else(|| "No active connection".to_string())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = Arc::new(AppState::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            connect_database,
            disconnect_database,
            set_active_connection,
            list_tables,
            get_table_structure,
            execute_query,
            get_table_row_count,
            create_database
        ])
        .run(tauri::generate_context!())
        // PANIC: Application cannot continue without Tauri runtime.
        // This only fails due to misconfiguration or missing resources.
        .expect("Failed to start Tauri application - check configuration");
}
