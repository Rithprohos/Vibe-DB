use super::{EngineError, EngineResult};

const TAUTOLOGY_PATTERNS: [&str; 16] = [
    "WHERE 1=1",
    "WHERE 1 = 1",
    "WHERE '1'='1'",
    "WHERE '1' = '1'",
    "WHERE TRUE",
    "WHERE (1=1)",
    "WHERE (1 = 1)",
    "WHERE 0=0",
    "WHERE 0 = 0",
    "WHERE 'A'='A'",
    "WHERE 'A' = 'A'",
    "WHERE 1<>0",
    "WHERE 1 <> 0",
    "WHERE 1!=0",
    "WHERE 1 != 0",
    "WHERE NOT FALSE",
];

const OR_TAUTOLOGY_PATTERNS: [&str; 4] = ["OR 1=1", "OR 1 = 1", "OR '1'='1'", "OR TRUE"];

pub(crate) fn validate_query_safety(query: &str) -> EngineResult<()> {
    let stripped = query
        .lines()
        .filter(|line| !line.trim().starts_with("--"))
        .collect::<Vec<_>>()
        .join(" ");

    let upper = stripped.to_uppercase();
    let upper = upper.trim();

    let is_dangerous = upper.starts_with("DELETE")
        || upper.starts_with("UPDATE")
        || upper.starts_with("DROP")
        || upper.starts_with("TRUNCATE");

    if !is_dangerous {
        return Ok(());
    }

    if detect_tautology(upper) {
        return Err(EngineError::QueryError(
            "Unsafe query blocked: WHERE clause with tautology detected (e.g., 'WHERE 1=1'). \
             This would affect all rows. Add an explicit LIMIT or use a specific WHERE condition."
                .to_string(),
        ));
    }

    if upper.starts_with("DELETE") && !upper.contains("WHERE") {
        return Err(EngineError::QueryError(
            "Unsafe query blocked: DELETE without WHERE clause would delete all rows. \
             Add a WHERE clause to specify which rows to delete."
                .to_string(),
        ));
    }

    if upper.starts_with("UPDATE") && !upper.contains("WHERE") {
        return Err(EngineError::QueryError(
            "Unsafe query blocked: UPDATE without WHERE clause would update all rows. \
             Add a WHERE clause to specify which rows to update."
                .to_string(),
        ));
    }

    Ok(())
}

fn detect_tautology(upper_query: &str) -> bool {
    let query_normalized = upper_query
        .replace("(", " ")
        .replace(")", " ")
        .replace("  ", " ");

    for pattern in TAUTOLOGY_PATTERNS {
        let pattern_normalized = pattern.to_uppercase().replace("  ", " ");
        if query_normalized.contains(&pattern_normalized) {
            return true;
        }
    }

    OR_TAUTOLOGY_PATTERNS
        .iter()
        .any(|pattern| query_normalized.contains(pattern))
}
