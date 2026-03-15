use crate::engines::ConnectionTag;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum QueryExecutionSurface {
    QueryEditor,
    Guided,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QueryPolicyDecision {
    Allow,
    Blocked { statement: QueryStatementKind },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QueryStatementKind {
    Drop,
    Truncate,
    Other,
}

impl QueryStatementKind {
    fn from_keyword(keyword: &str) -> Self {
        match keyword {
            "DROP" => Self::Drop,
            "TRUNCATE" => Self::Truncate,
            _ => Self::Other,
        }
    }

    fn as_sql(self) -> &'static str {
        match self {
            Self::Drop => "DROP",
            Self::Truncate => "TRUNCATE",
            Self::Other => "SQL",
        }
    }
}

pub fn evaluate_query_policy(
    query: &str,
    connection_tag: Option<ConnectionTag>,
    surface: QueryExecutionSurface,
) -> QueryPolicyDecision {
    if connection_tag != Some(ConnectionTag::Production)
        || surface != QueryExecutionSurface::QueryEditor
    {
        return QueryPolicyDecision::Allow;
    }

    for statement in split_sql_statements(query) {
        let kind = classify_statement(statement);
        if matches!(
            kind,
            QueryStatementKind::Drop | QueryStatementKind::Truncate
        ) {
            return QueryPolicyDecision::Blocked { statement: kind };
        }
    }

    QueryPolicyDecision::Allow
}

pub fn blocked_message(statement: QueryStatementKind) -> String {
    format!(
        "Blocked on production-tagged connection: {} is disabled in the query editor.",
        statement.as_sql()
    )
}

fn classify_statement(statement: &str) -> QueryStatementKind {
    let Some(keyword) = first_keyword(statement) else {
        return QueryStatementKind::Other;
    };

    QueryStatementKind::from_keyword(keyword.as_str())
}

fn first_keyword(statement: &str) -> Option<String> {
    let keywords = extract_statement_keywords(statement);
    let first = keywords.first().cloned()?;

    if first != "WITH" {
        return Some(first);
    }

    keywords
        .into_iter()
        .skip(1)
        .find(|keyword| is_mutating_keyword(keyword.as_str()))
        .or(Some(first))
}

fn extract_statement_keywords(statement: &str) -> Vec<String> {
    let bytes = statement.as_bytes();
    let mut keywords = Vec::new();
    let mut index = 0usize;
    let mut in_single = false;
    let mut in_double = false;
    let mut in_backtick = false;
    let mut in_line_comment = false;
    let mut in_block_comment = false;

    while index < bytes.len() {
        let byte = bytes[index];
        let next_byte = bytes.get(index + 1).copied();

        if in_line_comment {
            if byte == b'\n' {
                in_line_comment = false;
            }
            index += 1;
            continue;
        }

        if in_block_comment {
            if byte == b'*' && next_byte == Some(b'/') {
                in_block_comment = false;
                index += 2;
            } else {
                index += 1;
            }
            continue;
        }

        if in_single {
            if byte == b'\'' {
                in_single = false;
            }
            index += 1;
            continue;
        }

        if in_double {
            if byte == b'"' {
                in_double = false;
            }
            index += 1;
            continue;
        }

        if in_backtick {
            if byte == b'`' {
                in_backtick = false;
            }
            index += 1;
            continue;
        }

        if byte == b'-' && next_byte == Some(b'-') {
            in_line_comment = true;
            index += 2;
            continue;
        }

        if byte == b'/' && next_byte == Some(b'*') {
            in_block_comment = true;
            index += 2;
            continue;
        }

        match byte {
            b'\'' => {
                in_single = true;
                index += 1;
                continue;
            }
            b'"' => {
                in_double = true;
                index += 1;
                continue;
            }
            b'`' => {
                in_backtick = true;
                index += 1;
                continue;
            }
            _ => {}
        }

        if !byte.is_ascii_alphabetic() {
            index += 1;
            continue;
        }

        let start = index;
        while index < bytes.len() && bytes[index].is_ascii_alphabetic() {
            index += 1;
        }

        keywords.push(statement[start..index].to_ascii_uppercase());
    }

    keywords
}

fn is_mutating_keyword(keyword: &str) -> bool {
    matches!(
        keyword,
        "ALTER" | "CREATE" | "DELETE" | "DROP" | "INSERT" | "REPLACE" | "TRUNCATE" | "UPDATE"
    )
}

fn split_sql_statements(query: &str) -> Vec<&str> {
    let mut statements = Vec::new();
    let mut start = 0usize;
    let mut chars = query.char_indices().peekable();
    let mut in_single = false;
    let mut in_double = false;
    let mut in_backtick = false;
    let mut in_line_comment = false;
    let mut in_block_comment = false;

    while let Some((idx, ch)) = chars.next() {
        if in_line_comment {
            if ch == '\n' {
                in_line_comment = false;
            }
            continue;
        }

        if in_block_comment {
            if ch == '*' && matches!(chars.peek(), Some((_, '/'))) {
                chars.next();
                in_block_comment = false;
            }
            continue;
        }

        if in_single {
            if ch == '\'' {
                in_single = false;
            }
            continue;
        }

        if in_double {
            if ch == '"' {
                in_double = false;
            }
            continue;
        }

        if in_backtick {
            if ch == '`' {
                in_backtick = false;
            }
            continue;
        }

        if ch == '-' && matches!(chars.peek(), Some((_, '-'))) {
            chars.next();
            in_line_comment = true;
            continue;
        }

        if ch == '/' && matches!(chars.peek(), Some((_, '*'))) {
            chars.next();
            in_block_comment = true;
            continue;
        }

        match ch {
            '\'' => in_single = true,
            '"' => in_double = true,
            '`' => in_backtick = true,
            ';' => {
                let statement = query[start..idx].trim();
                if !statement.is_empty() {
                    statements.push(statement);
                }
                start = idx + ch.len_utf8();
            }
            _ => {}
        }
    }

    let trailing = query[start..].trim();
    if !trailing.is_empty() {
        statements.push(trailing);
    }

    statements
}

#[cfg(test)]
mod tests {
    use super::{
        QueryExecutionSurface, QueryPolicyDecision, QueryStatementKind, evaluate_query_policy,
        first_keyword, split_sql_statements,
    };
    use crate::engines::ConnectionTag;

    #[test]
    fn split_sql_statements_ignores_semicolons_in_strings_and_comments() {
        let statements = split_sql_statements(
            "INSERT INTO logs VALUES ('keep;this'); -- comment;\nTRUNCATE TABLE logs;",
        );

        assert_eq!(statements.len(), 2);
        assert!(statements[0].starts_with("INSERT INTO logs"));
        assert!(statements[1].contains("TRUNCATE TABLE logs"));
    }

    #[test]
    fn evaluate_query_policy_blocks_drop_for_production() {
        let decision = evaluate_query_policy(
            "SELECT 1; DROP TABLE users;",
            Some(ConnectionTag::Production),
            QueryExecutionSurface::QueryEditor,
        );

        assert_eq!(
            decision,
            QueryPolicyDecision::Blocked {
                statement: QueryStatementKind::Drop,
            }
        );
    }

    #[test]
    fn evaluate_query_policy_allows_non_production_truncate() {
        let decision = evaluate_query_policy(
            "TRUNCATE TABLE users",
            Some(ConnectionTag::Development),
            QueryExecutionSurface::QueryEditor,
        );

        assert_eq!(decision, QueryPolicyDecision::Allow);
    }

    #[test]
    fn evaluate_query_policy_allows_safe_production_select() {
        let decision = evaluate_query_policy(
            "/* note */\nSELECT * FROM users",
            Some(ConnectionTag::Production),
            QueryExecutionSurface::QueryEditor,
        );

        assert_eq!(decision, QueryPolicyDecision::Allow);
    }

    #[test]
    fn evaluate_query_policy_allows_production_drop_for_guided_surface() {
        let decision = evaluate_query_policy(
            "DROP TABLE users",
            Some(ConnectionTag::Production),
            QueryExecutionSurface::Guided,
        );

        assert_eq!(decision, QueryPolicyDecision::Allow);
    }

    #[test]
    fn first_keyword_detects_mutating_keyword_after_with_cte() {
        let keyword = first_keyword("WITH doomed AS (SELECT id FROM users) DELETE FROM users");

        assert_eq!(keyword, Some("DELETE".to_string()));
    }

    #[test]
    fn first_keyword_ignores_comment_and_string_tokens_after_with_cte() {
        let keyword = first_keyword(
            "WITH safe AS (SELECT 'DELETE FROM users' AS sql_text) /* UPDATE */ SELECT * FROM safe",
        );

        assert_eq!(keyword, Some("WITH".to_string()));
    }
}
