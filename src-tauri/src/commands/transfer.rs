use crate::app_state::AppState;
use crate::commands::get_connection_id;
use crate::sql_logging::emit_sql_log;
use crate::transfer::{
    ExportTableDataInput, ExportTableDataResult, ImportTableDataInput, ImportTableDataResult,
    export_table_data as run_export_table_data, import_table_data as run_import_table_data,
};
use std::sync::Arc;
use std::time::Instant;
use tauri::AppHandle;

fn summarize_sql_for_log(sql: &str) -> String {
    const MAX_SQL_LOG_LEN: usize = 12_000;

    if sql.len() <= MAX_SQL_LOG_LEN {
        return sql.to_string();
    }

    let head = &sql[..MAX_SQL_LOG_LEN];
    format!("{head}\n-- SQL log truncated")
}

#[tauri::command]
pub async fn export_table_data(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    input: ExportTableDataInput,
) -> Result<ExportTableDataResult, String> {
    let start = Instant::now();
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;

    match run_export_table_data(engine.as_ref(), &input).await {
        Ok(result) => {
            emit_sql_log(
                &app,
                result.sql.clone(),
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
                "-- export_table_data failed".to_string(),
                "error",
                start.elapsed().as_secs_f64() * 1000.0,
                message.clone(),
            );
            Err(message)
        }
    }
}

#[tauri::command]
pub async fn import_table_data(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    input: ImportTableDataInput,
) -> Result<ImportTableDataResult, String> {
    let start = Instant::now();
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;

    match run_import_table_data(engine.as_ref(), &input).await {
        Ok(result) => {
            emit_sql_log(
                &app,
                summarize_sql_for_log(&result.sql),
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
                "-- import_table_data failed".to_string(),
                "error",
                start.elapsed().as_secs_f64() * 1000.0,
                message.clone(),
            );
            Err(message)
        }
    }
}
