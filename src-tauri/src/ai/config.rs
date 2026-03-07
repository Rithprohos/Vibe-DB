use super::DefaultAiProviderConfig;

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

/// Timeout for ping/test requests (seconds)
pub const AI_PING_TIMEOUT_SECS: u64 = 12;

/// Timeout for SQL generation requests (seconds)
pub const AI_GENERATION_TIMEOUT_SECS: u64 = 45;

/// Get the default AI provider configuration
pub fn get_default_config() -> DefaultAiProviderConfig {
    DefaultAiProviderConfig {
        provider: DEFAULT_AI_PROVIDER.to_string(),
        base_url: DEFAULT_AI_BASE_URL.to_string(),
        model: DEFAULT_AI_MODEL.to_string(),
        has_embedded_api_key: !DEFAULT_AI_API_KEY.trim().is_empty(),
    }
}

/// Resolve the default API key from environment if enabled
pub fn resolve_default_api_key(use_default: bool) -> Option<&'static str> {
    let trimmed = DEFAULT_AI_API_KEY.trim();
    if use_default && !trimmed.is_empty() {
        Some(trimmed)
    } else {
        None
    }
}

/// Trim trailing slashes from a URL
pub fn trim_trailing_slashes(value: &str) -> &str {
    value.trim_end_matches('/')
}
