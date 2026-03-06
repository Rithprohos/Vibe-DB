use serde::Serialize;

pub const AI_STRONGHOLD_PASSWORD_SALT: &[u8] = b"vibedb_ai_key_salt_v1";

const DEFAULT_AI_PROVIDER: &str = "pollinations";
const DEFAULT_AI_BASE_URL: &str = match option_env!("VIBEDB_DEFAULT_AI_URL") {
    Some(value) => value,
    None => "https://gen.pollinations.ai",
};
const DEFAULT_AI_MODEL: &str = match option_env!("VIBEDB_DEFAULT_AI_MODEL") {
    Some(value) => value,
    None => "openai",
};
const DEFAULT_AI_API_KEY: &str = match option_env!("VIBEDB_DEFAULT_AI_API_KEY") {
    Some(value) => value,
    None => "",
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultAiProviderConfig {
    provider: String,
    base_url: String,
    model: String,
    has_embedded_api_key: bool,
}

#[tauri::command]
pub fn get_default_ai_provider_config() -> DefaultAiProviderConfig {
    DefaultAiProviderConfig {
        provider: DEFAULT_AI_PROVIDER.to_string(),
        base_url: DEFAULT_AI_BASE_URL.to_string(),
        model: DEFAULT_AI_MODEL.to_string(),
        has_embedded_api_key: !DEFAULT_AI_API_KEY.trim().is_empty(),
    }
}
