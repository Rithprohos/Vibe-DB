use super::{
    build_create_table_sql, build_create_view_sql, build_delete_queries,
    build_where_clause_for_row, quote_qualified_identifier, CreateTableColumnInput,
    RowIdentifierInput,
};
use crate::engines::ColumnInfo;
use serde_json::json;

fn test_column(name: &str, col_type: &str, pk: bool) -> ColumnInfo {
    ColumnInfo {
        cid: 0,
        name: name.to_string(),
        col_type: col_type.to_string(),
        notnull: false,
        dflt_value: None,
        pk,
    }
}

fn test_row_identifier(value: serde_json::Value) -> RowIdentifierInput {
    let row_data = value
        .as_object()
        .cloned()
        .expect("test row identifier should be a JSON object");

    RowIdentifierInput { row_data }
}

#[test]
fn build_where_clause_for_row_uses_primary_key_columns_only() {
    let columns = vec![
        test_column("id", "INTEGER", true),
        test_column("name", "TEXT", false),
    ];
    let row = json!({
        "id": 42,
        "name": "Ada",
    });
    let row_map = row.as_object().expect("row should be object");

    let where_clause =
        build_where_clause_for_row(row_map, &columns).expect("expected where clause");

    assert_eq!(where_clause, "\"id\" = 42");
}

#[test]
fn build_where_clause_for_row_requires_all_primary_key_columns() {
    let columns = vec![
        test_column("tenant_id", "TEXT", true),
        test_column("id", "INTEGER", true),
    ];
    let row = json!({
        "id": 7
    });
    let row_map = row.as_object().expect("row should be object");

    let error = build_where_clause_for_row(row_map, &columns)
        .expect_err("expected error for missing PK value");

    assert_eq!(
        error,
        "Missing required column 'tenant_id' in row identifier"
    );
}

#[test]
fn build_where_clause_for_row_falls_back_to_all_columns_without_primary_key() {
    let columns = vec![
        test_column("id", "INTEGER", false),
        test_column("name", "TEXT", false),
    ];
    let row = json!({
        "id": 5,
        "name": "O'Reilly",
    });
    let row_map = row.as_object().expect("row should be object");

    let where_clause =
        build_where_clause_for_row(row_map, &columns).expect("expected where clause");

    assert_eq!(where_clause, "\"id\" = 5 AND \"name\" = 'O''Reilly'");
}

#[test]
fn build_delete_queries_rejects_invalid_table_name() {
    let rows = vec![test_row_identifier(json!({ "id": 1 }))];
    let columns = vec![test_column("id", "INTEGER", true)];

    let error = build_delete_queries("main..users", &rows, &columns)
        .expect_err("expected invalid table name error");

    assert_eq!(error, "Table name contains an empty identifier segment");
}

#[test]
fn build_delete_queries_generates_quoted_delete_statements() {
    let rows = vec![
        test_row_identifier(json!({ "id": 1 })),
        test_row_identifier(json!({ "id": 2 })),
    ];
    let columns = vec![test_column("id", "INTEGER", true)];

    let queries =
        build_delete_queries("main.users", &rows, &columns).expect("expected delete queries");

    assert_eq!(
        queries,
        vec![
            "DELETE FROM \"main\".\"users\" WHERE \"id\" = 1;".to_string(),
            "DELETE FROM \"main\".\"users\" WHERE \"id\" = 2;".to_string(),
        ]
    );
}

#[test]
fn build_create_view_sql_basic() {
    let sql = build_create_view_sql(
        "active_users".to_string(),
        "SELECT * FROM users".to_string(),
        false,
        false,
    )
    .expect("expected SQL");

    assert_eq!(sql, "CREATE VIEW \"active_users\" AS\nSELECT * FROM users;");
}

#[test]
fn build_create_view_sql_temp_if_not_exists() {
    let sql = build_create_view_sql(
        "recent_orders".to_string(),
        "WITH latest AS (SELECT * FROM orders) SELECT * FROM latest".to_string(),
        true,
        true,
    )
    .expect("expected SQL");

    assert_eq!(
            sql,
            "CREATE TEMP VIEW IF NOT EXISTS \"recent_orders\" AS\nWITH latest AS (SELECT * FROM orders) SELECT * FROM latest;"
        );
}

#[test]
fn build_create_view_sql_rejects_bad_identifier() {
    let error = build_create_view_sql(
        "123_invalid".to_string(),
        "SELECT 1".to_string(),
        false,
        false,
    )
    .expect_err("expected validation error");

    assert!(error.contains("View name must start with a letter or underscore"));
}

#[test]
fn build_create_view_sql_rejects_sqlite_prefix() {
    let error = build_create_view_sql(
        "sqlite_my_view".to_string(),
        "SELECT 1".to_string(),
        false,
        false,
    )
    .expect_err("expected sqlite_ prefix error");

    assert_eq!(error, "View name cannot start with 'sqlite_'");
}

#[test]
fn build_create_view_sql_rejects_empty_query() {
    let error = build_create_view_sql("my_view".to_string(), "   ".to_string(), false, false)
        .expect_err("expected empty query error");

    assert_eq!(error, "View query is required");
}

#[test]
fn build_create_view_sql_rejects_non_select_query() {
    let error = build_create_view_sql(
        "my_view".to_string(),
        "UPDATE users SET name = 'x'".to_string(),
        false,
        false,
    )
    .expect_err("expected non-select error");

    assert_eq!(error, "View query must start with SELECT or WITH");
}

#[test]
fn build_create_view_sql_rejects_multi_statement_query() {
    let error = build_create_view_sql(
        "my_view".to_string(),
        "SELECT * FROM users; SELECT * FROM orders".to_string(),
        false,
        false,
    )
    .expect_err("expected single statement error");

    assert_eq!(error, "View query must contain a single SELECT statement");
}

#[test]
fn quote_qualified_identifier_quotes_each_segment() {
    assert_eq!(
        quote_qualified_identifier("public.users"),
        "\"public\".\"users\""
    );
}

#[test]
fn build_create_table_sql_sqlite_with_autoincrement() {
    let columns = vec![CreateTableColumnInput {
        name: "id".to_string(),
        col_type: "INTEGER".to_string(),
        primary_key: true,
        auto_increment: true,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let sql = build_create_table_sql(
        "users".to_string(),
        columns,
        false,
        Some("sqlite".to_string()),
    )
    .expect("expected SQL");

    assert!(
        sql.contains("INTEGER PRIMARY KEY AUTOINCREMENT"),
        "SQLite should use INTEGER PRIMARY KEY AUTOINCREMENT. Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_postgres_with_serial() {
    let columns = vec![CreateTableColumnInput {
        name: "id".to_string(),
        col_type: "INTEGER".to_string(),
        primary_key: true,
        auto_increment: true,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let sql = build_create_table_sql(
        "users".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
    )
    .expect("expected SQL");

    assert!(
        sql.contains("SERIAL PRIMARY KEY"),
        "PostgreSQL should use SERIAL PRIMARY KEY. Got: {}",
        sql
    );
    assert!(
        !sql.contains("AUTOINCREMENT"),
        "PostgreSQL should NOT contain AUTOINCREMENT. Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_postgres_with_bigserial() {
    let columns = vec![CreateTableColumnInput {
        name: "id".to_string(),
        col_type: "BIGINT".to_string(),
        primary_key: true,
        auto_increment: true,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let sql = build_create_table_sql(
        "events".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
    )
    .expect("expected SQL");

    assert!(
        sql.contains("BIGSERIAL PRIMARY KEY"),
        "PostgreSQL BIGINT auto-increment should use BIGSERIAL. Got: {}",
        sql
    );
    assert!(
        !sql.contains("AUTOINCREMENT"),
        "PostgreSQL should NOT contain AUTOINCREMENT. Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_postgres_supports_if_not_exists() {
    let columns = vec![CreateTableColumnInput {
        name: "id".to_string(),
        col_type: "INTEGER".to_string(),
        primary_key: true,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let sql = build_create_table_sql(
        "users".to_string(),
        columns,
        true,
        Some("postgres".to_string()),
    )
    .expect("expected SQL");

    assert!(
        sql.starts_with("CREATE TABLE IF NOT EXISTS"),
        "PostgreSQL should retain IF NOT EXISTS. Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_rejects_unknown_engine() {
    let columns = vec![CreateTableColumnInput {
        name: "id".to_string(),
        col_type: "INTEGER".to_string(),
        primary_key: true,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let error = build_create_table_sql(
        "users".to_string(),
        columns,
        false,
        Some("mysql".to_string()),
    )
    .expect_err("expected unsupported engine error");

    assert_eq!(error, "Unsupported database engine for CREATE TABLE: mysql");
}
