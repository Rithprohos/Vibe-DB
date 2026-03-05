pub mod engines;

use engines::{
    ColumnInfo, ConnectionConfig, DatabaseEngine, EngineRegistry, QueryResult, TableInfo,
};
use serde::Deserialize;
use std::sync::Arc;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter};
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTableColumnInput {
    name: String,
    #[serde(rename = "type")]
    col_type: String,
    #[serde(default)]
    primary_key: bool,
    #[serde(default)]
    auto_increment: bool,
    #[serde(default)]
    not_null: bool,
    #[serde(default)]
    unique: bool,
    #[serde(default)]
    default_option: String,
    #[serde(default)]
    default_value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FilterConditionInput {
    field: String,
    operator: String,
    #[serde(default)]
    value: String,
    #[serde(default)]
    value_to: String,
}

fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('\"', "\"\""))
}

fn escape_sql_string(value: &str) -> String {
    value.replace('\'', "''")
}

fn is_numeric_column(col_type: &str) -> bool {
    let t = col_type.to_ascii_lowercase();
    t.contains("int")
        || t.contains("real")
        || t.contains("double")
        || t.contains("float")
        || t.contains("numeric")
        || t.contains("decimal")
}

fn normalize_order_dir(order_dir: Option<String>) -> &'static str {
    match order_dir
        .as_deref()
        .map(str::trim)
        .map(str::to_ascii_uppercase)
        .as_deref()
    {
        Some("DESC") => "DESC",
        _ => "ASC",
    }
}

fn format_sql_literal(value: &str, is_numeric: bool) -> String {
    let trimmed = value.trim();
    if is_numeric && trimmed.parse::<f64>().is_ok() {
        trimmed.to_string()
    } else {
        format!("'{}'", escape_sql_string(trimmed))
    }
}

fn build_where_clause(
    filters: &[FilterConditionInput],
    structure: &[ColumnInfo],
) -> Result<Option<String>, String> {
    let mut conditions = Vec::new();

    for filter in filters {
        let field = filter.field.trim();
        let operator = filter.operator.trim().to_ascii_uppercase();
        if field.is_empty() || operator.is_empty() {
            continue;
        }

        let is_unary = matches!(operator.as_str(), "IS NULL" | "IS NOT NULL");
        let is_between = matches!(operator.as_str(), "BETWEEN" | "NOT BETWEEN");
        let is_like = matches!(operator.as_str(), "LIKE" | "NOT LIKE");
        let is_binary = matches!(operator.as_str(), "=" | "!=" | ">" | "<" | ">=" | "<=");
        if !is_unary && !is_between && !is_like && !is_binary {
            return Err(format!("Unsupported filter operator: {}", filter.operator));
        }

        if is_between && (filter.value.trim().is_empty() || filter.value_to.trim().is_empty()) {
            continue;
        }
        if !is_unary && !is_between && filter.value.trim().is_empty() {
            continue;
        }

        let is_numeric = structure
            .iter()
            .find(|c| c.name == field)
            .map(|c| is_numeric_column(&c.col_type))
            .unwrap_or(false);
        let quoted_field = quote_identifier(field);

        let condition = if is_unary {
            format!("{quoted_field} {operator}")
        } else if is_like {
            format!(
                "{quoted_field} {operator} '{}'",
                escape_sql_string(filter.value.trim())
            )
        } else if is_between {
            let from = format_sql_literal(&filter.value, is_numeric);
            let to = format_sql_literal(&filter.value_to, is_numeric);
            format!("{quoted_field} {operator} {from} AND {to}")
        } else {
            let value = format_sql_literal(&filter.value, is_numeric);
            format!("{quoted_field} {operator} {value}")
        };

        conditions.push(condition);
    }

    if conditions.is_empty() {
        Ok(None)
    } else {
        Ok(Some(conditions.join(" AND ")))
    }
}

fn extract_count(result: &QueryResult) -> Result<i64, String> {
    let Some(row) = result.rows.first() else {
        return Ok(0);
    };
    let Some(value) = row.first() else {
        return Ok(0);
    };

    if let Some(v) = value.as_i64() {
        return Ok(v);
    }
    if let Some(v) = value.as_u64() {
        return i64::try_from(v).map_err(|_| "Row count overflowed i64".to_string());
    }
    if let Some(v) = value.as_f64() {
        return Ok(v as i64);
    }
    if let Some(v) = value.as_str() {
        return v
            .parse::<i64>()
            .map_err(|_| format!("Failed to parse row count: {v}"));
    }

    Err("Unexpected row count value type".to_string())
}

/// Builds a validated CREATE TABLE SQL statement from structured column definitions.
#[tauri::command]
fn build_create_table_sql(
    table_name: String,
    columns: Vec<CreateTableColumnInput>,
    if_not_exists: bool,
) -> Result<String, String> {
    let trimmed_table_name = table_name.trim();
    if trimmed_table_name.is_empty() {
        return Err("Table name is required".to_string());
    }

    let valid_columns: Vec<_> = columns
        .into_iter()
        .filter(|col| !col.name.trim().is_empty())
        .collect();
    if valid_columns.is_empty() {
        return Err("At least one column with a name is required".to_string());
    }

    let mut seen_names = std::collections::HashSet::new();
    for col in &valid_columns {
        let normalized = col.name.trim().to_ascii_lowercase();
        if !seen_names.insert(normalized.clone()) {
            return Err(format!("Duplicate column name: \"{}\"", normalized));
        }
    }

    let column_defs: Vec<String> = valid_columns
        .iter()
        .map(|col| {
            let mut parts = Vec::new();
            parts.push(quote_identifier(col.name.trim()));
            parts.push(col.col_type.trim().to_string());

            if col.primary_key {
                parts.push("PRIMARY KEY".to_string());
            }
            if col.auto_increment
                && col.primary_key
                && col.col_type.trim().eq_ignore_ascii_case("INTEGER")
            {
                parts.push("AUTOINCREMENT".to_string());
            }
            if col.not_null && !col.primary_key {
                parts.push("NOT NULL".to_string());
            }
            if col.unique && !col.primary_key {
                parts.push("UNIQUE".to_string());
            }

            let default_val = if col.default_option == "custom" {
                col.default_value.trim()
            } else {
                col.default_option.trim()
            };
            if !default_val.is_empty() && default_val != "none" {
                parts.push(format!("DEFAULT {default_val}"));
            }

            format!("  {}", parts.join(" "))
        })
        .collect();

    let if_not_exists_sql = if if_not_exists { " IF NOT EXISTS" } else { "" };
    Ok(format!(
        "CREATE TABLE{if_not_exists_sql} {} (\n{}\n);",
        quote_identifier(trimmed_table_name),
        column_defs.join(",\n")
    ))
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

/// Executes multiple SQL queries in a single transaction.
#[tauri::command]
async fn execute_transaction(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    queries: Vec<String>,
) -> Result<QueryResult, String> {
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|e| e.to_string())?;
    engine
        .execute_transaction(&queries)
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

/// Gets the row count of a table with optional structured filters.
#[tauri::command]
async fn get_filtered_row_count(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
    filters: Option<Vec<FilterConditionInput>>,
) -> Result<i64, String> {
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|e| e.to_string())?;

    let structure = engine
        .get_table_structure(&table_name)
        .await
        .map_err(|e| e.to_string())?;
    let where_clause = build_where_clause(&filters.unwrap_or_default(), &structure)?;

    let mut query = format!(
        "SELECT COUNT(*) as count FROM {}",
        quote_identifier(table_name.trim())
    );
    if let Some(where_sql) = where_clause {
        query.push_str(" WHERE ");
        query.push_str(&where_sql);
    }

    let result = engine
        .execute_query(&query)
        .await
        .map_err(|e| e.to_string())?;
    extract_count(&result)
}

/// Fetches table data using structured query options built in Rust.
#[tauri::command]
async fn get_table_data(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    table_name: String,
    limit: Option<u32>,
    offset: Option<u32>,
    order_by: Option<String>,
    order_dir: Option<String>,
    filters: Option<Vec<FilterConditionInput>>,
) -> Result<QueryResult, String> {
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|e| e.to_string())?;

    let structure = engine
        .get_table_structure(&table_name)
        .await
        .map_err(|e| e.to_string())?;
    let where_clause = build_where_clause(&filters.unwrap_or_default(), &structure)?;

    let mut query = format!("SELECT * FROM {}", quote_identifier(table_name.trim()));
    if let Some(where_sql) = where_clause {
        query.push_str(" WHERE ");
        query.push_str(&where_sql);
    }
    if let Some(order_by_col) = order_by.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
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

    engine
        .execute_query(&query)
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

/// Gets the version of the database.
#[tauri::command]
async fn get_database_version(
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
) -> Result<String, String> {
    let id = get_connection_id(&state, conn_id).await?;
    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|e| e.to_string())?;
    engine.get_version().await.map_err(|e| e.to_string())
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
        .plugin(
            tauri_plugin_stronghold::Builder::new(|password| {
                use argon2::{hash_raw, Config, Variant, Version};
                let config = Config {
                    lanes: 4,
                    mem_cost: 10_000,
                    time_cost: 10,
                    variant: Variant::Argon2id,
                    version: Version::Version13,
                    ..Default::default()
                };
                let salt = b"vibedb_secure_salt_fixed";
                let key =
                    hash_raw(password.as_bytes(), salt, &config).expect("failed to hash password");
                key.to_vec()
            })
            .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            connect_database,
            disconnect_database,
            set_active_connection,
            build_create_table_sql,
            list_tables,
            get_table_structure,
            execute_query,
            execute_transaction,
            get_table_row_count,
            get_filtered_row_count,
            get_table_data,
            create_database,
            get_database_version
        ])
        .setup(|app| {
            let handle = app.handle();
            setup_menu(handle)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        // PANIC: Application cannot continue without Tauri runtime.
        // This only fails due to misconfiguration or missing resources.
        .expect("Failed to start Tauri application - check configuration");
}

fn setup_menu(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let about = MenuItem::with_id(app, "about", "About VibeDB", true, None::<&str>)?;
    let check_updates = MenuItem::with_id(
        app,
        "check_updates",
        "Check for Updates",
        true,
        None::<&str>,
    )?;
    let separator = PredefinedMenuItem::separator(app)?;

    let app_submenu =
        Submenu::with_items(app, "VibeDB", true, &[&about, &separator, &check_updates])?;

    let menu = Menu::with_items(
        app,
        &[
            &app_submenu,
            &Submenu::new(app, "File", true)?,
            &Submenu::new(app, "Edit", true)?,
            &Submenu::new(app, "View", true)?,
        ],
    )?;

    app.set_menu(menu)?;

    let app_handle = app.clone();
    app.on_menu_event(move |_app, event| {
        if event.id() == "check_updates" {
            let _ = app_handle.emit("vibedb:check-updates", ());
        }
    });

    Ok(())
}
