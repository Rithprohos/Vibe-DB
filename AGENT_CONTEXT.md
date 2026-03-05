# VibeDB — Agent Context

> **Purpose**: This file provides essential context for future AI agent sessions working on VibeDB. Read this first before making changes.

## Project Overview

**VibeDB** is an open-source, cross-platform database management app built with **Tauri v2** (Rust backend + React/TypeScript frontend). Currently supports SQLite with a trait-based engine architecture designed for multi-database support (Turso, PostgreSQL, MySQL planned).

- **Repo**: `/Users/a1234/Documents/Project/vibe-db`
- **Package manager**: `bun`
- **Dev command**: `bun run tauri dev` (or `bun run tdev`)
- **Identifier**: `com.vibedb.app`

---

## Tech Stack

| Layer     | Technology                                | Notes                                             |
| --------- | ----------------------------------------- | ------------------------------------------------- |
| Backend   | Rust + Tauri v2                           | Commands in `src-tauri/src/lib.rs`                |
| Frontend  | React 19 + TypeScript                     | Vite dev server on port 1420                      |
| State     | Zustand 5 + Tauri Store                   | `src/store/useAppStore.ts`, persisted via plugin |
| DB access | Trait-based `DatabaseEngine`             | `src-tauri/src/engines/` — SqliteEngine implemented |
| Plugins   | `sql`, `dialog`, `store`, `stronghold`, `opener` | SQL, file picker, persistence, secrets, opener    |
| Styling   | Tailwind + shadcn/ui + CSS variables      | Radix primitives, `src/index.css` for vars        |
| Icons     | Lucide React                              | SVG icons, no emojis                              |
| Fonts     | Inter (UI) + JetBrains Mono (data)        | Google Fonts import                               |
| Editor    | CodeMirror 6                              | SQL syntax highlighting via `@codemirror/lang-sql`|

---

## Architecture

```
src/
├── App.tsx                  # Main layout, connection handler, tab routing
├── main.tsx                 # React entry point
├── index.css                # CSS variables design system (~1100 lines)
├── store/useAppStore.ts     # Zustand — connections, tabs, tables, logs, theme
├── lib/
│   ├── db.ts                # Tauri invoke wrappers (typed)
│   ├── formatters.ts        # Cell value formatting utilities
│   └── utils.ts             # cn() helper for Tailwind
└── components/
    ├── Sidebar.tsx           # DB explorer tree, resizable, search, context menu
    ├── TabBar.tsx            # Multi-tab with close/add
    ├── StatusBar.tsx         # Connection status, counts, version
    ├── TopBar.tsx            # App header with actions
    ├── DatabaseBar.tsx       # Active connection info bar
    ├── WelcomeScreen.tsx     # Pre-connection landing page
    ├── EmptyTabScreen.tsx    # No tabs open placeholder
    ├── ConnectionDialog.tsx  # SQLite file picker + create new DB
    ├── EditConnectionDialog.tsx # Edit connection name/tag
    ├── TableView.tsx         # Data grid with pagination + sorting
    ├── TableStructure.tsx    # Column definitions view
    ├── QueryEditor.tsx       # CodeMirror SQL editor with results panel
    ├── AiPanel.tsx           # AI assistant panel
    ├── LogDrawer.tsx         # SQL query history drawer
    ├── SettingsModal.tsx     # App settings modal
    └── ui/                   # shadcn/ui primitives
        ├── button.tsx
        ├── input.tsx
        ├── dialog.tsx
        ├── dropdown-menu.tsx
        ├── context-menu.tsx
        ├── tooltip.tsx
        ├── tabs.tsx
        ├── scroll-area.tsx
        ├── table.tsx
        ├── checkbox.tsx
        └── label.tsx

src-tauri/
├── src/
│   ├── lib.rs               # 9 Tauri commands (see below)
│   ├── main.rs              # Binary entry
│   └── engines/
│       ├── mod.rs           # Module exports, EngineRegistry
│       ├── traits.rs        # DatabaseEngine trait definition
│       ├── types.rs         # EngineType, ConnectionConfig, TableInfo, etc.
│       └── sqlite.rs        # SqliteEngine implementation
├── Cargo.toml               # sqlx, tokio, async-trait, tauri plugins
├── tauri.conf.json          # App config, window 1200x800
└── capabilities/default.json # Permissions: sql, dialog, store, stronghold
```

---

## Tauri Commands (Rust → Frontend)

| Command               | Parameters                    | Returns           | Description                                          |
| --------------------- | ----------------------------- | ----------------- | ---------------------------------------------------- |
| `connect_database`    | `path, name`                  | `String`          | Connects to SQLite, returns connection ID            |
| `disconnect_database` | `conn_id`                     | `()`              | Disconnects and cleans up resources                  |
| `set_active_connection`| `conn_id`                    | `()`              | Sets active connection for subsequent queries        |
| `list_tables`         | `conn_id?`                    | `Vec<TableInfo>`  | Lists tables and views                               |
| `get_table_structure` | `conn_id?, table_name`        | `Vec<ColumnInfo>` | Column info via `PRAGMA table_info`                   |
| `execute_query`       | `conn_id?, query`             | `QueryResult`     | Runs any SQL, returns columns+rows or affected count |
| `get_table_row_count` | `conn_id?, table_name`         | `i64`             | `SELECT COUNT(*)` for pagination                     |
| `create_database`     | `db_path`                     | `String`          | Creates empty SQLite file with WAL mode              |
| `get_database_version`| `conn_id?`                    | `String`          | Returns database version string                      |

All commands accept optional `conn_id` — if omitted, uses the active connection.

---

## Backend Architecture: DatabaseEngine Trait

The backend uses a trait-based architecture for multi-database support:

```rust
// src-tauri/src/engines/traits.rs
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

**EngineRegistry** manages multiple connections:
- `connect(config)` — registers a new engine instance
- `disconnect(id)` — removes and cleans up
- `get_engine(id)` — retrieves engine for queries

**EngineType enum** (prepared for future):
- `Sqlite` (implemented)
- `Turso` (planned)
- `Postgres` (planned)
- `Mysql` (planned)

---

## Key Design Decisions

1. **Trait-based engine architecture**: `DatabaseEngine` trait allows plugging in different database backends. `SqliteEngine` uses `sqlx` with async Tokio runtime. EngineRegistry manages connection lifecycle.

2. **Multi-connection support**: The app tracks multiple connections via `tablesByConnection: Record<string, TableInfo[]>`. Each tab is associated with a `connectionId`.

3. **Tauri Store for persistence**: Uses `tauri-plugin-store` via Zustand's custom storage adapter. Connections, tabs, and theme persist across sessions.

4. **shadcn/ui components**: Radix-based primitives for dialogs, dropdowns, context menus, tooltips. Styled via Tailwind + CSS variables.

5. **CodeMirror 6 for SQL**: Query editor uses `@uiw/react-codemirror` with `@codemirror/lang-sql`. Resizable editor panel.

6. **Resizable sidebar**: Drag-to-resize sidebar width with smooth rAF-based updates.

7. **Context menus**: Right-click tables in sidebar for actions (view data, structure, drop, etc.) via Radix context-menu.

8. **CSS variables for theming**: All colors defined as CSS variables in `index.css`. Theme support (dark/light/purple) via `theme` state.

---

## State Management (Zustand)

Key state slices in `useAppStore.ts`:

```typescript
interface AppState {
  // Connections
  connections: Connection[];           // Saved connection configs
  activeSidebarConnectionId: string | null;
  isConnected: boolean;

  // Database objects (per-connection)
  tablesByConnection: Record<string, TableInfo[]>;
  selectedTable: string | null;

  // Tabs
  tabs: Tab[];
  activeTabId: string | null;

  // Logs
  logs: SqlLog[];
  showLogDrawer: boolean;

  // Settings
  showSettingsModal: boolean;
  theme: "dark" | "light" | "purple";

  // AI
  isAiPanelOpen: boolean;

  // Metadata
  databaseVersion: string | null;
}
```

**Constants**: `MAX_RESULT_ROWS = 1000`, `MAX_TABS = 20`, `MAX_ACTIVE_CONNECTIONS = 5`

---

## How to Run

```bash
cd /Users/a1234/Documents/Project/vibe-db
bun install          # Install JS dependencies
bun run tauri dev    # Start dev (compiles Rust + Vite HMR)
```

First Rust compile takes ~2-3 minutes. Subsequent rebuilds are fast (~2-15s).

---

## Style Guide

See [STYLE_GUIDE.md](./STYLE_GUIDE.md) for the complete visual design system including colors, typography, spacing, component rules, and animation guidelines.