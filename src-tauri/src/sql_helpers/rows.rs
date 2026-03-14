use crate::engines::ColumnInfo;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashSet};

use super::identifiers::{quote_identifier, quote_qualified_identifier, validate_table_name};
use super::values::{escape_sql_string, format_sql_value};

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
            serde_json::Value::Null => format!("{} IS NULL", quote_identifier(column_name)),
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

    let trimmed_table_name = validate_table_name(table_name)?;
    let quoted_table = quote_qualified_identifier(trimmed_table_name);

    rows.iter()
        .map(|row| {
            let where_clause = build_where_clause_for_row(&row.row_data, columns)?;
            Ok(format!("DELETE FROM {} WHERE {};", quoted_table, where_clause))
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
