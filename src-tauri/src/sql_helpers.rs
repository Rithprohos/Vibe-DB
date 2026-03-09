use crate::engines::{ColumnInfo, QueryResult};
use serde::Deserialize;
use std::collections::HashSet;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTableColumnInput {
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
pub struct FilterConditionInput {
    field: String,
    operator: String,
    #[serde(default)]
    value: String,
    #[serde(default)]
    value_to: String,
}

pub fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('\"', "\"\""))
}

pub fn validate_identifier(name: &str, label: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(format!("{label} name is required"));
    }

    let mut chars = trimmed.chars();
    let Some(first) = chars.next() else {
        return Err(format!("{label} name is required"));
    };
    if !(first.is_ascii_alphabetic() || first == '_') {
        return Err(format!(
            "{label} name must start with a letter or underscore and contain only letters, numbers, and underscores"
        ));
    }
    if !chars.all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err(format!(
            "{label} name must start with a letter or underscore and contain only letters, numbers, and underscores"
        ));
    }

    Ok(())
}

pub fn normalize_order_dir(order_dir: Option<String>) -> &'static str {
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

pub fn build_where_clause(
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
            .find(|column| column.name == field)
            .map(|column| is_numeric_column(&column.col_type))
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

pub fn extract_count(result: &QueryResult) -> Result<i64, String> {
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
pub fn build_create_table_sql(
    table_name: String,
    columns: Vec<CreateTableColumnInput>,
    if_not_exists: bool,
) -> Result<String, String> {
    let trimmed_table_name = table_name.trim();
    validate_identifier(trimmed_table_name, "Table")?;
    if trimmed_table_name
        .to_ascii_lowercase()
        .starts_with("sqlite_")
    {
        return Err("Table name cannot start with 'sqlite_'".to_string());
    }

    let valid_columns: Vec<_> = columns
        .into_iter()
        .filter(|column| !column.name.trim().is_empty())
        .collect();
    if valid_columns.is_empty() {
        return Err("At least one column with a name is required".to_string());
    }

    let mut seen_names = HashSet::new();
    for column in &valid_columns {
        validate_identifier(column.name.trim(), "Column")?;
        let normalized = column.name.trim().to_ascii_lowercase();
        if !seen_names.insert(normalized.clone()) {
            return Err(format!("Duplicate column name: \"{normalized}\""));
        }
    }

    let column_defs: Vec<String> = valid_columns
        .iter()
        .map(|column| {
            let mut parts = Vec::new();
            parts.push(quote_identifier(column.name.trim()));
            parts.push(column.col_type.trim().to_string());

            if column.primary_key {
                parts.push("PRIMARY KEY".to_string());
            }
            if column.auto_increment
                && column.primary_key
                && column.col_type.trim().eq_ignore_ascii_case("INTEGER")
            {
                parts.push("AUTOINCREMENT".to_string());
            }
            if column.not_null && !column.primary_key {
                parts.push("NOT NULL".to_string());
            }
            if column.unique && !column.primary_key {
                parts.push("UNIQUE".to_string());
            }

            let default_val = if column.default_option == "custom" {
                column.default_value.trim()
            } else {
                column.default_option.trim()
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
    if trimmed_view_name
        .to_ascii_lowercase()
        .starts_with("sqlite_")
    {
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

fn escape_sql_string(value: &str) -> String {
    value.replace('\'', "''")
}

fn is_numeric_column(col_type: &str) -> bool {
    let lowered = col_type.to_ascii_lowercase();
    lowered.contains("int")
        || lowered.contains("real")
        || lowered.contains("double")
        || lowered.contains("float")
        || lowered.contains("numeric")
        || lowered.contains("decimal")
}

fn format_sql_literal(value: &str, is_numeric: bool) -> String {
    let trimmed = value.trim();
    if is_numeric && trimmed.parse::<f64>().is_ok() {
        trimmed.to_string()
    } else {
        format!("'{}'", escape_sql_string(trimmed))
    }
}

#[cfg(test)]
mod tests {
    use super::build_create_view_sql;

    #[test]
    fn build_create_view_sql_basic() {
        let sql = build_create_view_sql(
            "active_users".to_string(),
            "SELECT * FROM users".to_string(),
            false,
            false,
        )
        .expect("expected SQL");

        assert_eq!(sql, "CREATE VIEW \"active_users\" AS\nSELECT * FROM users;");
    }

    #[test]
    fn build_create_view_sql_temp_if_not_exists() {
        let sql = build_create_view_sql(
            "recent_orders".to_string(),
            "WITH latest AS (SELECT * FROM orders) SELECT * FROM latest".to_string(),
            true,
            true,
        )
        .expect("expected SQL");

        assert_eq!(
            sql,
            "CREATE TEMP VIEW IF NOT EXISTS \"recent_orders\" AS\nWITH latest AS (SELECT * FROM orders) SELECT * FROM latest;"
        );
    }

    #[test]
    fn build_create_view_sql_rejects_bad_identifier() {
        let error = build_create_view_sql(
            "123_invalid".to_string(),
            "SELECT 1".to_string(),
            false,
            false,
        )
        .expect_err("expected validation error");

        assert!(error.contains("View name must start with a letter or underscore"));
    }

    #[test]
    fn build_create_view_sql_rejects_sqlite_prefix() {
        let error = build_create_view_sql(
            "sqlite_my_view".to_string(),
            "SELECT 1".to_string(),
            false,
            false,
        )
        .expect_err("expected sqlite_ prefix error");

        assert_eq!(error, "View name cannot start with 'sqlite_'");
    }

    #[test]
    fn build_create_view_sql_rejects_empty_query() {
        let error = build_create_view_sql("my_view".to_string(), "   ".to_string(), false, false)
            .expect_err("expected empty query error");

        assert_eq!(error, "View query is required");
    }

    #[test]
    fn build_create_view_sql_rejects_non_select_query() {
        let error = build_create_view_sql(
            "my_view".to_string(),
            "UPDATE users SET name = 'x'".to_string(),
            false,
            false,
        )
        .expect_err("expected non-select error");

        assert_eq!(error, "View query must start with SELECT or WITH");
    }

    #[test]
    fn build_create_view_sql_rejects_multi_statement_query() {
        let error = build_create_view_sql(
            "my_view".to_string(),
            "SELECT * FROM users; SELECT * FROM orders".to_string(),
            false,
            false,
        )
        .expect_err("expected single statement error");

        assert_eq!(error, "View query must contain a single SELECT statement");
    }
}
