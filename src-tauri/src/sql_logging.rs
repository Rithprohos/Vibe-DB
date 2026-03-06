use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SqlLogEvent {
    sql: String,
    status: &'static str,
    duration: f64,
    message: String,
}

pub fn emit_sql_log(
    app: &AppHandle,
    sql: String,
    status: &'static str,
    duration: f64,
    message: String,
) {
    let _ = app.emit(
        "vibedb:sql-log",
        SqlLogEvent {
            sql,
            status,
            duration,
            message,
        },
    );
}
