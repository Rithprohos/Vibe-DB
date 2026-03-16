use crate::sql_helpers::{RowDataInput, build_insert_queries};
use crate::transfer::TransferError;
use serde_json::{Map, Value};

pub fn serialize_rows(
    table_name: &str,
    columns: &[String],
    rows: &[Vec<Value>],
) -> Result<String, TransferError> {
    if rows.is_empty() {
        return Ok(format!("-- No rows exported from {table_name}\n"));
    }

    let row_inputs = rows
        .iter()
        .map(|row| {
            let mut row_data = Map::with_capacity(columns.len());
            for (column, value) in columns.iter().zip(row.iter()) {
                row_data.insert(column.clone(), value.clone());
            }
            RowDataInput { row_data }
        })
        .collect::<Vec<_>>();

    let queries =
        build_insert_queries(table_name, &row_inputs).map_err(TransferError::validation)?;
    Ok(queries.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::serialize_rows;
    use serde_json::json;

    #[test]
    fn serialize_rows_returns_comment_for_empty_exports() {
        let sql = serialize_rows("users", &["id".to_string()], &[]).expect("expected sql");

        assert_eq!(sql, "-- No rows exported from users\n");
    }

    #[test]
    fn serialize_rows_generates_insert_statements() {
        let sql = serialize_rows(
            "users",
            &["id".to_string(), "name".to_string()],
            &[vec![json!(1), json!("Alice")]],
        )
        .expect("expected sql");

        assert!(sql.starts_with("INSERT INTO"));
    }
}
