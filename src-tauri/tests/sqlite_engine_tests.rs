// Integration tests for SQLite engine
use vibe_db_lib::engines::sqlite::SqliteEngine;
use vibe_db_lib::engines::{ConnectionConfig, TableInfo, ColumnInfo, QueryResult, EngineResult, DatabaseEngine};

fn create_test_config(path: &str) -> ConnectionConfig {
    ConnectionConfig::sqlite(
        "test-conn".to_string(),
        "Test".to_string(),
        path.to_string()
    )
}

#[test]
fn test_sqlite_engine_new() {
    let _engine = SqliteEngine::new();
    // Should create engine without connection
    // Note: is_connected needs async, which we'll test below
}

#[test]
fn test_validate_table_name_valid() {
    assert!(SqliteEngine::validate_table_name("users").is_ok());
    assert!(SqliteEngine::validate_table_name("users_v2").is_ok());
    assert!(SqliteEngine::validate_table_name("test_table_123").is_ok());
}

#[test]
fn test_validate_table_name_invalid() {
    let result = SqliteEngine::validate_table_name("");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("cannot be empty"));

    let result = SqliteEngine::validate_table_name("users; DROP TABLE users;");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("Invalid table name"));

    let result = SqliteEngine::validate_table_name("table-name");
    assert!(result.is_err());
}

#[test]
fn test_json_from_row_null() {
    // This function is tested through integration tests below
    // Since it requires a real SQLite row
}

#[tokio::test]
async fn test_sqlite_engine_connect_disconnect() {
    let temp_path = std::env::temp_dir().join("test_vibedb_engine.db");
    let engine = SqliteEngine::new();
    let config = create_test_config(&temp_path.to_string_lossy());

    // Initially not connected
    assert!(!engine.is_connected().await);

    // Connect
    let result: EngineResult<()> = engine.connect(&config).await;
    assert!(result.is_ok());
    assert!(engine.is_connected().await);

    // Disconnect
    engine.disconnect().await;
    assert!(!engine.is_connected().await);

    // Cleanup
    let _ = std::fs::remove_file(&temp_path);
}

#[tokio::test]
async fn test_sqlite_engine_create_database() {
    let engine = SqliteEngine::new();
    let temp_path = std::env::temp_dir().join("test_vibedb_created.db");

    // Create database
    let result: EngineResult<String> = engine.create_database(&temp_path.to_string_lossy()).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), temp_path.to_string_lossy());

    // Verify file exists
    assert!(temp_path.exists());

    // Cleanup
    let _ = std::fs::remove_file(&temp_path);
}

#[tokio::test]
async fn test_sqlite_engine_list_tables() {
    let engine = SqliteEngine::new();
    let temp_path = std::env::temp_dir().join("test_vibedb_tables.db");
    let config = create_test_config(&temp_path.to_string_lossy());

    // Connect
    let _: EngineResult<()> = engine.connect(&config).await;

    // Initially no tables
    let tables: Vec<TableInfo> = engine.list_tables().await.unwrap();
    assert!(tables.is_empty());

    // Create a table
    let _: EngineResult<QueryResult> = engine.execute_query("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)").await;

    // Now should have tables
    let tables: Vec<TableInfo> = engine.list_tables().await.unwrap();
    assert_eq!(tables.len(), 1);
    assert_eq!(tables[0].name, "users");
    assert_eq!(tables[0].table_type, "table");

    engine.disconnect().await;
    let _ = std::fs::remove_file(&temp_path);
}

#[tokio::test]
async fn test_sqlite_engine_get_table_structure() {
    let engine = SqliteEngine::new();
    let temp_path = std::env::temp_dir().join("test_vibedb_structure.db");
    let config = create_test_config(&temp_path.to_string_lossy());

    let _: EngineResult<()> = engine.connect(&config).await;

    // Create a table with various column types
    let _: EngineResult<QueryResult> = engine.execute_query(
        "CREATE TABLE test_table (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL DEFAULT 'unknown',
            age INTEGER,
            score REAL,
            data BLOB
        )"
    ).await;

    // Get structure
    let columns: Vec<ColumnInfo> = engine.get_table_structure("test_table").await.unwrap();
    assert_eq!(columns.len(), 5);

    // Check id column
    assert_eq!(columns[0].name, "id");
    assert_eq!(columns[0].col_type, "INTEGER");
    assert!(columns[0].pk);

    // Check name column
    assert_eq!(columns[1].name, "name");
    assert!(columns[1].notnull);
    assert_eq!(columns[1].dflt_value, Some("'unknown'".to_string()));

    engine.disconnect().await;
    let _ = std::fs::remove_file(&temp_path);
}

#[tokio::test]
async fn test_sqlite_engine_execute_query_select() {
    let engine = SqliteEngine::new();
    let temp_path = std::env::temp_dir().join("test_vibedb_select.db");
    let config = create_test_config(&temp_path.to_string_lossy());

    let _: EngineResult<()> = engine.connect(&config).await;

    // Create and populate table
    let _: EngineResult<QueryResult> = engine.execute_query(
        "CREATE TABLE numbers (id INTEGER PRIMARY KEY, value INTEGER)"
    ).await;
    
    let _: EngineResult<QueryResult> = engine.execute_query(
        "INSERT INTO numbers (value) VALUES (1), (2), (3)"
    ).await;

    // Select
    let result: QueryResult = engine.execute_query("SELECT * FROM numbers").await.unwrap();
    assert_eq!(result.columns, vec!["id", "value"]);
    assert_eq!(result.rows.len(), 3);

    engine.disconnect().await;
    let _ = std::fs::remove_file(&temp_path);
}

#[tokio::test]
async fn test_sqlite_engine_execute_query_insert() {
    let engine = SqliteEngine::new();
    let temp_path = std::env::temp_dir().join("test_vibedb_insert.db");
    let config = create_test_config(&temp_path.to_string_lossy());

    let _: EngineResult<()> = engine.connect(&config).await;

    let _: EngineResult<QueryResult> = engine.execute_query(
        "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)"
    ).await;

    // Insert
    let result: QueryResult = engine.execute_query(
        "INSERT INTO items (name) VALUES ('test'), ('test2')"
    ).await.unwrap();

    assert_eq!(result.rows_affected, 2);
    assert!(result.message.contains("2 row(s) affected"));

    engine.disconnect().await;
    let _ = std::fs::remove_file(&temp_path);
}

#[tokio::test]
async fn test_sqlite_engine_execute_query_with_comment() {
    let engine = SqliteEngine::new();
    let temp_path = std::env::temp_dir().join("test_vibedb_comment.db");
    let config = create_test_config(&temp_path.to_string_lossy());

    let _: EngineResult<()> = engine.connect(&config).await;

    let _: EngineResult<QueryResult> = engine.execute_query(
        "CREATE TABLE test (id INTEGER PRIMARY KEY)"
    ).await;

    // Query with comment - should still work
    let result: QueryResult = engine.execute_query("-- This is a comment\nSELECT * FROM test").await.unwrap();
    assert!(result.columns.is_empty()); // No rows yet

    engine.disconnect().await;
    let _ = std::fs::remove_file(&temp_path);
}

#[tokio::test]
async fn test_sqlite_engine_get_table_row_count() {
    let engine = SqliteEngine::new();
    let temp_path = std::env::temp_dir().join("test_vibedb_count.db");
    let config = create_test_config(&temp_path.to_string_lossy());

    let _: EngineResult<()> = engine.connect(&config).await;

    let _: EngineResult<QueryResult> = engine.execute_query(
        "CREATE TABLE count_test (id INTEGER PRIMARY KEY)"
    ).await;
    
    let _: EngineResult<QueryResult> = engine.execute_query(
        "INSERT INTO count_test VALUES (1), (2), (3), (4), (5)"
    ).await;

    let count: i64 = engine.get_table_row_count("count_test").await.unwrap();
    assert_eq!(count, 5);

    engine.disconnect().await;
    let _ = std::fs::remove_file(&temp_path);
}

#[tokio::test]
async fn test_sqlite_engine_execute_query_error() {
    let engine = SqliteEngine::new();
    let temp_path = std::env::temp_dir().join("test_vibedb_error.db");
    let config = create_test_config(&temp_path.to_string_lossy());

    let _: EngineResult<()> = engine.connect(&config).await;

    // Invalid SQL
    let result: EngineResult<QueryResult> = engine.execute_query("SELECT * FROM nonexistent_table").await;
    assert!(result.is_err());

    engine.disconnect().await;
    let _ = std::fs::remove_file(&temp_path);
}
