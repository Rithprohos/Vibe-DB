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

pub(crate) fn validate_table_name(table_name: &str) -> Result<&str, String> {
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
