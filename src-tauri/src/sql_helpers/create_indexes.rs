use serde::Deserialize;
use std::collections::HashSet;

use super::identifiers::{quote_identifier, validate_identifier};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIndexInput {
    pub name: String,
    pub columns: Vec<String>,
    #[serde(default)]
    pub unique: bool,
    #[serde(default)]
    pub method: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CreateIndexDialect {
    Sqlite,
    Turso,
    Postgres,
}

impl CreateIndexDialect {
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
                "Unsupported database engine for CREATE INDEX: {other}"
            )),
        }
    }

    fn rejects_sqlite_reserved_prefix(self) -> bool {
        matches!(self, Self::Sqlite | Self::Turso)
    }
}

fn has_any_index_value(index: &CreateIndexInput) -> bool {
    !index.name.trim().is_empty()
        || !index.columns.is_empty()
        || index.unique
        || index
            .method
            .as_ref()
            .is_some_and(|method| !method.trim().is_empty())
}

/// Builds validated CREATE INDEX statements for a table from structured index definitions.
#[tauri::command]
pub fn build_create_indexes_sql(
    table_name: String,
    indexes: Vec<CreateIndexInput>,
    engine_type: Option<String>,
) -> Result<Vec<String>, String> {
    let dialect = CreateIndexDialect::parse(engine_type.as_deref())?;
    let trimmed_table_name = table_name.trim();
    validate_identifier(trimmed_table_name, "Table")?;

    let mut seen_index_names = HashSet::new();
    let mut sql_statements: Vec<String> = Vec::new();

    for (index_position, index) in indexes.iter().enumerate() {
        if !has_any_index_value(index) {
            continue;
        }

        let index_name = index.name.trim();
        if index_name.is_empty() {
            return Err(format!("Index #{} name is required", index_position + 1));
        }
        validate_identifier(index_name, "Index")?;
        if dialect.rejects_sqlite_reserved_prefix()
            && index_name.to_ascii_lowercase().starts_with("sqlite_")
        {
            return Err("Index name cannot start with 'sqlite_'".to_string());
        }

        let normalized_name = index_name.to_ascii_lowercase();
        if !seen_index_names.insert(normalized_name) {
            return Err(format!("Index \"{index_name}\" already exists"));
        }

        if index.columns.is_empty() {
            return Err(format!(
                "Index #{} requires at least one column",
                index_position + 1
            ));
        }

        let mut seen_columns = HashSet::new();
        let mut quoted_columns: Vec<String> = Vec::new();
        for column_name in &index.columns {
            let trimmed_column_name = column_name.trim();
            if trimmed_column_name.is_empty() {
                return Err(format!(
                    "Index #{} has an empty column entry",
                    index_position + 1
                ));
            }
            validate_identifier(trimmed_column_name, "Index column")?;

            let normalized_column_name = trimmed_column_name.to_ascii_lowercase();
            if !seen_columns.insert(normalized_column_name) {
                return Err(format!(
                    "Index #{} has duplicate column \"{trimmed_column_name}\"",
                    index_position + 1
                ));
            }

            quoted_columns.push(quote_identifier(trimmed_column_name));
        }

        let method_sql = match index
            .method
            .as_ref()
            .map(|method| method.trim())
            .filter(|method| !method.is_empty())
        {
            Some(method) => match dialect {
                CreateIndexDialect::Postgres => {
                    validate_identifier(method, "Index method")?;
                    Some(method.to_ascii_lowercase())
                }
                CreateIndexDialect::Sqlite | CreateIndexDialect::Turso => {
                    return Err(format!(
                        "Index #{}: index method is only supported for PostgreSQL",
                        index_position + 1
                    ));
                }
            },
            None => None,
        };

        if index.unique
            && method_sql
                .as_ref()
                .is_some_and(|method| !method.eq_ignore_ascii_case("btree"))
        {
            return Err(format!(
                "Index #{}: UNIQUE indexes only support the BTREE method",
                index_position + 1
            ));
        }

        let unique_sql = if index.unique { "UNIQUE " } else { "" };
        let using_sql = method_sql
            .map(|method| format!(" USING {method}"))
            .unwrap_or_default();
        let statement = format!(
            "CREATE {unique_sql}INDEX {} ON {}{using_sql} ({});",
            quote_identifier(index_name),
            quote_identifier(trimmed_table_name),
            quoted_columns.join(", ")
        );
        sql_statements.push(statement);
    }

    Ok(sql_statements)
}
