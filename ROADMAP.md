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

## Current State (v0.4.2)

| Database | Status    | Notes                     |
| -------- | --------- | ------------------------- |
| SQLite   | ✅ Stable | Full support via `sqlx`   |
| Turso    | ✅ Stable | Full support via `libsql` |
| Postgres | ✅ Stable | Full support via `sqlx`   |

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
- `delete_rows` — Delete rows by identifiers (SQL built in Rust, executed in transaction)

### Table View Features

- **Cell Editing** — Double-click to edit, Cmd/Ctrl+Enter to commit
- **New Row Insert** — Add record button with inline row input
- **Row Selection** — Checkbox multi-select with "select all" header
- **Row Deletion** — Delete selected rows with production confirmation, toast feedback, and pagination-safe refresh
- **Row Inspector** — Side panel for detailed row viewing/editing
- **Column Sorting** — Click headers to sort ASC/DESC
- **Column Resizing** — Drag column borders to resize
- **Filtering** — Multi-condition filter panel with operators

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

### Upcoming Tasks

**Backend SQL Generation (High Priority)**

Move SQL query building from frontend to backend for security and cleaner architecture:

- [x] Add `update_rows` command - Accept table name + column changes, build UPDATE queries in Rust
- [x] Add `insert_rows` command - Accept table name + row data, build INSERT queries in Rust
- [ ] Deprecate frontend SQL builders (`buildWhereClause`, `buildDeleteQueries`, etc.)
- [ ] Frontend becomes "UI only" - sends structured data, receives results

**AI Panel Improvements**

- [ ] Add related tables support for JOIN queries (detect FK relationships)
- [ ] Show generated SQL explanation/comments alongside the query
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
| Sync status display             | Low      | ✅ Implemented |

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

- [ ] Support embedded replica mode

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

## Phase 3: PostgreSQL Support (v0.4) ✅ Complete

Full PostgreSQL database support.

| Feature                          | Priority | Status         |
| -------------------------------- | -------- | -------------- |
| Connection via connection string | High     | ✅ Implemented |
| Schema browser                   | High     | ✅ Implemented |
| SSL/TLS support                  | High     | ✅ Implemented |
| Custom port/host                 | Medium   | ✅ Implemented |
| PostgreSQL type handling         | High     | ✅ Implemented |
| Database name in connected UI    | Medium   | ✅ Implemented |
| SSH tunnel                       | Low      | 📋 Planned     |

### PostgreSQL Datatype Support Matrix

| Data Type | Create/Edit UI | Read Decode (Rust) | Grid Display (React) | Status | Need To Do | Priority |
| --------- | -------------- | ------------------ | -------------------- | ------ | ---------- | -------- |
| INTEGER | ✅ Picker | ✅ `INT4 -> i64` | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| SMALLINT | ✅ Picker | ✅ Default scalar decode | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| BIGINT | ✅ Picker | ✅ `INT8 -> i64` | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| SERIAL | ✅ Picker | ✅ Reads back as integer | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| BIGSERIAL | ✅ Picker | ✅ Reads back as bigint | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| NUMERIC | ✅ Picker | ✅ String decode for precision safety | ✅ Scalar text render | ⚠️ Partial | Parameterized types: support `NUMERIC(p,s)` in Create/Edit UI | High |
| DOUBLE PRECISION | ✅ Picker | ✅ `FLOAT8` decode | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| MONEY | ✅ Picker | ✅ Default scalar decode (string path) | ✅ Scalar text render | ⚠️ Partial | Add PG integration test coverage for locale/format variations | Medium |
| BOOLEAN | ✅ Picker | ✅ `BOOL` decode | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| TEXT | ✅ Picker | ✅ String decode | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| VARCHAR | ✅ Picker | ✅ String decode | ✅ Scalar text render | ⚠️ Partial | Parameterized types: support `VARCHAR(n)` in Create/Edit UI | High |
| CHAR | ✅ Picker | ✅ String decode | ✅ Scalar text render | ⚠️ Partial | Parameterized types: support `CHAR(n)` in Create/Edit UI | Medium |
| BPCHAR | ✅ Picker | ✅ String decode | ✅ Scalar text render | ⚠️ Partial | Parameterized types: map/edit as fixed-length char alias in UI | Medium |
| XML | ✅ Picker | ✅ Default scalar decode (string path) | ✅ Scalar text render | ⚠️ Partial | Add integration coverage for large XML values | Low |
| UUID | ✅ Picker | ✅ Native `Uuid` decode + string fallback | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| DATE | ✅ Picker | ✅ Native date decode | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| TIME | ✅ Picker | ✅ Native time decode | ✅ Scalar text render | ⚠️ Partial | Parameterized types: support temporal precision in Create/Edit UI | High |
| TIMETZ | ✅ Picker | ✅ Decode (string fallback path) | ✅ Scalar text render | ⚠️ Partial | Verify/standardize timezone-preserving format + add tests | Medium |
| TIMESTAMP | ✅ Picker | ✅ Native timestamp decode | ✅ Scalar text render | ⚠️ Partial | Parameterized types: support temporal precision in Create/Edit UI | High |
| TIMESTAMPTZ | ✅ Picker | ✅ Native timestamptz decode | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| INTERVAL | ✅ Picker | ✅ Default scalar decode (string path) | ✅ Scalar text render | ⚠️ Partial | INTERVAL: verify/standardize decode + display formatting and add coverage | High |
| JSON | ✅ Picker | ✅ JSON decode to object/array | ✅ Pretty JSON display + JSON-aware edit | ✅ Supported | None (keep regression coverage) | Low |
| JSONB | ✅ Picker | ✅ JSONB decode to object/array | ✅ Pretty JSON display + JSON-aware edit | ✅ Supported | None (keep regression coverage) | Low |
| BYTEA | ✅ Picker | ✅ Decodes to placeholder text (`<BLOB n bytes>`) | ⚠️ Placeholder-only display | ⚠️ Partial | BYTEA: improve binary preview/inspection beyond placeholder text | High |
| INET | ✅ Picker | ✅ String decode | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| CIDR | ✅ Picker | ✅ String decode | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| MACADDR | ✅ Picker | ✅ String decode | ✅ Scalar text render | ✅ Supported | None (keep regression coverage) | Low |
| ARRAY (`type[]`) | ❌ Not in picker | ⚠️ Limited decode (`Vec<String|i64|f64>` only) | ⚠️ Unhandled array types can fall back to `NULL` | ⚠️ Partial | ARRAY: broaden decode beyond only `Vec<String|i64|f64>` and avoid null fallback for other array element types | High |

#### High-Priority Follow-Ups

- [ ] ARRAY: broaden PostgreSQL array decode and avoid null fallback for unsupported array element types
- [ ] Parameterized types: support `VARCHAR(n)`, `NUMERIC(p,s)`, and temporal precision in Create/Edit UI
- [ ] BYTEA: add binary preview/inspection UX (size + hex/text preview)
- [ ] INTERVAL: standardize decode/display formatting and add integration coverage

### Tasks

- [ ] Fix schema-qualified object follow-up (P2):
  Create/open flows still use bare names in some paths, so new Postgres tables/views can open under unqualified names and create duplicate tabs; rename no-op detection in `EditTable` also still compares leaf names against qualified names.
- [ ] Add PostgreSQL integration coverage for schema-qualified create/open/edit flows
- [ ] Add SSH tunnel support

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
| `tauri-plugin-stronghold` | `credentials.hold`  | Encrypted Turso auth token snapshot    |

### Security Caveat (Current v0.2.8)

The Stronghold integration now persists and reloads AI API keys and Turso auth tokens correctly, but it does not yet provide strong machine-bound secret protection. The current unlock string is app-known, so snapshots are encrypted at rest but not protected by an OS keychain secret or user-supplied master password. Treat this as a reliability milestone, not a final security posture.

### Secure Credential Storage (Ready for v0.3+)

Stronghold vault plumbing is installed and working for AI keys and Turso auth tokens. Before broadening this to remote-engine passwords/connection strings, the unlock model should be upgraded to an OS-backed secret or user-provided passphrase:

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
- [ ] Multi-window support (VS Code style) — allow multiple independent windows with shared connections but isolated tabs/active connection per window

---

## Timeline (Estimated)

| Version | Target  | Focus                     | Status      |
| ------- | ------- | ------------------------- | ----------- |
| v0.3.0  | Q1 2026 | Turso & UI Revitalization | ✅ Complete |
| v0.3.1  | Q2 2026 | Embedded replicas, UI     | 📋 Planned  |
| v0.4.0  | Q3 2026 | PostgreSQL                | ✅ Complete |
| v0.4.2  | March 2026 | PG Type UX & Json Edit    | ✅ Complete |
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
