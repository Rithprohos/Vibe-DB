use super::identifiers::{quote_identifier, validate_identifier};

fn normalize_view_select_sql(select_sql: &str) -> Result<String, String> {
    let trimmed = select_sql.trim();
    if trimmed.is_empty() {
        return Err("View query is required".to_string());
    }

    let without_trailing_semicolon = trimmed.trim_end_matches(';').trim_end();
    if without_trailing_semicolon.is_empty() {
        return Err("View query is required".to_string());
    }

    if without_trailing_semicolon.contains(';') {
        return Err("View query must contain a single SELECT statement".to_string());
    }

    let stripped = without_trailing_semicolon
        .lines()
        .filter(|line| !line.trim_start().starts_with("--"))
        .collect::<Vec<_>>()
        .join("\n");
    let upper = stripped.trim_start().to_ascii_uppercase();
    if !(upper.starts_with("SELECT") || upper.starts_with("WITH")) {
        return Err("View query must start with SELECT or WITH".to_string());
    }

    Ok(without_trailing_semicolon.to_string())
}

/// Builds a validated CREATE VIEW SQL statement from a view name and source query.
#[tauri::command]
pub fn build_create_view_sql(
    view_name: String,
    select_sql: String,
    if_not_exists: bool,
    temporary: bool,
) -> Result<String, String> {
    let trimmed_view_name = view_name.trim();
    validate_identifier(trimmed_view_name, "View")?;
    if trimmed_view_name.to_ascii_lowercase().starts_with("sqlite_") {
        return Err("View name cannot start with 'sqlite_'".to_string());
    }

    let normalized_select_sql = normalize_view_select_sql(&select_sql)?;
    let temporary_sql = if temporary { " TEMP" } else { "" };
    let if_not_exists_sql = if if_not_exists { " IF NOT EXISTS" } else { "" };

    Ok(format!(
        "CREATE{temporary_sql} VIEW{if_not_exists_sql} {} AS\n{};",
        quote_identifier(trimmed_view_name),
        normalized_select_sql
    ))
}
