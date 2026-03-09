# VibeDB Engine Roadmap

<p align="center">
  <a href="./README.md">🏠 Overview</a> &nbsp;•&nbsp;
  <a href="./ROADMAP.md"><b>🗺️ Roadmap</b></a> &nbsp;•&nbsp;
  <a href="https://github.com/Rithprohos/vibe-db/releases">🚀 Releases</a> &nbsp;•&nbsp;
  <a href="./changelog/">📜 Changelog</a> &nbsp;•&nbsp;
  <a href="./LICENSE">⚖️ License</a>
</p>

---

Multi-database engine support for VibeDB.

## Current State (v0.3.0)

| Database | Status    | Notes                     |
| -------- | --------- | ------------------------- |
| SQLite   | ✅ Stable | Full support via `sqlx`   |
| Turso    | ✅ Stable | Full support via `libsql` |

### SQLite Commands

- `connect_database` — Connect to a SQLite database
- `disconnect_database` — Disconnect from database
- `set_active_connection` — Set active connection for queries
- `list_tables` — Get all tables/views
- `get_table_structure` — Column definitions
- `execute_query` — Run SQL queries (with safety validation)
- `execute_transaction` — Run batched DML statements atomically
- `get_table_row_count` — Pagination support
- `create_database` — Create new SQLite file
- `get_database_version` — Retrieve SQLite version
- `build_create_table_sql` — Generate validated `CREATE TABLE` SQL from structured input
- `build_create_view_sql` — Generate validated `CREATE VIEW` SQL from structured input

### Query Safety (Implemented)

Blocked patterns:

- `DELETE` / `UPDATE` without `WHERE` clause
- Tautological `WHERE` conditions (`1=1`, `'a'='a'`, `TRUE`)
- `OR` injection patterns (`OR 1=1`)

### Architecture (Implemented)

```rust
#[async_trait]
pub trait DatabaseEngine: Send + Sync {
    async fn connect(&self, config: &ConnectionConfig) -> EngineResult<()>;
    async fn disconnect(&self);
    async fn is_connected(&self) -> bool;
    async fn list_tables(&self) -> EngineResult<Vec<TableInfo>>;
    async fn get_table_structure(&self, table_name: &str) -> EngineResult<Vec<ColumnInfo>>;
    async fn execute_query(&self, query: &str) -> EngineResult<QueryResult>;
    async fn get_table_row_count(&self, table_name: &str) -> EngineResult<i64>;
    async fn create_database(&self, path: &str) -> EngineResult<String>;
    async fn get_version(&self) -> EngineResult<String>;
}
```

---

## Phase 1.5: SQLite UX Polish (v0.2.x)

See [`changelog/`](./changelog/) for completed features.

### Table Management

| Feature              | Priority | Description                                |
| -------------------- | -------- | ------------------------------------------ |
| Edit Table Structure | Medium   | Add/drop columns, modify types/constraints |
| Schema Viewer (ERD)  | Medium   | Visual diagram of tables and relationships |
| Index Manager        | Low      | View existing indexes, create new ones     |

### Data Operations

| Feature        | Priority | Description                                  |
| -------------- | -------- | -------------------------------------------- |
| Import Data    | Medium   | CSV, JSON, SQL file import                   |
| Export Data    | Medium   | Export table/query results as CSV, JSON, SQL |
| Backup/Restore | Low      | One-click database backup and restore        |

### Query Management

| Feature         | Priority | Description                                                              |
| --------------- | -------- | ------------------------------------------------------------------------ |
| Saved Queries   | High     | Save queries to library with name/description, persisted across sessions |
| Query Folders   | Medium   | Organize saved queries into folders/categories                           |
| Query Templates | Low      | Pre-built queries for common operations (create table, insert, etc.)     |

### Completed in v0.3.0

- [x] Dedicated Create View tab shipped from the sidebar Views flow instead of opening a generic query template
- [x] Create View now includes validated metadata fields (`View Name`, `TEMP`, `IF NOT EXISTS`) plus generated SQL preview
- [x] Create View source query upgraded to CodeMirror with SQL syntax highlighting for consistency with Query Editor
- [x] Manual view preview added with limited sample rows before executing `CREATE VIEW`
- [x] Create View draft now survives tab switching without resetting, while typing stays responsive by avoiding persisted-store writes on each keystroke
- [x] Shortened environment tags in DatabaseBar (`PROD`, `DEV`, `TEST`) to prevent layout overflow in narrow view

### Upcoming Tasks

**AI Panel Improvements**

- [ ] Add related tables support for JOIN queries (detect FK relationships)
- [ ] Show generated SQL explanation/comments alongside the query
- [ ] Add "Copy SQL" button in addition to "Insert into Editor"
- [ ] Allow custom temperature/max_tokens in AI settings
- [ ] Cache generated SQL suggestions per table for quick reuse
- [ ] Add SQL validation before inserting (check if query is valid for current schema)

- [ ] Schema viewer with relationship lines
- [ ] Import dialog (CSV/JSON/SQL)
- [ ] Export dialog with format options
- [ ] Index viewer panel
- [ ] Saved queries panel in sidebar
- [ ] Save query dialog with name/description
- [ ] Query library with search/filter

**Performance & UI Polish**

- [ ] Tune virtualization overscan and estimated row heights per view
- [ ] Replace TableView spacer-row virtualization with absolutely positioned rows
- [ ] Add QueryEditor performance pass (syntax highlight + memoized parse path)
- [ ] Add QueryEditor result column resizing and responsive inspector behavior
- [ ] Extend Rust-emitted SQL logging to schema introspection paths (`list_tables`, etc.)
- [ ] Add frontend performance tests (Vitest + RTL) for large datasets
- [ ] Cache table schema in Rust by `conn_id + table_name`
- [ ] Keep pagination/filter/sort execution fully in Rust commands
- [ ] Add prepared statements for repeated table patterns
- [ ] Return typed rows with reusable column metadata maps
- [ ] Debounce UI-triggered query refreshes
- [ ] Keep metadata fetches separate from row fetches
- [ ] Add index recommendation flow with one-click `CREATE INDEX` assistance
- [ ] Expand Rust-side command timing instrumentation

**Security & Infrastructure**

- [ ] Implement strict CSP in `tauri.conf.json`
- [ ] Audit Tauri capabilities (remove unused permissions)
- [ ] Document security posture in README

### Testing

| Component           | Status     | Coverage                           |
| ------------------- | ---------- | ---------------------------------- |
| Engine types        | ✅ Done    | Unit tests for all data structures |
| Engine registry     | ✅ Done    | Connection/disconnect tests        |
| SQLite engine       | ✅ Done    | Full integration tests             |
| Turso engine        | ✅ Done    | Full implementation + UI complete  |
| Frontend components | 📋 Planned | Vitest + React Testing Library     |

---

## Phase 2: Turso Support (v0.3.0) ✅ Complete

[Turso](https://turso.tech/) — LibSQL/SQLite-compatible edge database.

| Feature                         | Priority | Status         |
| ------------------------------- | -------- | -------------- |
| Connection via URL + Auth Token | High     | ✅ Implemented |
| Local libSQL file support       | High     | ✅ Implemented |
| Embedded replica support        | Medium   | 📋 Planned     |
| Sync status display             | Low      | 📋 Planned     |

### Turso Commands

- `connect_database` — Connect to remote Turso or local libSQL file
- `disconnect_database` — Disconnect from database
- `execute_query` — Run SQL queries (with safety validation)
- `execute_transaction` — Run batched DML statements atomically
- `list_tables` — Get all tables/views
- `get_table_structure` — Column definitions
- `get_table_row_count` — Pagination support
- `create_database` — Create new local libSQL file
- `get_database_version` — Retrieve libSQL version

### Implementation

**File:** `src-tauri/src/engines/turso.rs`

```rust
pub struct TursoEngine {
    connection: RwLock<Option<Connection>>,
    db_path: RwLock<Option<String>>,
}
```

### Tasks

- [x] Add `libsql` crate dependency
- [x] Implement `TursoEngine` struct
- [x] Support remote connections with auth token
- [x] Support local libSQL file connections
- [ ] Support embedded replica mode
- [x] Handle remote sync status
- [x] Update connection dialog UI

### Dependencies

```toml
libsql = "0.9.5"
```

### Usage

```rust
// Remote Turso database
let config = ConnectionConfig::turso_remote(
    "conn-id".to_string(),
    "My Turso DB".to_string(),
    "my-db.turso.io".to_string(),
    "my-auth-token".to_string(),
);

// Local libSQL file
let config = ConnectionConfig::turso_local(
    "conn-id".to_string(),
    "Local libSQL".to_string(),
    "/path/to/db.libsql".to_string(),
);
```

---

## Phase 3: PostgreSQL Support (v0.4)

Full PostgreSQL database support.

| Feature                          | Priority |
| -------------------------------- | -------- |
| Connection via connection string | High     |
| Schema browser                   | High     |
| SSL/TLS support                  | High     |
| Custom port/host                 | Medium   |
| SSH tunnel                       | Low      |

### Tasks

- [ ] Add `sqlx` postgres feature
- [ ] Implement `PostgresEngine` struct
- [ ] Handle PostgreSQL-specific types (JSON, arrays, etc.)
- [ ] Schema support (multi-schema browsing)
- [ ] Connection pooling

### Dependencies

```toml
sqlx = { version = "0.8", features = ["postgres", "runtime-tokio-native-tls"] }
```

---

## Phase 4: MySQL Support (v0.5)

MySQL and MariaDB support.

| Feature                          | Priority |
| -------------------------------- | -------- |
| Connection via connection string | High     |
| Schema browser                   | High     |
| SSL support                      | Medium   |
| MariaDB compatibility            | Medium   |

### Tasks

- [ ] Add `sqlx` MySQL feature
- [ ] Implement `MySQLEngine` struct
- [ ] Handle MySQL-specific types
- [ ] Support multiple character sets

### Dependencies

```toml
sqlx = { version = "0.8", features = ["mysql", "runtime-tokio-native-tls"] }
```

---

## Security Hardening

Security improvements for production readiness.

| Issue                                 | Severity | Status      |
| ------------------------------------- | -------- | ----------- |
| No Content Security Policy (CSP)      | High     | 🔴 Critical |
| Unsafe query execution                | Medium   | ✅ Fixed    |
| Connection paths in localStorage      | Low      | ✅ Fixed    |
| Broad Tauri capability permissions    | Low      | 🟡 Review   |
| Stronghold unlock secret is app-known | Medium   | 🟡 Review   |
| No AI data guardrails                 | Low      | 🟢 Deferred |

### Storage Architecture (Implemented)

| Storage                   | File                | Purpose                                |
| ------------------------- | ------------------- | -------------------------------------- |
| `tauri-plugin-store`      | `app_settings.json` | Connection metadata, tags, preferences |
| `tauri-plugin-stronghold` | `ai-config.hold`    | Encrypted AI API keys snapshot         |

### Security Caveat (Current v0.2.8)

The Stronghold integration now persists and reloads API keys correctly, but it does not yet provide strong machine-bound secret protection. The current unlock string is app-known, so the snapshot is encrypted at rest but not protected by an OS keychain secret or user-supplied master password. Treat this as a reliability milestone, not a final security posture.

### Secure Credential Storage (Ready for v0.3+)

Stronghold vault plumbing is installed and working for AI keys. Before using it for remote-engine passwords/tokens, the unlock model should be upgraded to an OS-backed secret or user-provided passphrase:

| Engine     | Sensitive Data                |
| ---------- | ----------------------------- |
| Turso      | Auth tokens                   |
| PostgreSQL | Passwords, connection strings |
| MySQL      | Passwords, connection strings |

### CSP Configuration (Target)

```json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  }
}
```

---

## Future Considerations

### Potential Engines

| Database   | Complexity | Use Case                      |
| ---------- | ---------- | ----------------------------- |
| ClickHouse | Medium     | Analytics                     |
| MongoDB    | Medium     | Document store                |
| Redis      | Low        | Key-value                     |
| DuckDB     | Low        | Analytics (SQLite-compatible) |

### Features to Consider

- [ ] Connection testing before save
- [ ] Connection groups/folders
- [ ] Import/export between engines
- [ ] Schema migration tools

---

## Timeline (Estimated)

| Version | Target  | Focus                     | Status      |
| ------- | ------- | ------------------------- | ----------- |
| v0.3.0  | Q1 2026 | Turso & UI Revitalization | ✅ Complete |
| v0.3.1  | Q2 2026 | Embedded replicas, UI     | 📋 Planned  |
| v0.4    | Q3 2026 | PostgreSQL                | 📋 Planned  |
| v0.5    | Q4 2026 | MySQL                     | 📋 Planned  |

---

## Contributing

Want to help implement an engine? Open an issue or PR with your target database.

### Engine Implementation Checklist

1. Implement `DatabaseEngine` trait in `src-tauri/src/engines/<engine>.rs`
2. Add `EngineType` variant to `types.rs`
3. Register engine in `EngineRegistry::connect()`
4. Add connection config UI in frontend
5. Handle engine-specific types
6. Write integration tests
