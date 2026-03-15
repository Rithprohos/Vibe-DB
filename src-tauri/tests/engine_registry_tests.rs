// Tests for engine registry and error handling
use vibe_db_lib::engines::{
    ConnectionConfig, ConnectionTag, EngineError, EngineRegistry, EngineResult, EngineType,
};

#[test]
fn test_engine_registry_new() {
    let _registry = EngineRegistry::new();
    // Registry should start empty and be usable
    // Note: This test runs in a tokio test runtime
}

#[test]
fn test_engine_error_display() {
    let err = EngineError::ConnectionFailed("test error".to_string());
    assert_eq!(err.to_string(), "Connection failed: test error");

    let err = EngineError::QueryError("bad query".to_string());
    assert_eq!(err.to_string(), "Query error: bad query");

    let err = EngineError::UnsupportedEngine("oracle".to_string());
    assert_eq!(err.to_string(), "Unsupported engine: oracle");

    let err = EngineError::ConfigError("missing host".to_string());
    assert_eq!(err.to_string(), "Configuration error: missing host");
}

#[test]
fn test_engine_error_debug() {
    let err = EngineError::ConnectionFailed("test".to_string());
    let debug = format!("{:?}", err);
    assert!(debug.contains("ConnectionFailed"));
    assert!(debug.contains("test"));
}

#[tokio::test]
async fn test_engine_registry_connect_sqlite() {
    let registry = EngineRegistry::new();
    let temp_path = std::env::temp_dir().join("test_vibedb.db");

    let config = ConnectionConfig::sqlite(
        "test-conn-id".to_string(),
        "Test Connection".to_string(),
        temp_path.to_string_lossy().to_string(),
    );

    // Test connection
    let result: EngineResult<String> = registry.connect(config).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "test-conn-id");

    // Test getting engine
    let engine_result: EngineResult<_> = registry.get_engine("test-conn-id").await;
    assert!(engine_result.is_ok());

    // Test disconnect
    let disconnect_result: EngineResult<()> = registry.disconnect("test-conn-id").await;
    assert!(disconnect_result.is_ok());

    // Cleanup
    let _ = std::fs::remove_file(&temp_path);
}

#[tokio::test]
async fn test_engine_registry_get_nonexistent() {
    let registry = EngineRegistry::new();

    let result: EngineResult<_> = registry.get_engine("nonexistent-id").await;
    assert!(result.is_err());

    if let Err(err) = result {
        assert!(err.to_string().contains("No connection found"));
    }
}

#[tokio::test]
async fn test_engine_registry_connect_unsupported_engine() {
    let registry = EngineRegistry::new();

    // MySQL is defined but not yet implemented
    let config = ConnectionConfig {
        id: "test-id".to_string(),
        name: "Test".to_string(),
        engine_type: EngineType::Mysql,
        path: None,
        host: None,
        port: None,
        username: None,
        password: None,
        database: None,
        auth_token: None,
        ssl_mode: None,
        tag: None,
    };

    let result: EngineResult<String> = registry.connect(config).await;
    assert!(result.is_err());

    let err: EngineError = result.unwrap_err();
    assert!(err.to_string().contains("Unsupported engine"));
}

#[tokio::test]
async fn test_engine_registry_updates_connection_tag() {
    let registry = EngineRegistry::new();
    let temp_path = std::env::temp_dir().join("test_vibedb_tag_sync.db");
    let mut config = ConnectionConfig::sqlite(
        "test-tag-sync".to_string(),
        "Test Tag Sync".to_string(),
        temp_path.to_string_lossy().to_string(),
    );
    config.tag = Some(ConnectionTag::Production);

    registry.connect(config).await.unwrap();
    assert_eq!(
        registry.get_connection_tag("test-tag-sync").await.unwrap(),
        Some(ConnectionTag::Production)
    );

    registry
        .set_connection_tag("test-tag-sync", Some(ConnectionTag::Development))
        .await
        .unwrap();

    assert_eq!(
        registry.get_connection_tag("test-tag-sync").await.unwrap(),
        Some(ConnectionTag::Development)
    );

    registry.disconnect("test-tag-sync").await.unwrap();
    let _ = std::fs::remove_file(&temp_path);
}
