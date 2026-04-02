use super::{
    CheckConstraintInput, CreateIndexInput, CreateTableColumnInput, ForeignKeyConstraintInput,
    RowDataInput, RowIdentifierInput, RowUpdateInput, TypeParams, build_create_enum_sql,
    build_create_indexes_sql, build_create_table_sql, build_create_view_sql, build_delete_queries,
    build_insert_queries, build_insert_query, build_update_queries, build_where_clause_for_row,
    quote_qualified_identifier,
};
use crate::engines::ColumnInfo;
use serde_json::json;

fn test_column(name: &str, col_type: &str, pk: bool) -> ColumnInfo {
    ColumnInfo {
        cid: 0,
        name: name.to_string(),
        col_type: col_type.to_string(),
        enum_values: None,
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

fn test_row_data(value: serde_json::Value) -> RowDataInput {
    let row_data = value
        .as_object()
        .cloned()
        .expect("test row data should be a JSON object");

    RowDataInput { row_data }
}

fn test_row_update(row_data: serde_json::Value, identifier: serde_json::Value) -> RowUpdateInput {
    let row_data = row_data
        .as_object()
        .cloned()
        .expect("test row update data should be a JSON object");
    let identifier = identifier
        .as_object()
        .cloned()
        .expect("test row update identifier should be a JSON object");

    RowUpdateInput {
        row_data,
        identifier,
    }
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
fn build_create_enum_sql_basic() {
    let sql = build_create_enum_sql(
        "status".to_string(),
        vec![
            "pending".to_string(),
            "active".to_string(),
            "archived".to_string(),
        ],
        Some("postgres".to_string()),
    )
    .expect("expected SQL");

    assert_eq!(
        sql,
        "CREATE TYPE \"status\" AS ENUM ('pending', 'active', 'archived');"
    );
}

#[test]
fn build_create_enum_sql_escapes_single_quotes() {
    let sql = build_create_enum_sql(
        "book_state".to_string(),
        vec!["author's pick".to_string()],
        Some("postgres".to_string()),
    )
    .expect("expected SQL");

    assert_eq!(
        sql,
        "CREATE TYPE \"book_state\" AS ENUM ('author''s pick');"
    );
}

#[test]
fn build_create_enum_sql_rejects_non_postgres_engine() {
    let error = build_create_enum_sql(
        "status".to_string(),
        vec!["pending".to_string()],
        Some("sqlite".to_string()),
    )
    .expect_err("expected unsupported engine error");

    assert_eq!(error, "Unsupported database engine for CREATE ENUM: sqlite");
}

#[test]
fn build_create_enum_sql_rejects_empty_enum_name() {
    let error = build_create_enum_sql(
        "   ".to_string(),
        vec!["pending".to_string()],
        Some("postgres".to_string()),
    )
    .expect_err("expected enum name validation error");

    assert_eq!(error, "Enum name is required");
}

#[test]
fn build_create_enum_sql_rejects_empty_value() {
    let error = build_create_enum_sql(
        "status".to_string(),
        vec!["pending".to_string(), " ".to_string()],
        Some("postgres".to_string()),
    )
    .expect_err("expected enum value validation error");

    assert_eq!(error, "Enum value #2 is required");
}

#[test]
fn build_create_enum_sql_rejects_duplicate_values() {
    let error = build_create_enum_sql(
        "status".to_string(),
        vec!["pending".to_string(), "pending".to_string()],
        Some("postgres".to_string()),
    )
    .expect_err("expected duplicate enum value error");

    assert_eq!(error, "Duplicate enum value: \"pending\"");
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
        type_params: None,
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
        None,
        None,
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
        type_params: None,
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
        None,
        None,
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
        type_params: None,
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
        None,
        None,
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
        type_params: None,
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
        None,
        None,
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
        type_params: None,
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
        None,
        None,
    )
    .expect_err("expected unsupported engine error");

    assert_eq!(error, "Unsupported database engine for CREATE TABLE: mysql");
}

#[test]
fn build_create_table_sql_includes_foreign_key_actions() {
    let columns = vec![
        CreateTableColumnInput {
            name: "id".to_string(),
            col_type: "INTEGER".to_string(),
            type_params: None,
            primary_key: true,
            auto_increment: true,
            not_null: false,
            unique: false,
            default_option: "none".to_string(),
            default_value: "".to_string(),
        },
        CreateTableColumnInput {
            name: "user_id".to_string(),
            col_type: "INTEGER".to_string(),
            type_params: None,
            primary_key: false,
            auto_increment: false,
            not_null: true,
            unique: false,
            default_option: "none".to_string(),
            default_value: "".to_string(),
        },
    ];
    let foreign_keys = vec![ForeignKeyConstraintInput {
        column_name: "user_id".to_string(),
        referenced_table: "users".to_string(),
        referenced_column: "id".to_string(),
        on_delete: Some("cascade".to_string()),
        on_update: Some("restrict".to_string()),
    }];

    let sql = build_create_table_sql(
        "orders".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
        Some(foreign_keys),
        None,
    )
    .expect("expected SQL");

    assert!(
        sql.contains(
            "FOREIGN KEY (\"user_id\") REFERENCES \"users\" (\"id\") ON DELETE CASCADE ON UPDATE RESTRICT"
        ),
        "Expected FK clause with actions. Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_postgres_supports_schema_qualified_foreign_key_table() {
    let columns = vec![
        CreateTableColumnInput {
            name: "id".to_string(),
            col_type: "INTEGER".to_string(),
            type_params: None,
            primary_key: true,
            auto_increment: true,
            not_null: false,
            unique: false,
            default_option: "none".to_string(),
            default_value: "".to_string(),
        },
        CreateTableColumnInput {
            name: "user_id".to_string(),
            col_type: "INTEGER".to_string(),
            type_params: None,
            primary_key: false,
            auto_increment: false,
            not_null: true,
            unique: false,
            default_option: "none".to_string(),
            default_value: "".to_string(),
        },
    ];
    let foreign_keys = vec![ForeignKeyConstraintInput {
        column_name: "user_id".to_string(),
        referenced_table: "auth.users".to_string(),
        referenced_column: "id".to_string(),
        on_delete: Some("cascade".to_string()),
        on_update: None,
    }];

    let sql = build_create_table_sql(
        "orders".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
        Some(foreign_keys),
        None,
    )
    .expect("expected SQL");

    assert!(
        sql.contains(
            "FOREIGN KEY (\"user_id\") REFERENCES \"auth\".\"users\" (\"id\") ON DELETE CASCADE"
        ),
        "Expected schema-qualified FK reference. Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_rejects_partial_foreign_key_constraint() {
    let columns = vec![CreateTableColumnInput {
        name: "user_id".to_string(),
        col_type: "INTEGER".to_string(),
        type_params: None,
        primary_key: false,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];
    let foreign_keys = vec![ForeignKeyConstraintInput {
        column_name: "user_id".to_string(),
        referenced_table: "".to_string(),
        referenced_column: "id".to_string(),
        on_delete: None,
        on_update: None,
    }];

    let error = build_create_table_sql(
        "orders".to_string(),
        columns,
        false,
        Some("sqlite".to_string()),
        Some(foreign_keys),
        None,
    )
    .expect_err("expected partial FK validation error");

    assert_eq!(
        error,
        "Foreign key constraint #1 requires column, referenced table, and referenced column"
    );
}

#[test]
fn build_create_table_sql_rejects_invalid_foreign_key_on_delete_action() {
    let columns = vec![CreateTableColumnInput {
        name: "user_id".to_string(),
        col_type: "INTEGER".to_string(),
        type_params: None,
        primary_key: false,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];
    let foreign_keys = vec![ForeignKeyConstraintInput {
        column_name: "user_id".to_string(),
        referenced_table: "users".to_string(),
        referenced_column: "id".to_string(),
        on_delete: Some("drop".to_string()),
        on_update: None,
    }];

    let error = build_create_table_sql(
        "orders".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
        Some(foreign_keys),
        None,
    )
    .expect_err("expected invalid ON DELETE action validation error");

    assert_eq!(
        error,
        "Foreign key constraint #1 has invalid ON DELETE action: \"drop\""
    );
}

#[test]
fn build_create_table_sql_rejects_invalid_foreign_key_on_update_action() {
    let columns = vec![CreateTableColumnInput {
        name: "user_id".to_string(),
        col_type: "INTEGER".to_string(),
        type_params: None,
        primary_key: false,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];
    let foreign_keys = vec![ForeignKeyConstraintInput {
        column_name: "user_id".to_string(),
        referenced_table: "users".to_string(),
        referenced_column: "id".to_string(),
        on_delete: None,
        on_update: Some("drop".to_string()),
    }];

    let error = build_create_table_sql(
        "orders".to_string(),
        columns,
        false,
        Some("sqlite".to_string()),
        Some(foreign_keys),
        None,
    )
    .expect_err("expected invalid ON UPDATE action validation error");

    assert_eq!(
        error,
        "Foreign key constraint #1 has invalid ON UPDATE action: \"drop\""
    );
}

#[test]
fn build_create_table_sql_rejects_empty_check_constraint_expression() {
    let columns = vec![CreateTableColumnInput {
        name: "amount".to_string(),
        col_type: "NUMERIC".to_string(),
        type_params: None,
        primary_key: false,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];
    let checks = vec![CheckConstraintInput {
        name: "chk_amount_positive".to_string(),
        expression: "".to_string(),
    }];

    let error = build_create_table_sql(
        "payments".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
        None,
        Some(checks),
    )
    .expect_err("expected empty check expression validation error");

    assert_eq!(error, "Check constraint #1 expression is required");
}

#[test]
fn build_create_table_sql_includes_named_check_constraint() {
    let columns = vec![CreateTableColumnInput {
        name: "amount".to_string(),
        col_type: "NUMERIC".to_string(),
        type_params: None,
        primary_key: false,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];
    let checks = vec![CheckConstraintInput {
        name: "chk_amount_positive".to_string(),
        expression: "amount > 0".to_string(),
    }];

    let sql = build_create_table_sql(
        "payments".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
        None,
        Some(checks),
    )
    .expect("expected SQL");

    assert!(
        sql.contains("CONSTRAINT \"chk_amount_positive\" CHECK (amount > 0)"),
        "Expected named check constraint. Got: {}",
        sql
    );
}

#[test]
fn build_create_indexes_sql_sqlite_basic() {
    let indexes = vec![CreateIndexInput {
        name: "idx_users_email".to_string(),
        columns: vec!["email".to_string()],
        unique: false,
        method: None,
    }];

    let sql = build_create_indexes_sql("users".to_string(), indexes, Some("sqlite".to_string()))
        .expect("expected index SQL");

    assert_eq!(
        sql,
        vec!["CREATE INDEX \"idx_users_email\" ON \"users\" (\"email\");".to_string()]
    );
}

#[test]
fn build_create_indexes_sql_postgres_with_method() {
    let indexes = vec![CreateIndexInput {
        name: "idx_events_payload".to_string(),
        columns: vec!["payload".to_string()],
        unique: false,
        method: Some("gin".to_string()),
    }];

    let sql = build_create_indexes_sql("events".to_string(), indexes, Some("postgres".to_string()))
        .expect("expected postgres index SQL");

    assert_eq!(
        sql,
        vec![
            "CREATE INDEX \"idx_events_payload\" ON \"events\" USING gin (\"payload\");"
                .to_string()
        ]
    );
}

#[test]
fn build_create_indexes_sql_rejects_method_on_sqlite() {
    let indexes = vec![CreateIndexInput {
        name: "idx_users_email".to_string(),
        columns: vec!["email".to_string()],
        unique: false,
        method: Some("btree".to_string()),
    }];

    let error = build_create_indexes_sql("users".to_string(), indexes, Some("sqlite".to_string()))
        .expect_err("expected sqlite method validation error");

    assert_eq!(
        error,
        "Index #1: index method is only supported for PostgreSQL"
    );
}

#[test]
fn build_create_indexes_sql_accepts_extension_postgres_method() {
    let indexes = vec![CreateIndexInput {
        name: "idx_events_payload".to_string(),
        columns: vec!["payload".to_string()],
        unique: false,
        method: Some("bloom".to_string()),
    }];

    let sql = build_create_indexes_sql("events".to_string(), indexes, Some("postgres".to_string()))
        .expect("expected postgres extension method SQL");

    assert_eq!(
        sql,
        vec![
            "CREATE INDEX \"idx_events_payload\" ON \"events\" USING bloom (\"payload\");"
                .to_string()
        ]
    );
}

#[test]
fn build_create_indexes_sql_rejects_invalid_method_identifier() {
    let indexes = vec![CreateIndexInput {
        name: "idx_events_payload".to_string(),
        columns: vec!["payload".to_string()],
        unique: false,
        method: Some("bad-method".to_string()),
    }];

    let error =
        build_create_indexes_sql("events".to_string(), indexes, Some("postgres".to_string()))
            .expect_err("expected invalid method identifier error");

    assert_eq!(
        error,
        "Index method name must start with a letter or underscore and contain only letters, numbers, and underscores"
    );
}

#[test]
fn build_create_indexes_sql_rejects_unique_non_btree_method() {
    let indexes = vec![CreateIndexInput {
        name: "idx_events_payload".to_string(),
        columns: vec!["payload".to_string()],
        unique: true,
        method: Some("gin".to_string()),
    }];

    let error =
        build_create_indexes_sql("events".to_string(), indexes, Some("postgres".to_string()))
            .expect_err("expected unique non-btree method error");

    assert_eq!(
        error,
        "Index #1: UNIQUE indexes only support the BTREE method"
    );
}

#[test]
fn build_create_indexes_sql_rejects_duplicate_index_names() {
    let indexes = vec![
        CreateIndexInput {
            name: "idx_users_email".to_string(),
            columns: vec!["email".to_string()],
            unique: false,
            method: None,
        },
        CreateIndexInput {
            name: "IDX_USERS_EMAIL".to_string(),
            columns: vec!["name".to_string()],
            unique: false,
            method: None,
        },
    ];

    let error = build_create_indexes_sql("users".to_string(), indexes, Some("sqlite".to_string()))
        .expect_err("expected duplicate index name error");

    assert_eq!(error, "Index \"IDX_USERS_EMAIL\" already exists");
}

#[test]
fn build_create_indexes_sql_rejects_empty_columns() {
    let indexes = vec![CreateIndexInput {
        name: "idx_users_email".to_string(),
        columns: vec![],
        unique: false,
        method: None,
    }];

    let error = build_create_indexes_sql("users".to_string(), indexes, Some("sqlite".to_string()))
        .expect_err("expected empty column list validation error");

    assert_eq!(error, "Index #1 requires at least one column");
}

#[test]
fn build_insert_query_rejects_empty_table_name() {
    let row = test_row_data(json!({ "name": "Alice" }));

    let error = build_insert_query("", &row).expect_err("expected empty table name error");

    assert_eq!(error, "Table name is required");
}

#[test]
fn build_insert_query_rejects_invalid_table_name() {
    let row = test_row_data(json!({ "name": "Alice" }));

    let error =
        build_insert_query("main..users", &row).expect_err("expected invalid table name error");

    assert_eq!(error, "Table name contains an empty identifier segment");
}

#[test]
fn build_insert_query_rejects_empty_row_data() {
    let row = test_row_data(json!({}));

    let error = build_insert_query("users", &row).expect_err("expected empty row data error");

    assert_eq!(error, "Row data cannot be empty");
}

#[test]
fn build_insert_query_generates_basic_insert() {
    let row = test_row_data(json!({
        "name": "Alice",
        "age": 30,
    }));

    let sql = build_insert_query("users", &row).expect("expected insert query");

    assert_eq!(
        sql,
        "INSERT INTO \"users\" (\"age\", \"name\") VALUES (30, 'Alice');"
    );
}

#[test]
fn build_insert_query_handles_qualified_table_name() {
    let row = test_row_data(json!({ "id": 1 }));

    let sql = build_insert_query("public.users", &row).expect("expected insert query");

    assert!(sql.contains("INSERT INTO \"public\".\"users\""));
}

#[test]
fn build_insert_query_handles_null_values() {
    let row = test_row_data(json!({
        "name": "Bob",
        "email": null,
    }));

    let sql = build_insert_query("users", &row).expect("expected insert query");

    assert!(sql.contains("(NULL, 'Bob')") || sql.contains("('Bob', NULL)"));
    assert!(sql.contains("'Bob'"));
    assert!(sql.contains("NULL"));
}

#[test]
fn build_insert_query_escapes_string_values() {
    let row = test_row_data(json!({
        "name": "O'Reilly",
        "description": "It's \"great\"!",
    }));

    let sql = build_insert_query("users", &row).expect("expected insert query");

    assert!(sql.contains("'O''Reilly'"));
    assert!(sql.contains("'It''s \"great\"!'"));
}

#[test]
fn build_insert_query_handles_boolean_values() {
    let row = test_row_data(json!({
        "name": "Charlie",
        "active": true,
        "deleted": false,
    }));

    let sql = build_insert_query("users", &row).expect("expected insert query");

    assert!(sql.contains("true"));
    assert!(sql.contains("false"));
}

#[test]
fn build_insert_query_handles_json_values() {
    let row = test_row_data(json!({
        "name": "Diana",
        "metadata": { "role": "admin" },
        "tags": ["a", "b", "c"],
    }));

    let sql = build_insert_query("users", &row).expect("expected insert query");

    // JSON values are serialized as strings
    assert!(sql.contains("'{"));
    assert!(sql.contains("}'"));
}

#[test]
fn build_insert_queries_rejects_empty_rows() {
    let rows: Vec<RowDataInput> = vec![];

    let error = build_insert_queries("users", &rows).expect_err("expected empty rows error");

    assert_eq!(error, "No rows provided for insertion");
}

#[test]
fn build_insert_queries_generates_multiple_inserts() {
    let rows = vec![
        test_row_data(json!({ "id": 1, "name": "Alice" })),
        test_row_data(json!({ "id": 2, "name": "Bob" })),
    ];

    let queries = build_insert_queries("users", &rows).expect("expected insert queries");

    assert_eq!(queries.len(), 1);
    assert_eq!(
        queries[0],
        "INSERT INTO \"users\" (\"id\", \"name\") VALUES (1, 'Alice'), (2, 'Bob');"
    );
}

#[test]
fn build_insert_queries_splits_when_column_sets_change() {
    let rows = vec![
        test_row_data(json!({ "id": 1, "name": "Alice" })),
        test_row_data(json!({ "id": 2, "email": "bob@example.com" })),
    ];

    let queries = build_insert_queries("users", &rows).expect("expected insert queries");

    assert_eq!(queries.len(), 2);
    assert_eq!(
        queries[0],
        "INSERT INTO \"users\" (\"id\", \"name\") VALUES (1, 'Alice');"
    );
    assert_eq!(
        queries[1],
        "INSERT INTO \"users\" (\"email\", \"id\") VALUES ('bob@example.com', 2);"
    );
}

#[test]
fn build_update_queries_rejects_empty_rows() {
    let rows: Vec<RowUpdateInput> = vec![];
    let columns = vec![test_column("id", "INTEGER", true)];

    let error =
        build_update_queries("users", &rows, &columns).expect_err("expected empty rows error");

    assert_eq!(error, "No rows provided for update");
}

#[test]
fn build_update_queries_rejects_unknown_columns() {
    let rows = vec![test_row_update(
        json!({ "missing": "Alice" }),
        json!({ "id": 1 }),
    )];
    let columns = vec![
        test_column("id", "INTEGER", true),
        test_column("name", "TEXT", false),
    ];

    let error =
        build_update_queries("users", &rows, &columns).expect_err("expected unknown column error");

    assert_eq!(error, "Unknown column 'missing'");
}

#[test]
fn build_update_queries_generates_quoted_update_statements() {
    let rows = vec![
        test_row_update(
            json!({ "name": "Alice", "active": true }),
            json!({ "id": 1 }),
        ),
        test_row_update(
            json!({ "name": "Bob", "active": false }),
            json!({ "id": 2 }),
        ),
    ];
    let columns = vec![
        test_column("id", "INTEGER", true),
        test_column("name", "TEXT", false),
        test_column("active", "BOOLEAN", false),
    ];

    let queries =
        build_update_queries("main.users", &rows, &columns).expect("expected update queries");

    assert_eq!(
        queries,
        vec![
            "UPDATE \"main\".\"users\" SET \"active\" = true, \"name\" = 'Alice' WHERE \"id\" = 1;"
                .to_string(),
            "UPDATE \"main\".\"users\" SET \"active\" = false, \"name\" = 'Bob' WHERE \"id\" = 2;"
                .to_string(),
        ]
    );
}

#[test]
fn build_insert_query_rejects_empty_column_name() {
    let row = test_row_data(json!({ "": "Alice" }));

    let error = build_insert_query("users", &row).expect_err("expected empty column name error");

    assert_eq!(error, "Column name is required");
}

// Parameterized type tests

#[test]
fn build_create_table_sql_postgres_with_varchar_length() {
    let columns = vec![CreateTableColumnInput {
        name: "name".to_string(),
        col_type: "VARCHAR".to_string(),
        type_params: Some(TypeParams {
            length: Some(255),
            precision: None,
            scale: None,
        }),
        primary_key: false,
        auto_increment: false,
        not_null: true,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let sql = build_create_table_sql(
        "users".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
        None,
        None,
    )
    .expect("expected SQL");

    assert!(
        sql.contains("VARCHAR(255)"),
        "PostgreSQL should support VARCHAR(n). Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_postgres_with_numeric_precision_scale() {
    let columns = vec![CreateTableColumnInput {
        name: "price".to_string(),
        col_type: "NUMERIC".to_string(),
        type_params: Some(TypeParams {
            length: None,
            precision: Some(10),
            scale: Some(2),
        }),
        primary_key: false,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let sql = build_create_table_sql(
        "products".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
        None,
        None,
    )
    .expect("expected SQL");

    assert!(
        sql.contains("NUMERIC(10,2)"),
        "PostgreSQL should support NUMERIC(p,s). Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_postgres_with_timestamp_precision() {
    let columns = vec![CreateTableColumnInput {
        name: "created_at".to_string(),
        col_type: "TIMESTAMP".to_string(),
        type_params: Some(TypeParams {
            length: None,
            precision: Some(3),
            scale: None,
        }),
        primary_key: false,
        auto_increment: false,
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
        None,
        None,
    )
    .expect("expected SQL");

    assert!(
        sql.contains("TIMESTAMP(3)"),
        "PostgreSQL should support TIMESTAMP(p). Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_sqlite_with_varchar_length() {
    let columns = vec![CreateTableColumnInput {
        name: "name".to_string(),
        col_type: "VARCHAR".to_string(),
        type_params: Some(TypeParams {
            length: Some(100),
            precision: None,
            scale: None,
        }),
        primary_key: false,
        auto_increment: false,
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
        None,
        None,
    )
    .expect("expected SQL");

    assert!(
        sql.contains("VARCHAR(100)"),
        "SQLite should support VARCHAR(n). Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_without_params_uses_base_type() {
    let columns = vec![CreateTableColumnInput {
        name: "name".to_string(),
        col_type: "VARCHAR".to_string(),
        type_params: None,
        primary_key: false,
        auto_increment: false,
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
        None,
        None,
    )
    .expect("expected SQL");

    assert!(
        sql.contains("VARCHAR"),
        "Should support base type without params. Got: {}",
        sql
    );
    assert!(
        !sql.contains("VARCHAR("),
        "Should not have parentheses when no params. Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_numeric_with_precision_only() {
    let columns = vec![CreateTableColumnInput {
        name: "amount".to_string(),
        col_type: "NUMERIC".to_string(),
        type_params: Some(TypeParams {
            length: None,
            precision: Some(18),
            scale: None,
        }),
        primary_key: false,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let sql = build_create_table_sql(
        "payments".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
        None,
        None,
    )
    .expect("expected SQL");

    assert!(
        sql.contains("NUMERIC(18)"),
        "Should support NUMERIC with precision only. Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_postgres_allows_scale_greater_than_precision() {
    let columns = vec![CreateTableColumnInput {
        name: "price".to_string(),
        col_type: "NUMERIC".to_string(),
        type_params: Some(TypeParams {
            length: None,
            precision: Some(4),
            scale: Some(5),
        }),
        primary_key: false,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let sql = build_create_table_sql(
        "products".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
        None,
        None,
    )
    .expect("expected SQL");

    assert!(
        sql.contains("NUMERIC(4,5)"),
        "PostgreSQL should allow scale greater than precision. Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_postgres_allows_negative_numeric_scale() {
    let columns = vec![CreateTableColumnInput {
        name: "price".to_string(),
        col_type: "NUMERIC".to_string(),
        type_params: Some(TypeParams {
            length: None,
            precision: Some(4),
            scale: Some(-2),
        }),
        primary_key: false,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let sql = build_create_table_sql(
        "products".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
        None,
        None,
    )
    .expect("expected SQL");

    assert!(
        sql.contains("NUMERIC(4,-2)"),
        "PostgreSQL should allow negative numeric scale. Got: {}",
        sql
    );
}

#[test]
fn build_create_table_sql_sqlite_rejects_scale_greater_than_precision() {
    let columns = vec![CreateTableColumnInput {
        name: "price".to_string(),
        col_type: "NUMERIC".to_string(),
        type_params: Some(TypeParams {
            length: None,
            precision: Some(4),
            scale: Some(5),
        }),
        primary_key: false,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let error = build_create_table_sql(
        "products".to_string(),
        columns,
        false,
        Some("sqlite".to_string()),
        None,
        None,
    )
    .expect_err("expected validation error");

    assert_eq!(error, "Scale cannot exceed precision");
}

#[test]
fn build_create_table_sql_rejects_temporal_precision_above_six() {
    let columns = vec![CreateTableColumnInput {
        name: "created_at".to_string(),
        col_type: "TIMESTAMP".to_string(),
        type_params: Some(TypeParams {
            length: None,
            precision: Some(7),
            scale: None,
        }),
        primary_key: false,
        auto_increment: false,
        not_null: false,
        unique: false,
        default_option: "none".to_string(),
        default_value: "".to_string(),
    }];

    let error = build_create_table_sql(
        "events".to_string(),
        columns,
        false,
        Some("postgres".to_string()),
        None,
        None,
    )
    .expect_err("expected validation error");

    assert_eq!(error, "Precision cannot exceed 6");
}
