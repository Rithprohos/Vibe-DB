pub mod client;
pub mod config;
pub mod prompts;

use serde::{Deserialize, Serialize};

/// Schema column information for AI context
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaColumn {
    pub name: String,
    pub col_type: String,
    pub is_pk: bool,
    pub is_nullable: bool,
}

/// Schema table information for AI context
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaTable {
    pub name: String,
    pub columns: Vec<SchemaColumn>,
}

/// AI provider configuration response
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultAiProviderConfig {
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub has_embedded_api_key: bool,
}

/// Request to generate SQL from natural language
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSqlRequest {
    pub prompt: String,
    pub schema: Vec<SchemaTable>,
    pub provider_kind: String,
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
}

/// Response containing generated SQL
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSqlResponse {
    pub sql: String,
    pub explanation: Option<String>,
}

/// Request to ping/test AI provider connectivity
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderPingRequest {
    pub provider_kind: String,
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
    pub use_default_config: bool,
}

/// Get the default AI provider configuration
#[tauri::command]
pub fn get_default_ai_provider_config() -> DefaultAiProviderConfig {
    config::get_default_config()
}

/// Ping/test the AI provider connectivity
#[tauri::command]
pub async fn ping_ai_provider(request: AiProviderPingRequest) -> Result<(), String> {
    let api_key = request
        .api_key
        .as_deref()
        .filter(|key| !key.trim().is_empty())
        .or_else(|| config::resolve_default_api_key(request.use_default_config));

    client::ping_provider(
        &request.provider_kind,
        &request.base_url,
        &request.model,
        api_key,
    )
    .await
    .map_err(|e| e.to_string())
}

/// Generate SQL from natural language prompt
#[tauri::command]
pub async fn generate_sql(request: GenerateSqlRequest) -> Result<GenerateSqlResponse, String> {
    client::generate_sql(request)
        .await
        .map_err(|e| e.to_string())
}
