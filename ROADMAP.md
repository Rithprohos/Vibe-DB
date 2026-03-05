# VibeDB Engine Roadmap

Multi-database engine support for VibeDB.

## Current State (v0.2.4)

| Database | Status    | Notes                   |
| -------- | --------- | ----------------------- |
| SQLite   | ✅ Stable | Full support via `sqlx` |

### SQLite Commands

- `connect_database` — Connect to a SQLite database
- `disconnect_database` — Disconnect from database
- `set_active_connection` — Set active connection for queries
- `list_tables` — Get all tables/views
- `get_table_structure` — Column definitions
- `execute_query` — Run SQL queries (with safety validation)
- `get_table_row_count` — Pagination support
- `create_database` — Create new SQLite file
- `get_database_version` — Retrieve SQLite version

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

## ✅ Phase 1: Engine Abstraction (v0.2) — COMPLETE

Refactored backend to support multiple database drivers.

### Completed Tasks

- [x] Create `DatabaseEngine` trait abstraction
- [x] Implement engine registry pattern
- [x] Abstract connection configuration
- [x] Unify query result types across engines
- [x] Migrate from `rusqlite` to `sqlx`
- [x] Connection management by ID

### Architecture

```
src-tauri/src/engines/
├── mod.rs          # EngineRegistry - manages connections
├── traits.rs       # DatabaseEngine trait
├── types.rs        # ConnectionConfig, TableInfo, ColumnInfo, QueryResult
└── sqlite.rs       # SQLite implementation
```

---

## Phase 1.5: SQLite UX Polish (v0.2.x)

Essential SQLite management features before multi-engine support.

### Table Management

| Feature              | Priority         | Description                                                                                         |
| -------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| Create Table Wizard  | ✅ Done (v0.2.3) | Visual table builder with column types, constraints, defaults, SQL preview with syntax highlighting |
| Inline Data Edit     | ✅ Done (v0.2.3) | Click cell → edit → save directly in table view                                                     |
| Edit Table Structure | Medium           | Add/drop columns, modify types/constraints                                                          |
| Schema Viewer (ERD)  | Medium           | Visual diagram of tables and relationships                                                          |
| Index Manager        | Low              | View existing indexes, create new ones                                                              |

### Data Operations

| Feature              | Priority         | Description                                                           |
| -------------------- | ---------------- | --------------------------------------------------------------------- |
| Filter Query Builder | ✅ Done (v0.2.3) | Visual WHERE clause builder with multiple conditions, BETWEEN support |
| Import Data          | Medium           | CSV, JSON, SQL file import                                            |
| Export Data          | Medium           | Export table/query results as CSV, JSON, SQL                          |
| Backup/Restore       | Low              | One-click database backup and restore                                 |

### Query Management

| Feature         | Priority | Description                                                              |
| --------------- | -------- | ------------------------------------------------------------------------ |
| Saved Queries   | High     | Save queries to library with name/description, persisted across sessions |
| Query Folders   | Medium   | Organize saved queries into folders/categories                           |
| Query Templates | Low      | Pre-built queries for common operations (create table, insert, etc.)     |

### Workspace

| Feature                | Priority         | Description                                                                                              |
| ---------------------- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| Tabs Context Menu      | ✅ Done (v0.2.3) | Right-click on tabs to close, close others, or close all                                                 |
| Connection Tags        | ✅ Done (v0.2.3) | Environment labels: local, testing, development, production                                              |
| Editable Names         | ✅ Done (v0.2.3) | Edit connection names and tags without reconnecting                                                      |
| Database Version       | ✅ Done (v0.2.3) | Display engine version (e.g., SQLite v3.x) in TopBar                                                     |
| Disconnect / Reconnect | ✅ Done (v0.2.3) | Close connection without losing saved data, reconnect from sidebar                                       |
| Saved Connections List | ✅ Done (v0.2.3) | Sidebar shows all saved connections when disconnected (name, type, tag)                                  |
| Keyboard Shortcuts     | ✅ Done (v0.2.3) | ⌘N new connection, ⌘W close tab, ⌘T new query, ⌘L toggle logs, ⌘, settings, ⌘↵ execute (selected or all) |
| Settings Modal         | ✅ Done (v0.2.3) | Keybindings reference panel accessible via ⌘, or settings icon                                           |
| Theme Switching        | ✅ Done (v0.2.3) | Dark, Light, Purple Solarized themes with persisted preference                                           |
| Global Alert Modal     | ✅ Done (v0.2.4) | Theme-matched alert system for user feedback (success, error, warning, info) with store-based state      |

### Completed (v0.2.3)

- [x] Inline cell editing with save/cancel
- [x] Tabs context menu (close, close other, close all)
- [x] Editable connection names and tags
- [x] Database versioning support in backend and UI
- [x] Disconnect vs remove connection (preserve saved connection data)
- [x] Sidebar saved connections list when disconnected
- [x] Keyboard shortcuts (⌘N, ⌘W, ⌘T, ⌘L, ⌘,, ⌘↵)
- [x] Settings modal with keybindings reference
- [x] Theme switching (Dark, Light, Purple Solarized)
- [x] Create Table Wizard component with SQL preview and syntax highlighting
- [x] Filter Query builder with BETWEEN support and WHERE clause generation

### Completed in v0.2.4

- [x] Welcome screen shows exactly 2 recent connections (requires min 2 to display section)
- [x] Tabs cleared when closing connections (disconnect, close all, close others)
- [x] Invalid paths no longer auto-create databases (file existence check before connect)
- [x] Failed connections not persisted to store (addConnection after successful connect)
- [x] Global alert modal component with theme-matched styling (success, error, warning, info types)
- [x] Update check shows "up to date" alert when no updates available
- [x] Alert modal uses performance-optimized patterns (useRef for callbacks, proper cleanup)

### Upcoming Tasks

- [ ] ALTER TABLE support for structure changes
- [ ] Schema viewer with relationship lines
- [ ] Import dialog (CSV/JSON/SQL)
- [ ] Export dialog with format options
- [ ] Index viewer panel
- [ ] Saved queries panel in sidebar
- [ ] Save query dialog with name/description
- [ ] Query library with search/filter

### Testing

| Component           | Status     | Coverage                           |
| ------------------- | ---------- | ---------------------------------- |
| Engine types        | ✅ Done    | Unit tests for all data structures |
| Engine registry     | ✅ Done    | Connection/disconnect tests        |
| SQLite engine       | ✅ Done    | Full integration tests             |
| Frontend components | 📋 Planned | Vitest + React Testing Library     |

### Performance Optimizations

| Optimization         | Status           | Description                                                               |
| -------------------- | ---------------- | ------------------------------------------------------------------------- |
| Tab limit            | ✅ Done (v0.2.3) | Max 20 tabs, oldest auto-removed                                          |
| Result truncation    | ✅ Done (v0.2.3) | Max 1000 rows stored per result                                           |
| Zustand selectors    | ✅ Done (v0.2.3) | All components use granular selectors — no full-store destructuring       |
| Memoized components  | ✅ Done (v0.2.3) | QueryEditor, WelcomeScreen wrapped in `memo()`                            |
| Memoized derivations | ✅ Done (v0.2.3) | `useMemo` for `.find()` / `.filter()` operations across all components    |
| Stable effect deps   | ✅ Done (v0.2.3) | Primitive values as `useEffect` deps, not object references               |
| Stable callbacks     | ✅ Done (v0.2.3) | `useCallback` for handlers passed as props or used in effects             |
| Stable callback refs | ✅ Done (v0.2.4) | `useRef` pattern for callbacks to avoid stale closures                   |
| Async cleanup        | ✅ Done (v0.2.4) | `mounted` flag pattern for async event listener cleanup                  |
| Tab reuse            | ✅ Done (v0.2.3) | Opening same table reuses existing tab                                    |
| Performance rules    | ✅ Done (v0.2.3) | `.agents/workflows/performance-rules.md` — 15 enforceable rules (3 tiers) |
| Virtual scrolling    | 📋 Planned       | Render only visible rows for large result sets                            |
| Lazy tab loading     | 📋 Planned       | Don't render inactive tabs until switched                                 |

---

## Phase 2: Turso Support (v0.3)

[Turso](https://turso.tech/) — LibSQL/SQLite-compatible edge database.

| Feature                         | Priority |
| ------------------------------- | -------- |
| Connection via URL + Auth Token | High     |
| Embedded replica support        | Medium   |
| Sync status display             | Low      |

### Tasks

- [ ] Add `libsql` crate dependency
- [ ] Implement `TursoEngine` struct
- [ ] Support embedded replica mode
- [ ] Handle remote sync status
- [ ] Update connection dialog UI

### Dependencies

```toml
libsql = "0.x"
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

## Security Hardening (v0.2.x)

Security improvements for production readiness.

| Issue                              | Severity | Status      |
| ---------------------------------- | -------- | ----------- |
| No Content Security Policy (CSP)   | High     | 🔴 Critical |
| Unsafe query execution             | Medium   | ✅ Fixed    |
| Connection paths in localStorage   | Low      | ✅ Fixed    |
| Broad Tauri capability permissions | Low      | 🟡 Review   |
| No AI data guardrails              | Low      | 🟢 Deferred |

### Completed (v0.2.3)

- [x] Migrate state persistence from `localStorage` to `tauri-plugin-store` (`app_settings.json`)
- [x] Set up `tauri-plugin-stronghold` for encrypted credential vault (Argon2id + XChaCha20-Poly1305)
- [x] Add connection environment tags (local, testing, development, production)
- [x] Register store and stronghold permissions in Tauri capabilities
- [x] Query safety validation — block DELETE/UPDATE without WHERE, tautological WHERE clauses (e.g., `WHERE 1=1`, `OR 1=1`)

### Upcoming Tasks (v0.2.4 & Beyond)

- [ ] Implement strict CSP in `tauri.conf.json`
- [ ] Audit Tauri capabilities (remove unused permissions)
- [ ] Document security posture in README

### Storage Architecture (Implemented)

| Storage                   | File                | Purpose                                    |
| ------------------------- | ------------------- | ------------------------------------------ |
| `tauri-plugin-store`      | `app_settings.json` | Connection metadata, tags, preferences     |
| `tauri-plugin-stronghold` | `credentials.hold`  | Encrypted passwords, auth tokens, API keys |

### Secure Credential Storage (Ready for v0.3+)

Stronghold vault is installed and configured. When remote engines land, credentials will be stored securely:

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
- [x] Query builder (visual) — Filter query builder in Data tab with WHERE clause support

---

## Timeline (Estimated)

| Version | Target  | Focus                | Status         |
| ------- | ------- | -------------------- | -------------- |
| v0.2    | Q1 2026 | Engine abstraction   | ✅ Complete    |
| v0.2.3  | Q1 2026 | Security + UX polish | ✅ Complete    |
| v0.2.4  | Q1 2026 | Bug fixes + Alerts   | ✅ Complete    |
| v0.3    | Q2 2026 | Turso support        | 📋 Planned     |
| v0.4    | Q3 2026 | PostgreSQL           | 📋 Planned     |
| v0.5    | Q4 2026 | MySQL                | 📋 Planned     |

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
