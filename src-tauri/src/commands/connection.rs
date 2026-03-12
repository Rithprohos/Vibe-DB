use crate::app_state::AppState;
use crate::engines::{ConnectionConfig, DatabaseEngine};
use std::sync::Arc;

/// Connects to a database.
#[tauri::command]
pub async fn connect_database(
    state: tauri::State<'_, Arc<AppState>>,
    config: ConnectionConfig,
) -> Result<String, String> {
    let id = config.id.clone();

    state
        .registry
        .connect(config)
        .await
        .map_err(|error| error.to_string())?;

    let mut active = state.active_connection.write().await;
    *active = Some(id.clone());

    Ok(id)
}

/// Disconnects from a database.
#[tauri::command]
pub async fn disconnect_database(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: String,
) -> Result<(), String> {
    state
        .registry
        .disconnect(&conn_id)
        .await
        .map_err(|error| error.to_string())
}

/// Sets the active connection for subsequent queries.
#[tauri::command]
pub async fn set_active_connection(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: String,
) -> Result<(), String> {
    let mut active = state.active_connection.write().await;
    *active = Some(conn_id);
    Ok(())
}

/// Creates a new SQLite database file.
#[tauri::command]
pub async fn create_database(db_path: String) -> Result<String, String> {
    let engine = crate::engines::SqliteEngine::new();
    engine
        .create_database(&db_path)
        .await
        .map_err(|error| error.to_string())
}

/// Gets the version of the database.
#[tauri::command]
pub async fn get_database_version(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
) -> Result<String, String> {
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;
    engine
        .get_version()
        .await
        .map_err(|error| error.to_string())
}

pub async fn get_connection_id(
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
