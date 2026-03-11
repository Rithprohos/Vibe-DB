use crate::app_state::AppState;
use crate::engines::{ConnectionConfig, DatabaseEngine, QueryResult, TableInfo, TableStructure};
use crate::sql_helpers::{
    build_delete_queries, build_where_clause, extract_count, normalize_order_dir, quote_identifier,
    quote_qualified_identifier, FilterConditionInput, RowIdentifierInput,
};
use crate::sql_logging::emit_sql_log;
use std::sync::Arc;
use std::time::Instant;
use tauri::AppHandle;

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
) -> Result<QueryResult, String> {
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

    // Get table structure to build proper WHERE clauses
    let structure = engine
        .get_table_structure(&table_name)
        .await
        .map_err(|error| error.to_string())?;

    // Build DELETE queries in Rust
    let queries = build_delete_queries(&table_name, &rows, &structure.columns)
        .map_err(|error| format!("Failed to build delete queries: {}", error))?;

    // Execute in transaction
    match engine.execute_transaction(&queries).await {
        Ok(result) => {
            let message = format!("Deleted {} row(s)", result.rows_affected);
            emit_sql_log(
                &app,
                queries.join("\n"),
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
                queries.join("\n"),
                "error",
                start.elapsed().as_secs_f64() * 1000.0,
                message.clone(),
            );
            Err(message)
        }
    }
}

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
