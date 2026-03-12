use crate::app_state::AppState;
use crate::commands::get_connection_id;
use crate::engines::{DatabaseEngine, QueryResult};
use crate::sql_helpers::{
    build_delete_queries, build_insert_queries, build_update_queries, RowDataInput,
    RowIdentifierInput, RowUpdateInput,
};
use crate::sql_logging::emit_sql_log;
use std::sync::Arc;
use std::time::Instant;
use tauri::AppHandle;

/// Deletes multiple rows from a table by their identifiers.
/// Builds DELETE queries in Rust and executes them in a transaction.
#[tauri::command]
pub async fn delete_rows(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
    rows: Vec<RowIdentifierInput>,
) -> Result<QueryResult, String> {
    let start = Instant::now();

    if rows.is_empty() {
        return Err("No rows to delete".to_string());
    }

    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;

    let structure = engine
        .get_table_structure(&table_name)
        .await
        .map_err(|error| error.to_string())?;

    let queries = build_delete_queries(&table_name, &rows, &structure.columns)
        .map_err(|error| format!("Failed to build delete queries: {error}"))?;
    let sql = queries.join("\n");

    match engine.execute_transaction(&queries).await {
        Ok(result) => {
            let message = format!("Deleted {} row(s)", result.rows_affected);
            emit_sql_log(
                &app,
                sql,
                "success",
                start.elapsed().as_secs_f64() * 1000.0,
                message.clone(),
            );
            Ok(QueryResult { message, ..result })
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

/// Inserts multiple rows into a table.
/// Builds INSERT queries in Rust and executes them in a transaction.
#[tauri::command]
pub async fn insert_rows(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
    rows: Vec<RowDataInput>,
) -> Result<QueryResult, String> {
    let start = Instant::now();

    if rows.is_empty() {
        return Err("No rows to insert".to_string());
    }

    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;

    let queries = build_insert_queries(&table_name, &rows)
        .map_err(|error| format!("Failed to build insert queries: {error}"))?;
    let sql = queries.join("\n");

    match engine.execute_transaction(&queries).await {
        Ok(result) => {
            let message = format!("Inserted {} row(s)", result.rows_affected);
            emit_sql_log(
                &app,
                sql,
                "success",
                start.elapsed().as_secs_f64() * 1000.0,
                message.clone(),
            );
            Ok(QueryResult { message, ..result })
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

/// Updates multiple rows in a table.
/// Builds UPDATE queries in Rust and executes them in a transaction.
#[tauri::command]
pub async fn update_rows(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
    rows: Vec<RowUpdateInput>,
) -> Result<QueryResult, String> {
    let start = Instant::now();

    if rows.is_empty() {
        return Err("No rows to update".to_string());
    }

    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;

    let structure = engine
        .get_table_structure(&table_name)
        .await
        .map_err(|error| error.to_string())?;

    let queries = build_update_queries(&table_name, &rows, &structure.columns)
        .map_err(|error| format!("Failed to build update queries: {error}"))?;
    let sql = queries.join("\n");

    match engine.execute_transaction(&queries).await {
        Ok(result) => {
            let message = format!("Updated {} row(s)", result.rows_affected);
            emit_sql_log(
                &app,
                sql,
                "success",
                start.elapsed().as_secs_f64() * 1000.0,
                message.clone(),
            );
            Ok(QueryResult { message, ..result })
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
