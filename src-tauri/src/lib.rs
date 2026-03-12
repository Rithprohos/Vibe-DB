pub mod ai;
pub mod engines;

mod app_state;
mod commands;
mod menu;
mod sql_helpers;
mod sql_logging;

use ai::config::AI_STRONGHOLD_PASSWORD_SALT;
use ai::{generate_sql, get_default_ai_provider_config, ping_ai_provider};
use app_state::AppState;
use commands::{
    connect_database, create_database, delete_rows, disconnect_database, execute_query,
    execute_transaction, get_database_version, get_filtered_row_count, get_table_data,
    get_table_row_count, get_table_structure, insert_rows, list_tables, set_active_connection,
};
use menu::setup_menu;
use sql_helpers::{build_create_table_sql, build_create_view_sql};
use std::sync::Arc;

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
                    lanes: 1,
                    mem_cost: 1024,
                    time_cost: 1,
                    variant: Variant::Argon2id,
                    version: Version::Version13,
                    ..Default::default()
                };
                let salt = AI_STRONGHOLD_PASSWORD_SALT;
                let key =
                    hash_raw(password.as_bytes(), salt, &config).expect("failed to hash password");
                key.to_vec()
            })
            .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            connect_database,
            disconnect_database,
            set_active_connection,
            build_create_table_sql,
            build_create_view_sql,
            list_tables,
            get_table_structure,
            execute_query,
            execute_transaction,
            get_table_row_count,
            get_filtered_row_count,
            get_table_data,
            create_database,
            get_database_version,
            delete_rows,
            insert_rows,
            get_default_ai_provider_config,
            ping_ai_provider,
            generate_sql
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
