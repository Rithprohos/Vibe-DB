use crate::app_state::AppState;
use crate::commands::get_connection_id;
use crate::engines::{TableInfo, TableStructure};
use crate::sql_helpers::{
    build_where_clause, extract_count, normalize_order_dir, quote_identifier,
    quote_qualified_identifier, FilterConditionInput,
};
use crate::sql_logging::emit_sql_log;
use std::sync::Arc;
use std::time::Instant;
use tauri::AppHandle;

/// Lists all tables in the database.
#[tauri::command]
pub async fn list_tables(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
) -> Result<Vec<TableInfo>, String> {
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;
    engine
        .list_tables()
        .await
        .map_err(|error| error.to_string())
}

/// Gets the complete structure of a table including columns, indexes, and foreign keys.
#[tauri::command]
pub async fn get_table_structure(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
) -> Result<TableStructure, String> {
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;
    engine
        .get_table_structure(&table_name)
        .await
        .map_err(|error| error.to_string())
}

/// Gets the row count of a table.
#[tauri::command]
pub async fn get_table_row_count(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
) -> Result<i64, String> {
    let start = Instant::now();
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;
    let sql = format!(
        "SELECT COUNT(*) as count FROM {}",
        quote_qualified_identifier(table_name.trim())
    );

    match engine.get_table_row_count(&table_name).await {
        Ok(count) => {
            emit_sql_log(
                &app,
                sql,
                "success",
                start.elapsed().as_secs_f64() * 1000.0,
                format!("Counted {count} row(s)"),
            );
            Ok(count)
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

/// Gets the row count of a table with optional structured filters.
#[tauri::command]
pub async fn get_filtered_row_count(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
    filters: Option<Vec<FilterConditionInput>>,
) -> Result<i64, String> {
    let start = Instant::now();
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
    let filter_items = filters.unwrap_or_default();
    let where_clause = build_where_clause(&filter_items, &structure.columns)?;

    let mut query = format!(
        "SELECT COUNT(*) as count FROM {}",
        quote_qualified_identifier(table_name.trim())
    );
    if let Some(where_sql) = where_clause {
        query.push_str(" WHERE ");
        query.push_str(&where_sql);
    }

    match engine.execute_query(&query).await {
        Ok(result) => {
            let count = extract_count(&result)?;
            emit_sql_log(
                &app,
                query,
                "success",
                start.elapsed().as_secs_f64() * 1000.0,
                format!("Counted {count} filtered row(s)"),
            );
            Ok(count)
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

/// Fetches table data using structured query options built in Rust.
#[tauri::command]
pub async fn get_table_data(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
    limit: Option<u32>,
    offset: Option<u32>,
    order_by: Option<String>,
    order_dir: Option<String>,
    filters: Option<Vec<FilterConditionInput>>,
) -> Result<crate::engines::QueryResult, String> {
    let start = Instant::now();
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
    let filter_items = filters.unwrap_or_default();
    let has_filters = !filter_items.is_empty();
    let where_clause = build_where_clause(&filter_items, &structure.columns)?;

    let mut query = format!(
        "SELECT * FROM {}",
        quote_qualified_identifier(table_name.trim())
    );
    if let Some(where_sql) = where_clause {
        query.push_str(" WHERE ");
        query.push_str(&where_sql);
    }
    if let Some(order_by_col) = order_by
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
    {
        query.push_str(" ORDER BY ");
        query.push_str(&quote_identifier(order_by_col));
        query.push(' ');
        query.push_str(normalize_order_dir(order_dir));
    }
    query.push_str(&format!(
        " LIMIT {} OFFSET {}",
        limit.unwrap_or(200),
        offset.unwrap_or(0)
    ));

    match engine.execute_query(&query).await {
        Ok(result) => {
            let message = format!(
                "{} row(s) fetched{}",
                result.rows.len(),
                if has_filters { " with filters" } else { "" }
            );
            emit_sql_log(
                &app,
                query,
                "success",
                start.elapsed().as_secs_f64() * 1000.0,
                message,
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
