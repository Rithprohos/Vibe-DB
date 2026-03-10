use uuid::Uuid;
use vibe_db_lib::engines::turso::TursoEngine;
use vibe_db_lib::engines::{ConnectionConfig, DatabaseEngine, EngineResult, QueryResult};

fn create_turso_local_config(path: &str) -> ConnectionConfig {
    ConnectionConfig::turso_local(
        "test-turso-conn".to_string(),
        "Test Turso".to_string(),
        path.to_string(),
    )
}

fn create_temp_db_path(prefix: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("{}_{}.db", prefix, Uuid::new_v4()))
}

fn cleanup_temp_db(path: &std::path::Path) {
    let _ = std::fs::remove_file(path);
}

fn extract_first_count(result: &QueryResult) -> i64 {
    result
        .rows
        .first()
        .and_then(|row| row.first())
        .and_then(serde_json::Value::as_i64)
        .unwrap_or_default()
}

#[test]
fn test_turso_validate_query_safety_blocks_delete_without_where() {
    let result = TursoEngine::validate_query_safety("DELETE FROM users");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("without WHERE"));
}

#[test]
fn test_turso_validate_query_safety_blocks_tautology() {
    let result = TursoEngine::validate_query_safety("UPDATE users SET name = 'x' WHERE 1=1");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("tautology"));
}

#[tokio::test]
async fn test_turso_engine_connect_disconnect() {
    let db_path = create_temp_db_path("test_vibedb_turso_connect");
    let engine = TursoEngine::new();
    let config = create_turso_local_config(&db_path.to_string_lossy());

    assert!(!engine.is_connected().await);

    let result: EngineResult<()> = engine.connect(&config).await;
    assert!(result.is_ok());
    assert!(engine.is_connected().await);

    engine.disconnect().await;
    assert!(!engine.is_connected().await);

    cleanup_temp_db(&db_path);
}

#[tokio::test]
async fn test_turso_execute_transaction_commits_valid_dml() {
    let db_path = create_temp_db_path("test_vibedb_turso_tx_commit");
    let engine = TursoEngine::new();
    let config = create_turso_local_config(&db_path.to_string_lossy());

    let connected: EngineResult<()> = engine.connect(&config).await;
    assert!(connected.is_ok());

    let created = engine
        .execute_query("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)")
        .await;
    assert!(created.is_ok());

    let tx_result = engine
        .execute_transaction(&[
            "INSERT INTO items (name) VALUES ('a')".to_string(),
            "UPDATE items SET name = 'b' WHERE name = 'a'".to_string(),
        ])
        .await;
    assert!(tx_result.is_ok());

    let tx = tx_result.unwrap();
    assert_eq!(tx.rows_affected, 2);
    assert!(tx.message.contains("Committed 2 statement(s)"));

    let count_result = engine
        .execute_query("SELECT COUNT(*) AS count FROM items")
        .await
        .unwrap();
    assert_eq!(extract_first_count(&count_result), 1);

    engine.disconnect().await;
    cleanup_temp_db(&db_path);
}

#[tokio::test]
async fn test_turso_execute_transaction_rolls_back_when_validation_fails() {
    let db_path = create_temp_db_path("test_vibedb_turso_tx_rollback");
    let engine = TursoEngine::new();
    let config = create_turso_local_config(&db_path.to_string_lossy());

    let connected: EngineResult<()> = engine.connect(&config).await;
    assert!(connected.is_ok());

    let created = engine
        .execute_query("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)")
        .await;
    assert!(created.is_ok());

    let tx_result = engine
        .execute_transaction(&[
            "INSERT INTO items (name) VALUES ('pending')".to_string(),
            "DELETE FROM items".to_string(),
        ])
        .await;
    assert!(tx_result.is_err());
    let message = tx_result.unwrap_err().to_string();
    assert!(message.contains("without WHERE"));

    let count_result = engine
        .execute_query("SELECT COUNT(*) AS count FROM items")
        .await
        .unwrap();
    assert_eq!(extract_first_count(&count_result), 0);

    engine.disconnect().await;
    cleanup_temp_db(&db_path);
}
