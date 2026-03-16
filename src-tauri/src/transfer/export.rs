use crate::engines::{ColumnInfo, DatabaseEngine};
use crate::sql_helpers::{
    build_where_clause, normalize_order_dir, quote_identifier, quote_qualified_identifier,
};
use crate::transfer::csv;
use crate::transfer::json;
use crate::transfer::sql;
use crate::transfer::{
    ExportTableDataInput, ExportTableDataResult, TableTransferFormat, TransferError,
};
use std::collections::HashSet;
use std::fs;

pub async fn export_table_data(
    engine: &dyn DatabaseEngine,
    input: &ExportTableDataInput,
) -> Result<ExportTableDataResult, TransferError> {
    let table_name = input.table_name.trim();
    let destination_path = input.destination_path.trim();

    if table_name.is_empty() {
        return Err(TransferError::validation("Table name is required"));
    }
    if destination_path.is_empty() {
        return Err(TransferError::validation("Destination path is required"));
    }

    let structure = engine
        .get_table_structure(table_name)
        .await
        .map_err(|error| TransferError::Query(error.to_string()))?;
    let sql_query = build_export_query(
        table_name,
        &structure.columns,
        &input.filters,
        input.sort_col.as_deref(),
        input.sort_dir.as_deref(),
    )?;
    let result = engine
        .execute_query(&sql_query)
        .await
        .map_err(|error| TransferError::Query(error.to_string()))?;

    let contents = match input.format {
        TableTransferFormat::Csv => csv::serialize_rows(&result.columns, &result.rows)?,
        TableTransferFormat::Json => json::serialize_rows(&result.columns, &result.rows)?,
        TableTransferFormat::Sql => sql::serialize_rows(table_name, &result.columns, &result.rows)?,
    };

    fs::write(destination_path, contents)?;

    Ok(ExportTableDataResult {
        rows_exported: result.rows.len(),
        path: destination_path.to_string(),
        message: format!("Exported {} row(s) from {}", result.rows.len(), table_name),
        sql: sql_query,
    })
}

fn build_export_query(
    table_name: &str,
    columns: &[ColumnInfo],
    filters: &[crate::sql_helpers::FilterConditionInput],
    sort_col: Option<&str>,
    sort_dir: Option<&str>,
) -> Result<String, TransferError> {
    let known_columns = columns
        .iter()
        .map(|column| column.name.as_str())
        .collect::<HashSet<_>>();
    let supported_filters = filters
        .iter()
        .filter(|filter| known_columns.contains(filter.field.trim()))
        .cloned()
        .collect::<Vec<_>>();
    let where_clause =
        build_where_clause(&supported_filters, columns).map_err(TransferError::validation)?;
    let mut query = format!("SELECT * FROM {}", quote_qualified_identifier(table_name));

    if let Some(where_sql) = where_clause {
        query.push_str(" WHERE ");
        query.push_str(&where_sql);
    }

    if let Some(order_column) = sort_col.map(str::trim).filter(|value| !value.is_empty()) {
        if known_columns.contains(order_column) {
            query.push_str(" ORDER BY ");
            query.push_str(&quote_identifier(order_column));
            query.push(' ');
            query.push_str(normalize_order_dir(sort_dir.map(str::to_string)));
        }
    }

    Ok(query)
}

#[cfg(test)]
mod tests {
    use super::build_export_query;
    use crate::engines::ColumnInfo;
    use crate::sql_helpers::FilterConditionInput;

    fn column(name: &str, col_type: &str) -> ColumnInfo {
        ColumnInfo {
            cid: 0,
            name: name.to_string(),
            col_type: col_type.to_string(),
            notnull: false,
            dflt_value: None,
            pk: false,
        }
    }

    #[test]
    fn build_export_query_applies_known_filters_and_sort() {
        let query = build_export_query(
            "public.users",
            &[column("id", "INTEGER"), column("name", "TEXT")],
            &[FilterConditionInput {
                field: "id".to_string(),
                operator: "=".to_string(),
                value: "7".to_string(),
                value_to: String::new(),
            }],
            Some("name"),
            Some("desc"),
        )
        .expect("expected query");

        assert_eq!(
            query,
            "SELECT * FROM \"public\".\"users\" WHERE \"id\" = 7 ORDER BY \"name\" DESC"
        );
    }

    #[test]
    fn build_export_query_ignores_stale_filter_and_sort_columns() {
        let query = build_export_query(
            "users",
            &[column("id", "INTEGER")],
            &[FilterConditionInput {
                field: "deleted_at".to_string(),
                operator: "IS NULL".to_string(),
                value: String::new(),
                value_to: String::new(),
            }],
            Some("name"),
            Some("DESC"),
        )
        .expect("expected query");

        assert_eq!(query, "SELECT * FROM \"users\"");
    }
}
