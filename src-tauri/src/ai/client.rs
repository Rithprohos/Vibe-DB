use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

use super::config::{
    resolve_default_api_key, trim_trailing_slashes, AI_GENERATION_TIMEOUT_SECS,
    AI_PING_TIMEOUT_SECS,
};
use super::prompts::{clean_generated_sql, SQL_QUERY_ASSISTANT};
use super::{GenerateSqlRequest, GenerateSqlResponse};

#[derive(Debug, Serialize)]
struct ChatCompletionMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    messages: Vec<ChatCompletionMessage<'a>>,
    max_tokens: u32,
    temperature: f32,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatCompletionChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionChoice {
    message: ChatCompletionMessageContent,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionMessageContent {
    content: String,
}

#[derive(Debug, Error)]
pub enum AiError {
    #[error("Base URL is required.")]
    MissingBaseUrl,
    #[error("Model is required.")]
    MissingModel,
    #[error("Prompt is required.")]
    MissingPrompt,
    #[error("Unsupported AI provider kind: {0}")]
    UnsupportedProvider(String),
    #[error("Request timed out while waiting for the AI provider.")]
    Timeout,
    #[error("Could not reach the AI provider: {0}")]
    Transport(String),
    #[error("Request failed with {status}: {body}")]
    Http { status: String, body: String },
    #[error("Failed to parse AI response: {0}")]
    ParseResponse(String),
}

/// Build the chat completions URL from base URL
fn build_chat_completions_url(base_url: &str) -> Result<String, AiError> {
    let trimmed = trim_trailing_slashes(base_url.trim());
    if trimmed.is_empty() {
        return Err(AiError::MissingBaseUrl);
    }

    if trimmed.ends_with("/chat/completions") {
        return Ok(trimmed.to_string());
    }

    if trimmed.ends_with("/v1") {
        return Ok(format!("{trimmed}/chat/completions"));
    }

    Ok(format!("{trimmed}/v1/chat/completions"))
}

/// Send a chat completion request to the AI provider
async fn send_chat_request(
    base_url: &str,
    model: &str,
    api_key: Option<&str>,
    system_prompt: &str,
    user_prompt: &str,
    timeout_secs: u64,
) -> Result<String, AiError> {
    let url = build_chat_completions_url(base_url)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| AiError::Transport(e.to_string()))?;

    let messages = vec![
        ChatCompletionMessage {
            role: "system",
            content: system_prompt,
        },
        ChatCompletionMessage {
            role: "user",
            content: user_prompt,
        },
    ];

    let request_body = ChatCompletionRequest {
        model,
        messages,
        max_tokens: 2000,
        temperature: 0.1,
        stream: false,
    };

    let mut builder = client.post(&url).json(&request_body);

    if let Some(key) = api_key {
        builder = builder.bearer_auth(key);
    }

    let response = builder.send().await.map_err(|e| {
        if e.is_timeout() {
            AiError::Timeout
        } else {
            AiError::Transport(e.to_string())
        }
    })?;

    if !response.status().is_success() {
        let status = response.status().to_string();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "No error details returned.".to_string());
        return Err(AiError::Http { status, body });
    }

    let completion: ChatCompletionResponse = response
        .json()
        .await
        .map_err(|e| AiError::ParseResponse(e.to_string()))?;

    completion
        .choices
        .first()
        .map(|c| clean_generated_sql(&c.message.content))
        .ok_or_else(|| AiError::ParseResponse("Empty response from AI".to_string()))
}

/// Generate SQL from natural language prompt
pub async fn generate_sql(request: GenerateSqlRequest) -> Result<GenerateSqlResponse, AiError> {
    let provider_kind = request.provider_kind.trim();
    if !matches!(provider_kind, "polli" | "openai") {
        return Err(AiError::UnsupportedProvider(provider_kind.to_string()));
    }

    let prompt = request.prompt.trim();
    if prompt.is_empty() {
        return Err(AiError::MissingPrompt);
    }

    let model = request.model.trim();
    if model.is_empty() {
        return Err(AiError::MissingModel);
    }

    let schema_context = super::prompts::build_schema_context(&request.schema);
    let user_prompt =
        format!("{schema_context}\nUser Request: {prompt}\n\nGenerate the SQL query:");

    // Resolve API key: use provided key, or fall back to default embedded key
    let api_key = request
        .api_key
        .as_deref()
        .filter(|k| !k.is_empty())
        .or_else(|| resolve_default_api_key(true));

    let sql = send_chat_request(
        &request.base_url,
        model,
        api_key,
        SQL_QUERY_ASSISTANT,
        &user_prompt,
        AI_GENERATION_TIMEOUT_SECS,
    )
    .await?;

    Ok(GenerateSqlResponse {
        sql,
        explanation: None,
    })
}

/// Ping/test the AI provider connectivity
pub async fn ping_provider(
    provider_kind: &str,
    base_url: &str,
    model: &str,
    api_key: Option<&str>,
) -> Result<(), AiError> {
    let provider_kind = provider_kind.trim();
    if !matches!(provider_kind, "polli" | "openai") {
        return Err(AiError::UnsupportedProvider(provider_kind.to_string()));
    }

    let model = model.trim();
    if model.is_empty() {
        return Err(AiError::MissingModel);
    }

    let url = build_chat_completions_url(base_url)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(AI_PING_TIMEOUT_SECS))
        .build()
        .map_err(|e| AiError::Transport(e.to_string()))?;

    let request_body = ChatCompletionRequest {
        model,
        messages: vec![ChatCompletionMessage {
            role: "user",
            content: "Reply with the single word pong.",
        }],
        max_tokens: 8,
        temperature: 0.0,
        stream: false,
    };

    let mut builder = client.post(&url).json(&request_body);

    if let Some(key) = api_key {
        builder = builder.bearer_auth(key);
    }

    let response = builder.send().await.map_err(|e| {
        if e.is_timeout() {
            AiError::Timeout
        } else {
            AiError::Transport(e.to_string())
        }
    })?;

    if response.status().is_success() {
        return Ok(());
    }

    let status = response.status().to_string();
    let body = response
        .text()
        .await
        .unwrap_or_else(|_| "No error details returned.".to_string());

    Err(AiError::Http { status, body })
}
