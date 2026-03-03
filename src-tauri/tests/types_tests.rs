// Tests for engine types and data structures
use vibe_db_lib::engines::{ColumnInfo, ConnectionConfig, EngineType, QueryResult, TableInfo};

#[test]
fn test_engine_type_default() {
    let engine: EngineType = Default::default();
    assert_eq!(engine, EngineType::Sqlite);
}

#[test]
fn test_connection_config_sqlite() {
    let config = ConnectionConfig::sqlite(
        "test-id".to_string(),
        "Test DB".to_string(),
        "/path/to/test.db".to_string(),
    );

    assert_eq!(config.id, "test-id");
    assert_eq!(config.name, "Test DB");
    assert_eq!(config.path, Some("/path/to/test.db".to_string()));
    assert_eq!(config.engine_type, EngineType::Sqlite);
    assert!(config.host.is_none());
    assert!(config.username.is_none());
    assert!(config.password.is_none());
}

#[test]
fn test_engine_type_equality() {
    assert_eq!(EngineType::Sqlite, EngineType::Sqlite);
    assert_eq!(EngineType::Turso, EngineType::Turso);
    assert_eq!(EngineType::Postgres, EngineType::Postgres);
    assert_eq!(EngineType::Mysql, EngineType::Mysql);
}

#[test]
fn test_table_info_creation() {
    let table = TableInfo {
        name: "users".to_string(),
        table_type: "table".to_string(),
        schema: Some("public".to_string()),
    };

    assert_eq!(table.name, "users");
    assert_eq!(table.table_type, "table");
    assert_eq!(table.schema, Some("public".to_string()));
}

#[test]
fn test_column_info_creation() {
    let col = ColumnInfo {
        cid: 0,
        name: "id".to_string(),
        col_type: "INTEGER".to_string(),
        notnull: true,
        dflt_value: None,
        pk: true,
    };

    assert_eq!(col.cid, 0);
    assert_eq!(col.name, "id");
    assert_eq!(col.col_type, "INTEGER");
    assert!(col.notnull);
    assert!(col.pk);
}

#[test]
fn test_query_result_creation() {
    let result = QueryResult {
        columns: vec!["id".to_string(), "name".to_string()],
        rows: vec![vec![serde_json::json!(1), serde_json::json!("test")]],
        rows_affected: 1,
        message: "1 row(s) returned".to_string(),
    };

    assert_eq!(result.columns.len(), 2);
    assert_eq!(result.rows.len(), 1);
    assert_eq!(result.rows_affected, 1);
}
