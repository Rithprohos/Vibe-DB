use crate::engines::{ColumnInfo, DatabaseEngine};
use crate::sql_helpers::{RowDataInput, build_insert_queries};
use crate::transfer::csv;
use crate::transfer::json;
use crate::transfer::{
    ImportTableDataInput, ImportTableDataResult, TableTransferFormat, TransferError,
};
use std::collections::HashSet;
use std::fs;

pub async fn import_table_data(
    engine: &dyn DatabaseEngine,
    input: &ImportTableDataInput,
) -> Result<ImportTableDataResult, TransferError> {
    let table_name = input.table_name.trim();
    let source_path = input.source_path.trim();

    if table_name.is_empty() {
        return Err(TransferError::validation("Table name is required"));
    }
    if source_path.is_empty() {
        return Err(TransferError::validation("Source path is required"));
    }

    let contents = fs::read_to_string(source_path)?;
    let structure = engine
        .get_table_structure(table_name)
        .await
        .map_err(|error| TransferError::Query(error.to_string()))?;
    let rows = match input.format {
        TableTransferFormat::Csv => csv::parse_rows(&contents)?,
        TableTransferFormat::Json => json::parse_rows(&contents)?,
        TableTransferFormat::Sql => {
            return Err(TransferError::validation(
                "SQL import is planned for v2. Use CSV or JSON for now.",
            ));
        }
    };
    let rows = exclude_columns(rows, &input.exclude_columns);

    validate_rows(&rows, &structure.columns)?;

    let queries = build_insert_queries(table_name, &rows).map_err(TransferError::validation)?;
    let sql = queries.join("\n");
    let result = engine
        .execute_transaction(&queries)
        .await
        .map_err(|error| TransferError::Query(error.to_string()))?;

    Ok(ImportTableDataResult {
        rows_imported: result.rows_affected as usize,
        message: format!(
            "Imported {} row(s) into {}",
            result.rows_affected, table_name
        ),
        sql,
    })
}

fn exclude_columns(rows: Vec<RowDataInput>, excluded_columns: &[String]) -> Vec<RowDataInput> {
    if excluded_columns.is_empty() {
        return rows;
    }

    let excluded = excluded_columns
        .iter()
        .map(|column| column.trim())
        .filter(|column| !column.is_empty())
        .collect::<HashSet<_>>();

    if excluded.is_empty() {
        return rows;
    }

    rows.into_iter()
        .map(|mut row| {
            row.row_data
                .retain(|column_name, _| !excluded.contains(column_name.as_str()));
            row
        })
        .collect()
}

fn validate_rows(rows: &[RowDataInput], columns: &[ColumnInfo]) -> Result<(), TransferError> {
    if rows.is_empty() {
        return Err(TransferError::validation("No rows found to import"));
    }

    let known_columns = columns
        .iter()
        .map(|column| column.name.as_str())
        .collect::<HashSet<_>>();
    let required_columns = columns
        .iter()
        .filter(|column| column.notnull && column.dflt_value.is_none() && !column.pk)
        .map(|column| column.name.as_str())
        .collect::<HashSet<_>>();

    for (index, row) in rows.iter().enumerate() {
        if row.row_data.is_empty() {
            return Err(TransferError::validation(format!(
                "Row {} is empty",
                index + 1
            )));
        }

        for column_name in row.row_data.keys() {
            if !known_columns.contains(column_name.as_str()) {
                return Err(TransferError::validation(format!(
                    "Row {} contains an unknown column: {}",
                    index + 1,
                    column_name
                )));
            }
        }

        for required_column in &required_columns {
            match row.row_data.get(*required_column) {
                Some(value) if !value.is_null() => {}
                _ => {
                    return Err(TransferError::validation(format!(
                        "Row {} is missing a required value for column: {}",
                        index + 1,
                        required_column
                    )));
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{exclude_columns, validate_rows};
    use crate::engines::ColumnInfo;
    use crate::sql_helpers::RowDataInput;
    use serde_json::{Map, Value};

    fn column(name: &str, notnull: bool, default: Option<&str>, pk: bool) -> ColumnInfo {
        ColumnInfo {
            cid: 0,
            name: name.to_string(),
            col_type: "TEXT".to_string(),
            enum_values: None,
            notnull,
            dflt_value: default.map(str::to_string),
            pk,
        }
    }

    #[test]
    fn validate_rows_rejects_unknown_columns() {
        let mut row_data = Map::new();
        row_data.insert("unknown".to_string(), Value::String("x".to_string()));
        let rows = vec![RowDataInput { row_data }];

        let error = validate_rows(&rows, &[column("name", false, None, false)])
            .expect_err("expected error");

        assert_eq!(
            error.to_string(),
            "Row 1 contains an unknown column: unknown"
        );
    }

    #[test]
    fn validate_rows_requires_non_nullable_columns_without_defaults() {
        let mut row_data = Map::new();
        row_data.insert("name".to_string(), Value::Null);
        let rows = vec![RowDataInput { row_data }];

        let error =
            validate_rows(&rows, &[column("name", true, None, false)]).expect_err("expected error");

        assert_eq!(
            error.to_string(),
            "Row 1 is missing a required value for column: name"
        );
    }

    #[test]
    fn exclude_columns_removes_matching_fields_before_insert() {
        let mut row_data = Map::new();
        row_data.insert("id".to_string(), Value::from(1));
        row_data.insert("name".to_string(), Value::String("Alice".to_string()));
        let rows = vec![RowDataInput { row_data }];

        let next_rows = exclude_columns(rows, &["id".to_string()]);

        assert_eq!(next_rows[0].row_data.get("id"), None);
        assert_eq!(
            next_rows[0].row_data.get("name"),
            Some(&Value::String("Alice".to_string()))
        );
    }
}
