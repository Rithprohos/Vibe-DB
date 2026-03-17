use crate::app_state::AppState;
use crate::commands::get_connection_id;
use crate::engines::{QueryResult, TableInfo, TableStructure};
use crate::sql_helpers::{
    FilterConditionInput, build_where_clause, extract_count, normalize_order_dir, quote_identifier,
    quote_qualified_identifier,
};
use crate::sql_logging::emit_sql_log;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use tauri::AppHandle;

/// Options for truncating a table.
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TruncateTableOptions {
    /// Whether to restart identity sequences (auto-increment counters).
    #[serde(default)]
    pub restart_identity: bool,
    /// Whether to cascade to foreign key references (PostgreSQL only).
    #[serde(default)]
    pub cascade: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetTableDataResponse {
    #[serde(flatten)]
    pub result: QueryResult,
    pub duration_ms: f64,
}

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
) -> Result<GetTableDataResponse, String> {
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
            let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
            let message = format!(
                "{} row(s) fetched{}",
                result.rows.len(),
                if has_filters { " with filters" } else { "" }
            );
            emit_sql_log(&app, query, "success", duration_ms, message);
            Ok(GetTableDataResponse {
                result,
                duration_ms,
            })
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

/// Truncates a table, removing all rows.
///
/// Uses DELETE FROM for SQLite (since TRUNCATE is not supported),
/// and TRUNCATE TABLE for PostgreSQL with optional RESTART IDENTITY and CASCADE.
#[tauri::command]
pub async fn truncate_table(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
    options: Option<TruncateTableOptions>,
) -> Result<crate::engines::QueryResult, String> {
    let start = Instant::now();
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;

    let opts = options.unwrap_or_default();
    let trimmed_table_name = table_name.trim();

    // Resolve SQL text for logging based on engine type.
    let engine_type = state
        .registry
        .get_connection_type(&id)
        .await
        .map_err(|error| error.to_string())?;

    let sql = match engine_type {
        crate::engines::EngineType::Postgres => {
            let mut sql = format!(
                "TRUNCATE TABLE {}",
                quote_qualified_identifier(trimmed_table_name)
            );
            if opts.restart_identity {
                sql.push_str(" RESTART IDENTITY");
            }
            if opts.cascade {
                sql.push_str(" CASCADE");
            }
            sql
        }
        _ => {
            // SQLite and Turso: use DELETE FROM
            // Note: SQLite has no native TRUNCATE, DELETE FROM is the standard approach
            format!(
                "DELETE FROM {}",
                quote_qualified_identifier(trimmed_table_name)
            )
        }
    };

    match engine
        .truncate_table(trimmed_table_name, opts.restart_identity, opts.cascade)
        .await
    {
        Ok(result) => {
            let message = format!("Table '{trimmed_table_name}' truncated");
            emit_sql_log(
                &app,
                sql,
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
                sql,
                "error",
                start.elapsed().as_secs_f64() * 1000.0,
                message.clone(),
            );
            Err(message)
        }
    }
}

/// Drops a table from the database.
///
/// This permanently deletes the table and all its data.
#[tauri::command]
pub async fn drop_table(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
) -> Result<crate::engines::QueryResult, String> {
    let start = Instant::now();
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;

    let trimmed_table_name = table_name.trim();
    let sql = format!(
        "DROP TABLE {}",
        quote_qualified_identifier(trimmed_table_name)
    );

    match engine.drop_table(trimmed_table_name).await {
        Ok(result) => {
            let message = format!("Table '{trimmed_table_name}' dropped");
            emit_sql_log(
                &app,
                sql,
                "success",
                start.elapsed().as_secs_f64() * 1000.0,
                message.clone(),
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
