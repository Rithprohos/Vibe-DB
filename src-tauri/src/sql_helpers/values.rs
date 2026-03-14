use serde_json::Value;

pub(crate) fn escape_sql_string(value: &str) -> String {
    value.replace('\'', "''")
}

pub(crate) fn is_numeric_column(col_type: &str) -> bool {
    let lowered = col_type.to_ascii_lowercase();
    lowered.contains("int")
        || lowered.contains("real")
        || lowered.contains("double")
        || lowered.contains("float")
        || lowered.contains("numeric")
        || lowered.contains("decimal")
}

pub(crate) fn format_sql_literal(value: &str, is_numeric: bool) -> String {
    let trimmed = value.trim();
    if is_numeric && trimmed.parse::<f64>().is_ok() {
        trimmed.to_string()
    } else {
        format!("'{}'", escape_sql_string(trimmed))
    }
}

pub(crate) fn format_sql_value(value: &Value) -> String {
    match value {
        Value::Null => "NULL".to_string(),
        Value::Number(number) => number.to_string(),
        Value::Bool(boolean) => boolean.to_string(),
        Value::String(text) => format!("'{}'", escape_sql_string(text)),
        Value::Array(_) | Value::Object(_) => {
            format!("'{}'", escape_sql_string(&value.to_string()))
        }
    }
}
