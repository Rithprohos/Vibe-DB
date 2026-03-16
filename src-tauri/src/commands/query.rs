use crate::app_state::AppState;
use crate::commands::get_connection_id;
use crate::engines::QueryResult;
use crate::query_guard::{
    QueryExecutionSurface, QueryPolicyDecision, blocked_message, evaluate_query_policy,
};
use crate::sql_logging::emit_sql_log;
use serde::Serialize;
use std::sync::Arc;
use std::time::Instant;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteQueryResponse {
    #[serde(flatten)]
    pub result: QueryResult,
    pub duration_ms: f64,
}

/// Executes a SQL query.
#[tauri::command]
pub async fn execute_query(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    conn_id: Option<String>,
    query: String,
    surface: QueryExecutionSurface,
) -> Result<ExecuteQueryResponse, String> {
    let start = Instant::now();
    let id = get_connection_id(&state, conn_id).await?;
    let connection_tag = state
        .registry
        .get_connection_tag(&id)
        .await
        .map_err(|error| error.to_string())?;

    if let QueryPolicyDecision::Blocked { statement } =
        evaluate_query_policy(&query, connection_tag, surface)
    {
        let message = blocked_message(statement);
        emit_sql_log(
            &app,
            query,
            "error",
            start.elapsed().as_secs_f64() * 1000.0,
            message.clone(),
        );
        return Err(message);
    }

    let engine = state
        .registry
        .get_engine(&id)
        .await
        .map_err(|error| error.to_string())?;

    match engine.execute_query(&query).await {
        Ok(result) => {
            let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
            emit_sql_log(
                &app,
                query,
                "success",
                duration_ms,
                result.message.clone(),
            );
            Ok(ExecuteQueryResponse {
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
