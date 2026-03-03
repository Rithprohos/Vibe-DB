# VibeDB — Agent Context

> **Purpose**: This file provides essential context for future AI agent sessions working on VibeDB. Read this first before making changes.

## Project Overview

**VibeDB** is an open-source, cross-platform database management app built with **Tauri v2** (Rust backend + React/TypeScript frontend). Currently in **Phase 1** (SQLite only). PostgreSQL support is planned for Phase 2.

- **Repo**: `/Users/a1234/Documents/Project/vibe-db`
- **Package manager**: `bun`
- **Dev command**: `bun run tauri dev`
- **Identifier**: `com.vibedb.app`

---

## Tech Stack

| Layer     | Technology                                | Notes                                             |
| --------- | ----------------------------------------- | ------------------------------------------------- |
| Backend   | Rust + Tauri v2                           | Commands in `src-tauri/src/lib.rs`                |
| Frontend  | React 19 + TypeScript                     | Vite dev server on port 1420                      |
| State     | Zustand 5                                 | `src/store/useAppStore.ts`, connections persisted |
| DB access | `rusqlite` (bundled)                      | Direct SQLite via custom Tauri commands           |
| Plugins   | `tauri-plugin-sql`, `tauri-plugin-dialog` | SQL + file picker                                 |
| Styling   | Vanilla CSS                               | Single file: `src/index.css`, CSS variables       |
| Fonts     | Inter (UI) + JetBrains Mono (data)        | Google Fonts import                               |

---

## Architecture

```
src/
├── App.tsx                  # Main layout, connection handler, tab routing
├── main.tsx                 # React entry point
├── index.css                # ENTIRE design system (1140 lines)
├── store/useAppStore.ts     # Zustand — connections, tabs, tables, selection
├── lib/db.ts                # Tauri invoke wrappers (typed)
└── components/
    ├── Sidebar.tsx           # DB explorer tree, search, quick actions
    ├── TabBar.tsx            # Multi-tab with close/add
    ├── StatusBar.tsx         # Connection status, counts, version
    ├── WelcomeScreen.tsx     # Pre-connection landing page
    ├── ConnectionDialog.tsx  # SQLite file picker + create new DB
    ├── TableView.tsx         # Data grid with pagination + sorting
    ├── TableStructure.tsx    # Column definitions view
    └── QueryEditor.tsx       # SQL editor with results panel

src-tauri/
├── src/lib.rs               # 5 Tauri commands (see below)
├── src/main.rs               # Binary entry
├── Cargo.toml               # rusqlite (bundled), tauri plugins
├── tauri.conf.json           # App config, window 1200x800
└── capabilities/default.json # Permissions: sql, dialog
```

---

## Tauri Commands (Rust → Frontend)

| Command               | Parameters            | Returns           | Description                                          |
| --------------------- | --------------------- | ----------------- | ---------------------------------------------------- |
| `list_tables`         | `db_path: String`     | `Vec<TableInfo>`  | Lists tables and views from `sqlite_master`          |
| `get_table_structure` | `db_path, table_name` | `Vec<ColumnInfo>` | Column info via `PRAGMA table_info`                  |
| `execute_query`       | `db_path, query`      | `QueryResult`     | Runs any SQL, returns columns+rows or affected count |
| `get_table_row_count` | `db_path, table_name` | `i64`             | `SELECT COUNT(*)` for pagination                     |
| `create_database`     | `db_path: String`     | `String`          | Creates empty SQLite file with WAL mode              |

---

## Key Design Decisions

1. **Direct `rusqlite` instead of only `tauri-plugin-sql`**: We use `rusqlite` directly for commands like `list_tables` and `get_table_structure` because the SQL plugin doesn't expose schema introspection. The SQL plugin is still registered but the custom commands do most of the work.

2. **Custom events for connection flow**: `ConnectionDialog` and `WelcomeScreen` dispatch `vibedb:connect` custom events. `App.tsx` listens and calls `listTables` + opens a query tab. This decouples the connection UI from the app shell.

3. **Tab-driven content**: Everything in the main content area is a tab. Tab types: `data`, `structure`, `query`. The `openTableTab` store action deduplicates — won't open the same table+type twice.

4. **Auto-refresh after DDL**: `QueryEditor` detects `CREATE`/`DROP`/`ALTER` statements and auto-refreshes the sidebar table list after successful execution.

5. **CSS only, no CSS-in-JS**: All styles are in `src/index.css` using CSS variables. This keeps the design system centralized and avoids bundle bloat.

---

## UX Audit Notes (Current State)

### ✅ What's Working Well

- Welcome screen is polished — gradient logo with float animation, clear CTA
- Dark theme with proper layered surfaces (primary → secondary → tertiary)
- Status bar with neon green connection dot
- Tab system with accent-colored active indicator
- Data grid with NULL/number/boolean color coding

### ⚠️ Known Issues to Fix

- **Emojis as icons** — All icons are emojis (📋⚡🔄👁). Replace with proper SVG icon library (Lucide, Phosphor, or Tabler)
- **No drag-to-resize** — Sidebar width is fixed at 260px. Should be resizable
- **Query editor is a plain textarea** — No syntax highlighting. Should upgrade to CodeMirror 6
- **No keyboard shortcuts** — Only ⌘+Enter works. Need shortcut for new tab, close tab, switch tabs
- **No context menu** — Right-clicking a table should offer options (view data, structure, drop, rename)
- **No data export** — Can't export query results to CSV/JSON
- **No dark mode toggle** — Currently dark-only (which is fine for v1, but good to plan)
- **Connection dialog lacks test button** — Should verify connection before saving
- **No inline cell editing** — Can view data but can't edit it inline

---

## Phase 2 Roadmap

- [ ] PostgreSQL support (connection string, pg-specific schema queries)
- [ ] SVG icon system (replace all emoji icons)
- [ ] CodeMirror 6 SQL editor with syntax highlighting + autocomplete
- [ ] Resizable sidebar and editor panels
- [ ] Context menus on database objects
- [ ] Inline cell editing (click to edit, Enter to save)
- [ ] Data export (CSV, JSON, SQL INSERT)
- [ ] Keyboard shortcuts (⌘+T new tab, ⌘+W close, ⌘+1-9 switch)
- [ ] Connection testing before save
- [ ] Table creation wizard UI (not just raw SQL)
- [ ] Query history panel

---

## How to Run

```bash
cd /Users/a1234/Documents/Project/vibe-db
bun install          # Install JS dependencies
bun run tauri dev    # Start dev (compiles Rust + Vite HMR)
```

First Rust compile takes ~2-3 minutes (477 crates). Subsequent rebuilds are fast (~2-15s).

---

## Style Guide

See [STYLE_GUIDE.md](file:///Users/a1234/Documents/Project/vibe-db/STYLE_GUIDE.md) for the complete visual design system including colors, typography, spacing, component rules, and animation guidelines.
