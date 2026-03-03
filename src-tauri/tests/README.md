# Tests

Integration tests for the VibeDB Rust backend.

## Running Tests

```bash
# From project root
bun run cargo:test

# Or directly
cd src-tauri && cargo test
```

## Test Organization

| File | Purpose |
|------|---------|
| `types_tests.rs` | Data structure tests (TableInfo, ColumnInfo, etc.) |
| `engine_registry_tests.rs` | Connection registry and error handling |
| `sqlite_engine_tests.rs` | SQLite engine functionality |

## Guidelines

- Tests use temporary SQLite files in system temp directory (auto-cleaned)
- Async tests use `#[tokio::test]` for engine operations
- Tests should be independent (no shared state between tests)
- Each test file imports from `vibe_db_lib::engines` via public re-exports
