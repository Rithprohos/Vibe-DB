use crate::app_state::AppState;
use crate::commands::get_connection_id;
use crate::engines::{DatabaseEngine, QueryResult};
use crate::sql_logging::emit_sql_log;
use std::sync::Arc;
use std::time::Instant;
use tauri::AppHandle;

/// Executes a SQL query.
#[tauri::command]
pub async fn execute_query(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    query: String,
) -> Result<QueryResult, String> {
    let start = Instant::now();
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;

    match engine.execute_query(&query).await {
        Ok(result) => {
            emit_sql_log(
                &app,
                query,
                "success",
                start.elapsed().as_secs_f64() * 1000.0,
                result.message.clone(),
            );
            Ok(result)
        }
        Err(error) => {
            let message = error.to_string();
            emit_sql_log(
                &app,
                query,
                "error",
                start.elapsed().as_secs_f64() * 1000.0,
                message.clone(),
            );
            Err(message)
        }
    }
}

/// Executes multiple SQL queries in a single transaction.
#[tauri::command]
pub async fn execute_transaction(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    queries: Vec<String>,
) -> Result<QueryResult, String> {
    let start = Instant::now();
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;
    let sql = queries.join("\n");

    match engine.execute_transaction(&queries).await {
        Ok(result) => {
            emit_sql_log(
                &app,
                sql,
                "success",
                start.elapsed().as_secs_f64() * 1000.0,
                result.message.clone(),
            );
            Ok(result)
        }
        Err(error) => {
            let message = error.to_string();
            emit_sql_log(
                &app,
                sql,
                "error",
                start.elapsed().as_secs_f64() * 1000.0,
                message.clone(),
            );
            Err(message)
        }
    }
}
