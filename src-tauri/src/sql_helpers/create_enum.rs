use std::collections::HashSet;

use super::identifiers::{quote_identifier, validate_identifier};

fn parse_create_enum_engine(engine_type: Option<&str>) -> Result<(), String> {
    match engine_type
        .unwrap_or("postgres")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "postgres" => Ok(()),
        other => Err(format!(
            "Unsupported database engine for CREATE ENUM: {other}"
        )),
    }
}

/// Builds a validated CREATE TYPE ... AS ENUM SQL statement.
#[tauri::command]
pub fn build_create_enum_sql(
    enum_name: String,
    values: Vec<String>,
    engine_type: Option<String>,
) -> Result<String, String> {
    parse_create_enum_engine(engine_type.as_deref())?;

    let trimmed_enum_name = enum_name.trim();
    validate_identifier(trimmed_enum_name, "Enum")?;

    if values.is_empty() {
        return Err("At least one enum value is required".to_string());
    }

    let mut normalized_values = Vec::with_capacity(values.len());
    let mut seen_values = HashSet::new();

    for (index, value) in values.iter().enumerate() {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return Err(format!("Enum value #{} is required", index + 1));
        }
        if !seen_values.insert(trimmed.to_string()) {
            return Err(format!("Duplicate enum value: \"{trimmed}\""));
        }
        normalized_values.push(trimmed.to_string());
    }

    let quoted_values = normalized_values
        .iter()
        .map(|value| format!("'{}'", value.replace('\'', "''")))
        .collect::<Vec<_>>()
        .join(", ");

    Ok(format!(
        "CREATE TYPE {} AS ENUM ({});",
        quote_identifier(trimmed_enum_name),
        quoted_values
    ))
}
