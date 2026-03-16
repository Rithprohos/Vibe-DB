use crate::sql_helpers::RowDataInput;
use crate::transfer::TransferError;
use csv::{ReaderBuilder, Trim, WriterBuilder};
use serde_json::{Map, Value};
use std::collections::HashSet;

pub fn serialize_rows(columns: &[String], rows: &[Vec<Value>]) -> Result<String, TransferError> {
    let mut writer = WriterBuilder::new().from_writer(Vec::new());
    writer.write_record(columns)?;

    for row in rows {
        let record = row.iter().map(csv_field_from_value);
        writer.write_record(record)?;
    }

    let bytes = writer
        .into_inner()
        .map_err(|error| TransferError::Io(error.into_error()))?;
    String::from_utf8(bytes).map_err(|error| TransferError::validation(error.to_string()))
}

pub fn parse_rows(contents: &str) -> Result<Vec<RowDataInput>, TransferError> {
    let mut reader = ReaderBuilder::new()
        .trim(Trim::Headers)
        .flexible(true)
        .from_reader(contents.as_bytes());
    let headers = reader.headers()?.clone();

    if headers.is_empty() {
        return Err(TransferError::validation("CSV header row is required"));
    }

    let mut normalized_headers = Vec::with_capacity(headers.len());
    let mut seen_headers = HashSet::with_capacity(headers.len());
    for header in &headers {
        let trimmed = header.trim();
        if trimmed.is_empty() {
            return Err(TransferError::validation("CSV headers cannot be empty"));
        }
        if !seen_headers.insert(trimmed.to_string()) {
            return Err(TransferError::validation(format!(
                "Duplicate CSV header: {trimmed}"
            )));
        }
        normalized_headers.push(trimmed.to_string());
    }

    let mut rows = Vec::new();
    for (index, record) in reader.records().enumerate() {
        let record = record?;
        if record.len() != normalized_headers.len() {
            return Err(TransferError::validation(format!(
                "CSV row {} has {} value(s); expected {} to match the header row",
                index + 2,
                record.len(),
                normalized_headers.len()
            )));
        }
        let mut row_data = Map::with_capacity(normalized_headers.len());

        for (header, value) in normalized_headers.iter().zip(record.iter()) {
            let parsed_value = if value.trim().is_empty() {
                Value::Null
            } else {
                Value::String(value.to_string())
            };
            row_data.insert(header.clone(), parsed_value);
        }

        rows.push(RowDataInput { row_data });
    }

    Ok(rows)
}

fn csv_field_from_value(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::Bool(boolean) => boolean.to_string(),
        Value::Number(number) => number.to_string(),
        Value::String(text) => text.clone(),
        Value::Array(_) | Value::Object(_) => value.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_rows, serialize_rows};
    use serde_json::json;

    #[test]
    fn serialize_rows_writes_header_and_values() {
        let csv = serialize_rows(
            &["id".to_string(), "name".to_string()],
            &[vec![json!(1), json!("Alice")]],
        )
        .expect("expected csv");

        assert_eq!(csv, "id,name\n1,Alice\n");
    }

    #[test]
    fn parse_rows_treats_empty_cells_as_null() {
        let rows = parse_rows("id,name\n1,\n").expect("expected rows");

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].row_data.get("name"), Some(&serde_json::Value::Null));
    }

    #[test]
    fn parse_rows_rejects_rows_with_the_wrong_number_of_values() {
        let error = parse_rows("id,name\n1,Alice,extra\n").expect_err("expected error");

        assert_eq!(
            error.to_string(),
            "CSV row 2 has 3 value(s); expected 2 to match the header row"
        );
    }

    #[test]
    fn parse_rows_rejects_duplicate_headers_after_trimming() {
        let error = parse_rows("id, id \n1,2\n").expect_err("expected error");

        assert_eq!(error.to_string(), "Duplicate CSV header: id");
    }
}
