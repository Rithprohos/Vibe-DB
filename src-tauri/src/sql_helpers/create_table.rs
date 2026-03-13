use serde::Deserialize;
use std::collections::HashSet;

use super::identifiers::{quote_identifier, validate_identifier};

#[derive(Debug, Clone, Copy, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TypeParams {
    #[serde(default)]
    pub length: Option<u32>,
    #[serde(default)]
    pub precision: Option<i32>,
    #[serde(default)]
    pub scale: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTableColumnInput {
    pub name: String,
    #[serde(rename = "type")]
    pub col_type: String,
    #[serde(default)]
    pub type_params: Option<TypeParams>,
    #[serde(default)]
    pub primary_key: bool,
    #[serde(default)]
    pub auto_increment: bool,
    #[serde(default)]
    pub not_null: bool,
    #[serde(default)]
    pub unique: bool,
    #[serde(default)]
    pub default_option: String,
    #[serde(default)]
    pub default_value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKeyConstraintInput {
    pub column_name: String,
    pub referenced_table: String,
    pub referenced_column: String,
    #[serde(default)]
    pub on_delete: Option<String>,
    #[serde(default)]
    pub on_update: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckConstraintInput {
    #[serde(default)]
    pub name: String,
    pub expression: String,
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

fn format_fk_action(action: Option<&str>, prefix: &str) -> String {
    match action {
        Some(a) => {
            let formatted = match a.to_ascii_lowercase().as_str() {
                "cascade" => "CASCADE",
                "set_null" => "SET NULL",
                "set_default" => "SET DEFAULT",
                "restrict" => "RESTRICT",
                "no_action" => "NO ACTION",
                _ => return String::new(),
            };
            format!(" {prefix} {formatted}")
        }
        None => String::new(),
    }
}

/// Builds a validated CREATE TABLE SQL statement from structured column definitions.
#[tauri::command]
pub fn build_create_table_sql(
    table_name: String,
    columns: Vec<CreateTableColumnInput>,
    if_not_exists: bool,
    engine_type: Option<String>,
    foreign_keys: Option<Vec<ForeignKeyConstraintInput>>,
    check_constraints: Option<Vec<CheckConstraintInput>>,
) -> Result<String, String> {
    let foreign_keys = foreign_keys.unwrap_or_default();
    let check_constraints = check_constraints.unwrap_or_default();
    let dialect = CreateTableDialect::parse(engine_type.as_deref())?;
    let trimmed_table_name = table_name.trim();
    validate_identifier(trimmed_table_name, "Table")?;

    if dialect.rejects_sqlite_reserved_prefix()
        && trimmed_table_name.to_ascii_lowercase().starts_with("sqlite_")
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

    let mut constraint_defs: Vec<String> = Vec::new();

    for (index, fk) in foreign_keys.iter().enumerate() {
        let col_name = fk.column_name.trim();
        let ref_table = fk.referenced_table.trim();
        let ref_col = fk.referenced_column.trim();
        let has_any_value = !col_name.is_empty()
            || !ref_table.is_empty()
            || !ref_col.is_empty()
            || fk.on_delete.is_some()
            || fk.on_update.is_some();

        if !has_any_value {
            continue;
        }
        if col_name.is_empty() || ref_table.is_empty() || ref_col.is_empty() {
            return Err(format!(
                "Foreign key constraint #{} requires column, referenced table, and referenced column",
                index + 1
            ));
        }

        validate_identifier(col_name, "Foreign key column")?;
        validate_identifier(ref_table, "Referenced table")?;
        validate_identifier(ref_col, "Referenced column")?;

        let on_delete = format_fk_action(fk.on_delete.as_deref(), "ON DELETE");
        let on_update = format_fk_action(fk.on_update.as_deref(), "ON UPDATE");

        let fk_sql = format!(
            "  FOREIGN KEY ({}) REFERENCES {} ({}){}{}",
            quote_identifier(col_name),
            quote_identifier(ref_table),
            quote_identifier(ref_col),
            on_delete,
            on_update
        );
        constraint_defs.push(fk_sql);
    }

    for (index, chk) in check_constraints.iter().enumerate() {
        let name = chk.name.trim();
        let expr = chk.expression.trim();
        let has_any_value = !name.is_empty() || !expr.is_empty();
        if !has_any_value {
            continue;
        }
        if expr.is_empty() {
            return Err(format!(
                "Check constraint #{} expression is required",
                index + 1
            ));
        }

        let chk_sql = if name.is_empty() {
            format!("  CHECK ({})", expr)
        } else {
            validate_identifier(name, "Check constraint name")?;
            format!("  CONSTRAINT {} CHECK ({})", quote_identifier(name), expr)
        };
        constraint_defs.push(chk_sql);
    }

    let all_defs = column_defs
        .into_iter()
        .chain(constraint_defs)
        .collect::<Vec<_>>();

    let if_not_exists_sql = if if_not_exists { " IF NOT EXISTS" } else { "" };

    Ok(format!(
        "CREATE TABLE{if_not_exists_sql} {} (\n{}\n);",
        quote_identifier(trimmed_table_name),
        all_defs.join(",\n")
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

fn format_column_type(column_type: &str, type_params: Option<&TypeParams>) -> String {
    let type_upper = column_type.to_ascii_uppercase();
    let params = match type_params {
        Some(params) => params,
        None => return column_type.to_string(),
    };

    if matches!(type_upper.as_str(), "VARCHAR" | "CHAR" | "BPCHAR") {
        if let Some(length) = params.length {
            if length > 0 {
                return format!("{}({})", column_type, length);
            }
        }
    }

    if matches!(type_upper.as_str(), "NUMERIC" | "DECIMAL") {
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

    if matches!(
        type_upper.as_str(),
        "TIME" | "TIMETZ" | "TIMESTAMP" | "TIMESTAMPTZ" | "INTERVAL"
    ) {
        if let Some(precision) = params.precision {
            if precision >= 0 {
                return format!("{}({})", column_type, precision);
            }
        }
    }

    column_type.to_string()
}
