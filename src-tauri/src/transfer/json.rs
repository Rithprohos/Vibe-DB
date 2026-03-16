use crate::sql_helpers::RowDataInput;
use crate::transfer::TransferError;
use serde_json::{Map, Value};
use std::collections::HashSet;

pub fn serialize_rows(columns: &[String], rows: &[Vec<Value>]) -> Result<String, TransferError> {
    let mut items = Vec::with_capacity(rows.len());

    for row in rows {
        let mut item = Map::with_capacity(columns.len());
        for (column, value) in columns.iter().zip(row.iter()) {
            item.insert(column.clone(), value.clone());
        }
        items.push(Value::Object(item));
    }

    serde_json::to_string_pretty(&items).map_err(TransferError::from)
}

pub fn parse_rows(contents: &str) -> Result<Vec<RowDataInput>, TransferError> {
    let value: Value = serde_json::from_str(contents)?;
    let items = match value {
        Value::Array(items) => items,
        _ => {
            return Err(TransferError::validation(
                "JSON import expects an array of objects",
            ));
        }
    };

    let mut rows = Vec::with_capacity(items.len());
    for item in items {
        let object = match item {
            Value::Object(object) => object,
            _ => {
                return Err(TransferError::validation(
                    "JSON import expects every array item to be an object",
                ));
            }
        };

        let mut normalized = Map::with_capacity(object.len());
        let mut seen_keys = HashSet::with_capacity(object.len());
        for (key, value) in object {
            let trimmed = key.trim();
            if trimmed.is_empty() {
                return Err(TransferError::validation(
                    "JSON object keys cannot be empty",
                ));
            }
            if !seen_keys.insert(trimmed.to_string()) {
                return Err(TransferError::validation(format!(
                    "Duplicate JSON key after trimming: {trimmed}"
                )));
            }
            normalized.insert(trimmed.to_string(), value);
        }

        rows.push(RowDataInput {
            row_data: normalized,
        });
    }

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::parse_rows;

    #[test]
    fn parse_rows_rejects_non_array_payload() {
        let error = parse_rows("{\"id\":1}").expect_err("expected error");

        assert_eq!(error.to_string(), "JSON import expects an array of objects");
    }
}
