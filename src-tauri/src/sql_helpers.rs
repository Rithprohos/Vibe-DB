use crate::engines::{ColumnInfo, QueryResult};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::collections::HashSet;

/// Input for identifying a row to delete.
/// The row_data map contains column names and their values.
/// For tables with primary keys, only PK columns are needed.
/// For tables without PKs, all column values are used to identify the row.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowIdentifierInput {
    /// Column name to value mapping for row identification
    pub row_data: serde_json::Map<String, serde_json::Value>,
}

/// Input for inserting a new row.
/// The row_data map contains column names and their values.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowDataInput {
    /// Column name to value mapping for the new row
    pub row_data: serde_json::Map<String, serde_json::Value>,
}

/// Input for updating a row.
/// Contains the new column values and the identifier to locate the row.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowUpdateInput {
    /// Column name to value mapping for the updated values
    pub row_data: serde_json::Map<String, serde_json::Value>,
    /// Column name to value mapping to identify the row (primary key or all columns)
    pub identifier: serde_json::Map<String, serde_json::Value>,
}

fn validate_table_name(table_name: &str) -> Result<&str, String> {
    let trimmed_table_name = table_name.trim();
    if trimmed_table_name.is_empty() {
        return Err("Table name is required".to_string());
    }
    if trimmed_table_name
        .split('.')
        .any(|part| part.trim().is_empty())
    {
        return Err("Table name contains an empty identifier segment".to_string());
    }

    Ok(trimmed_table_name)
}

fn format_sql_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::Number(number) => number.to_string(),
        serde_json::Value::Bool(boolean) => boolean.to_string(),
        serde_json::Value::String(text) => {
            format!("'{}'", escape_sql_string(text))
        }
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
            format!("'{}'", escape_sql_string(&value.to_string()))
        }
    }
}

fn normalize_insert_row(row: &RowDataInput) -> Result<(Vec<String>, Vec<String>), String> {
    if row.row_data.is_empty() {
        return Err("Row data cannot be empty".to_string());
    }

    let mut seen_columns = BTreeSet::new();
    let mut entries = Vec::with_capacity(row.row_data.len());

    for (column_name, value) in &row.row_data {
        let trimmed_column_name = column_name.trim();
        if trimmed_column_name.is_empty() {
            return Err("Column name is required".to_string());
        }
        if !seen_columns.insert(trimmed_column_name.to_string()) {
            return Err(format!("Duplicate column name: \"{trimmed_column_name}\""));
        }
        entries.push((trimmed_column_name.to_string(), format_sql_value(value)));
    }

    entries.sort_unstable_by(|left, right| left.0.cmp(&right.0));

    let columns = entries
        .iter()
        .map(|(column_name, _)| quote_identifier(column_name))
        .collect();
    let values = entries.into_iter().map(|(_, value)| value).collect();

    Ok((columns, values))
}

fn build_insert_statement(
    quoted_table: &str,
    columns: &[String],
    row_values: &[Vec<String>],
) -> String {
    let values_sql = row_values
        .iter()
        .map(|values| format!("({})", values.join(", ")))
        .collect::<Vec<_>>()
        .join(", ");

    format!(
        "INSERT INTO {} ({}) VALUES {};",
        quoted_table,
        columns.join(", "),
        values_sql
    )
}

/// Builds an INSERT query for a single row.
/// Returns the INSERT SQL statement.
#[cfg(test)]
pub fn build_insert_query(table_name: &str, row: &RowDataInput) -> Result<String, String> {
    let trimmed_table_name = validate_table_name(table_name)?;
    let quoted_table = quote_qualified_identifier(trimmed_table_name);
    let (columns, values) = normalize_insert_row(row)?;

    Ok(format!(
        "INSERT INTO {} ({}) VALUES ({});",
        quoted_table,
        columns.join(", "),
        values.join(", ")
    ))
}

/// Builds INSERT queries for multiple rows.
/// Returns a vector of INSERT SQL statements.
pub fn build_insert_queries(
    table_name: &str,
    rows: &[RowDataInput],
) -> Result<Vec<String>, String> {
    if rows.is_empty() {
        return Err("No rows provided for insertion".to_string());
    }

    let trimmed_table_name = validate_table_name(table_name)?;
    let quoted_table = quote_qualified_identifier(trimmed_table_name);
    let mut queries = Vec::new();
    let mut current_columns: Option<Vec<String>> = None;
    let mut current_values: Vec<Vec<String>> = Vec::new();

    for row in rows {
        let (columns, values) = normalize_insert_row(row)?;

        match &current_columns {
            Some(existing_columns) if *existing_columns == columns => {
                current_values.push(values);
            }
            Some(existing_columns) => {
                queries.push(build_insert_statement(
                    &quoted_table,
                    existing_columns,
                    &current_values,
                ));
                current_columns = Some(columns);
                current_values = vec![values];
            }
            None => {
                current_columns = Some(columns);
                current_values.push(values);
            }
        }
    }

    if let Some(columns) = current_columns {
        queries.push(build_insert_statement(
            &quoted_table,
            &columns,
            &current_values,
        ));
    }

    Ok(queries)
}

/// Builds a WHERE clause for a single row using primary keys if available,
/// otherwise falls back to matching all columns.
pub fn build_where_clause_for_row(
    row: &serde_json::Map<String, serde_json::Value>,
    columns: &[ColumnInfo],
) -> Result<String, String> {
    let pk_columns: Vec<&ColumnInfo> = columns.iter().filter(|column| column.pk).collect();
    let columns_to_use: Vec<&ColumnInfo> = if pk_columns.is_empty() {
        columns.iter().collect()
    } else {
        pk_columns
    };
    if columns_to_use.is_empty() {
        return Err("No columns available to identify row".to_string());
    }

    let mut conditions = Vec::new();
    for column in &columns_to_use {
        let column_name = column.name.as_str();
        let value = row
            .get(column_name)
            .ok_or_else(|| format!("Missing required column '{column_name}' in row identifier"))?;

        let condition = match value {
            serde_json::Value::Null => {
                format!("{} IS NULL", quote_identifier(column_name))
            }
            serde_json::Value::Number(number) => {
                format!("{} = {}", quote_identifier(column_name), number)
            }
            serde_json::Value::Bool(boolean) => {
                format!("{} = {}", quote_identifier(column_name), boolean)
            }
            serde_json::Value::String(text) => {
                format!(
                    "{} = '{}'",
                    quote_identifier(column_name),
                    escape_sql_string(text)
                )
            }
            _ => {
                return Err(format!(
                    "Unsupported value type for column '{}' in row identifier",
                    column_name
                ));
            }
        };
        conditions.push(condition);
    }

    Ok(conditions.join(" AND "))
}

/// Builds DELETE queries for selected rows.
/// Returns a vector of DELETE SQL statements.
pub fn build_delete_queries(
    table_name: &str,
    rows: &[RowIdentifierInput],
    columns: &[ColumnInfo],
) -> Result<Vec<String>, String> {
    if rows.is_empty() {
        return Err("No rows provided for deletion".to_string());
    }

    let trimmed_table_name = table_name.trim();
    if trimmed_table_name.is_empty() {
        return Err("Table name is required".to_string());
    }
    if trimmed_table_name
        .split('.')
        .any(|part| part.trim().is_empty())
    {
        return Err("Table name contains an empty identifier segment".to_string());
    }

    let quoted_table = quote_qualified_identifier(trimmed_table_name);

    rows.iter()
        .map(|row| {
            let where_clause = build_where_clause_for_row(&row.row_data, columns)?;
            Ok(format!(
                "DELETE FROM {} WHERE {};",
                quoted_table, where_clause
            ))
        })
        .collect()
}

fn normalize_update_row(
    row: &RowUpdateInput,
    columns: &[ColumnInfo],
) -> Result<Vec<String>, String> {
    if row.row_data.is_empty() {
        return Err("No columns to update".to_string());
    }

    let valid_columns: HashSet<&str> = columns.iter().map(|column| column.name.as_str()).collect();
    let mut seen_columns = BTreeSet::new();
    let mut assignments = Vec::with_capacity(row.row_data.len());

    for (column_name, value) in &row.row_data {
        let trimmed_column_name = column_name.trim();
        if trimmed_column_name.is_empty() {
            return Err("Column name is required".to_string());
        }
        if !valid_columns.contains(trimmed_column_name) {
            return Err(format!("Unknown column '{trimmed_column_name}'"));
        }
        if !seen_columns.insert(trimmed_column_name.to_string()) {
            return Err(format!("Duplicate column name: \"{trimmed_column_name}\""));
        }

        assignments.push(format!(
            "{} = {}",
            quote_identifier(trimmed_column_name),
            format_sql_value(value)
        ));
    }

    assignments.sort_unstable();
    Ok(assignments)
}

/// Builds UPDATE queries for selected rows.
/// Returns a vector of UPDATE SQL statements.
pub fn build_update_queries(
    table_name: &str,
    rows: &[RowUpdateInput],
    columns: &[ColumnInfo],
) -> Result<Vec<String>, String> {
    if rows.is_empty() {
        return Err("No rows provided for update".to_string());
    }

    let trimmed_table_name = validate_table_name(table_name)?;
    let quoted_table = quote_qualified_identifier(trimmed_table_name);

    rows.iter()
        .map(|row| {
            let set_clauses = normalize_update_row(row, columns)?;
            let where_clause = build_where_clause_for_row(&row.identifier, columns)?;

            Ok(format!(
                "UPDATE {} SET {} WHERE {};",
                quoted_table,
                set_clauses.join(", "),
                where_clause
            ))
        })
        .collect()
}

#[derive(Debug, Clone, Copy, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TypeParams {
    #[serde(default)]
    length: Option<u32>,
    #[serde(default)]
    precision: Option<i32>,
    #[serde(default)]
    scale: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTableColumnInput {
    name: String,
    #[serde(rename = "type")]
    col_type: String,
    #[serde(default)]
    type_params: Option<TypeParams>,
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CreateTableDialect {
    Sqlite,
    Turso,
    Postgres,
}

impl CreateTableDialect {
    fn parse(engine_type: Option<&str>) -> Result<Self, String> {
        match engine_type
            .unwrap_or("sqlite")
            .trim()
            .to_ascii_lowercase()
            .as_str()
        {
            "sqlite" => Ok(Self::Sqlite),
            "turso" => Ok(Self::Turso),
            "postgres" => Ok(Self::Postgres),
            other => Err(format!(
                "Unsupported database engine for CREATE TABLE: {other}"
            )),
        }
    }

    fn rejects_sqlite_reserved_prefix(self) -> bool {
        matches!(self, Self::Sqlite | Self::Turso)
    }
}

pub fn quote_identifier(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('\"', "\"\""))
}

pub fn quote_qualified_identifier(identifier: &str) -> String {
    identifier
        .split('.')
        .map(str::trim)
        .map(quote_identifier)
        .collect::<Vec<_>>()
        .join(".")
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
    engine_type: Option<String>,
) -> Result<String, String> {
    let dialect = CreateTableDialect::parse(engine_type.as_deref())?;
    let trimmed_table_name = table_name.trim();
    validate_identifier(trimmed_table_name, "Table")?;

    if dialect.rejects_sqlite_reserved_prefix() {
        if trimmed_table_name
            .to_ascii_lowercase()
            .starts_with("sqlite_")
        {
            return Err("Table name cannot start with 'sqlite_'".to_string());
        }
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

            let column_type = column.col_type.trim();
            validate_type_params(column_type, column.type_params.as_ref())?;

            match dialect {
                CreateTableDialect::Postgres => {
                    let serial_type = column
                        .auto_increment
                        .then(|| postgres_serial_type(column_type))
                        .flatten();
                    let formatted_type = if let Some(st) = serial_type {
                        st.to_string()
                    } else {
                        format_column_type(column_type, column.type_params.as_ref())
                    };
                    parts.push(formatted_type);
                    if column.primary_key {
                        parts.push("PRIMARY KEY".to_string());
                    }
                }
                CreateTableDialect::Sqlite | CreateTableDialect::Turso => {
                    let formatted_type =
                        format_column_type(column_type, column.type_params.as_ref());
                    parts.push(formatted_type);
                    if column.primary_key {
                        parts.push("PRIMARY KEY".to_string());
                    }
                    if sqlite_auto_increment(column_type, column.primary_key, column.auto_increment)
                    {
                        parts.push("AUTOINCREMENT".to_string());
                    }
                }
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

            Ok(format!("  {}", parts.join(" ")))
        })
        .collect::<Result<Vec<_>, String>>()?;

    let if_not_exists_sql = if if_not_exists { " IF NOT EXISTS" } else { "" };

    Ok(format!(
        "CREATE TABLE{if_not_exists_sql} {} (\n{}\n);",
        quote_identifier(trimmed_table_name),
        column_defs.join(",\n")
    ))
}

fn sqlite_auto_increment(column_type: &str, is_primary_key: bool, auto_increment: bool) -> bool {
    auto_increment && is_primary_key && column_type.eq_ignore_ascii_case("INTEGER")
}

fn postgres_serial_type(column_type: &str) -> Option<&'static str> {
    if column_type.eq_ignore_ascii_case("SMALLINT")
        || column_type.eq_ignore_ascii_case("SMALLSERIAL")
    {
        Some("SMALLSERIAL")
    } else if column_type.eq_ignore_ascii_case("INTEGER")
        || column_type.eq_ignore_ascii_case("INT")
        || column_type.eq_ignore_ascii_case("SERIAL")
    {
        Some("SERIAL")
    } else if column_type.eq_ignore_ascii_case("BIGINT")
        || column_type.eq_ignore_ascii_case("BIGSERIAL")
    {
        Some("BIGSERIAL")
    } else {
        None
    }
}

fn validate_type_params(column_type: &str, type_params: Option<&TypeParams>) -> Result<(), String> {
    let type_upper = column_type.to_ascii_uppercase();
    let Some(params) = type_params else {
        return Ok(());
    };

    if matches!(type_upper.as_str(), "VARCHAR" | "CHAR" | "BPCHAR") {
        if let Some(length) = params.length {
            if length == 0 {
                return Err("Length must be at least 1".to_string());
            }
            if length > 10_485_760 {
                return Err("Length is too large".to_string());
            }
        }
        return Ok(());
    }

    if matches!(type_upper.as_str(), "NUMERIC" | "DECIMAL") {
        if let Some(precision) = params.precision {
            if precision < 1 {
                return Err("Precision must be at least 1".to_string());
            }
            if precision > 1000 {
                return Err("Precision is too large".to_string());
            }
        }

        if let Some(scale) = params.scale {
            if scale < 0 {
                return Err("Scale cannot be negative".to_string());
            }
            if let Some(precision) = params.precision {
                if scale > precision {
                    return Err("Scale cannot exceed precision".to_string());
                }
            }
        }
        return Ok(());
    }

    if matches!(
        type_upper.as_str(),
        "TIME" | "TIMETZ" | "TIMESTAMP" | "TIMESTAMPTZ" | "INTERVAL"
    ) {
        if let Some(precision) = params.precision {
            if precision < 0 {
                return Err("Precision cannot be negative".to_string());
            }
            if precision > 6 {
                return Err("Precision cannot exceed 6".to_string());
            }
        }
    }

    Ok(())
}

/// Format a column type with its parameters (VARCHAR(n), NUMERIC(p,s), etc.)
fn format_column_type(column_type: &str, type_params: Option<&TypeParams>) -> String {
    let type_upper = column_type.to_ascii_uppercase();
    let params = match type_params {
        Some(p) => p,
        None => return column_type.to_string(),
    };

    // Types that support length parameter (VARCHAR, CHAR, BPCHAR)
    let supports_length = matches!(type_upper.as_str(), "VARCHAR" | "CHAR" | "BPCHAR");
    if supports_length {
        if let Some(length) = params.length {
            if length > 0 {
                return format!("{}({})", column_type, length);
            }
        }
    }

    // Types that support precision/scale (NUMERIC, DECIMAL)
    let supports_precision_scale = matches!(type_upper.as_str(), "NUMERIC" | "DECIMAL");
    if supports_precision_scale {
        if let Some(precision) = params.precision {
            if precision > 0 {
                if let Some(scale) = params.scale {
                    if scale >= 0 {
                        return format!("{}({},{})", column_type, precision, scale);
                    }
                }
                return format!("{}({})", column_type, precision);
            }
        }
    }

    // Types that support precision only (TIME, TIMETZ, TIMESTAMP, TIMESTAMPTZ, INTERVAL)
    let supports_precision = matches!(
        type_upper.as_str(),
        "TIME" | "TIMETZ" | "TIMESTAMP" | "TIMESTAMPTZ" | "INTERVAL"
    );
    if supports_precision {
        if let Some(precision) = params.precision {
            if precision >= 0 {
                return format!("{}({})", column_type, precision);
            }
        }
    }

    column_type.to_string()
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
mod tests;
