# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeDB is a cross-platform SQLite database manager built with Tauri v2 (Rust) and React 19. It uses an extensible database engine abstraction to support multiple database types (SQLite now, Turso/PostgreSQL/MySQL planned).

**Package Manager:** bun

## Essential Commands

```bash
# Development
bun install          # Install dependencies (first time)
bun run dev          # Frontend dev server only (port 1420)
bun run tauri dev    # Full app (Rust + Vite HMR) — first compile ~2-3min
bun run tdev         # Alias for tauri dev

# Build & Typecheck
bun run build        # TypeScript check + Vite production build
bun run preview      # Preview production build locally
bun run tauri build  # Build Tauri app for distribution

# Testing
bun run cargo:test   # Run Rust backend tests
```

## High-Level Architecture

### Frontend-Backend Communication

Tauri commands are defined in `src-tauri/src/lib.rs` and wrapped in `src/lib/db.ts`:

| Command | Purpose |
|---------|---------|
| `connect_database` | Connect to SQLite file |
| `disconnect_database` | Close connection |
| `list_tables` | Get tables/views |
| `get_table_structure` | Column definitions |
| `execute_query` | Run SQL, return results |
| `create_database` | Create new SQLite file |

### Database Engine System (Rust)

Extensible trait-based architecture in `src-tauri/src/engines/`:

```rust
// traits.rs — Core abstraction
#[async_trait]
pub trait DatabaseEngine: Send + Sync {
    async fn connect(&self, config: &ConnectionConfig) -> EngineResult<()>;
    async fn disconnect(&self);
    async fn list_tables(&self) -> EngineResult<Vec<TableInfo>>;
    async fn get_table_structure(&self, table_name: &str) -> EngineResult<Vec<ColumnInfo>>;
    async fn execute_query(&self, query: &str) -> EngineResult<QueryResult>;
    async fn create_database(&self, path: &str) -> EngineResult<String>;
}
```

- `mod.rs` — `EngineRegistry` manages multiple connections by ID
- `sqlite.rs` — SQLite implementation via sqlx
- `types.rs` — Shared types: `ConnectionConfig`, `TableInfo`, `ColumnInfo`, `QueryResult`

### State Management (Zustand)

Single store in `src/store/useAppStore.ts`:

```typescript
interface AppState {
  connections: Connection[];           // Saved connections (persisted)
  activeSidebarConnectionId: string | null;
  tablesByConnection: Record<string, TableInfo[]>;
  tabs: Tab[];                         // Open tabs (persisted)
  activeTabId: string | null;
  logs: SqlLog[];                      // Query history
  theme: 'dark' | 'light' | 'purple';  // UI theme (persisted)
  // ... actions
}
```

**Critical:** Persistence uses `tauri-plugin-store` (not localStorage). Connection metadata is stored in `app_settings.json`; credentials will use `tauri-plugin-stronghold` when remote engines are added.

**Performance patterns enforced throughout:**
- Use granular selectors: `useAppStore(s => s.connections)` not `useAppStore(state => ({...}))`
- Wrap handlers in `useCallback`, expensive computations in `useMemo`
- Components like `QueryEditor`, `WelcomeScreen` are wrapped in `memo()`

### Performance Rules

- Fetch table structure and row counts separately from paged data fetches.
- Build lookup maps once (`useMemo`) for hot render paths instead of repeated linear scans.
- Avoid repeated formatter calls in cell renders; compute once and reuse.
- Keep `useMemo` / `useCallback` dependency arrays minimal and accurate.
- Pass stable callbacks to memoized children to avoid invalidating memoization.
- When deriving multiple lists from one dataset, do it in one memoized pass.
- Virtualize long lists (logs, tables, rows) when item count becomes large.

### UI Architecture

Layout components in `App.tsx`:
```
TopBar (title, connection selector)
├── DatabaseBar (connection chips/tags)
├── Sidebar (table list for active connection)
├── ContentArea
│   ├── TabBar
│   └── Active Tab Content (TableView | TableStructure | QueryEditor)
├── AiPanel (collapsible AI assistant)
└── StatusBar
```

**Component organization:**
- `src/components/ui/` — shadcn/ui primitives (Button, Dialog, etc.)
- `src/components/` — Feature components (QueryEditor, TableView, etc.)

### Theme System

Three themes in `src/index.css`: `dark` (default), `light`, `purple`. CSS variables control all colors. Never hardcode hex values in components.

Key variables: `--bg-primary`, `--bg-secondary`, `--accent-primary` (#00e599 neon green), `--text-primary`, `--border-primary`

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/store/useAppStore.ts` | Global state, persistence logic |
| `src/lib/db.ts` | Tauri invoke wrappers |
| `src-tauri/src/lib.rs` | Tauri command handlers |
| `src-tauri/src/engines/` | Database engine implementations |
| `src/index.css` | CSS variables, themes (~1100 lines) |
| `tailwind.config.js` | Tailwind → CSS variable mapping |
| `components.json` | shadcn/ui configuration |

## Design System

See `STYLE_GUIDE.md` for complete rules. Key points:

- **Dark-first UI** — Use CSS variables, never hardcode colors
- **Information density** — DB tools need compact display
- **Typography:** Inter for UI, JetBrains Mono for data/SQL
- **Neon accent:** `#00e599` sparingly for interactive elements
- **Naming:** `PascalCase` components, `kebab-case` files, `camelCase` functions

## Keyboard Shortcuts (Global)

Defined in `App.tsx`:

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + N` | New connection dialog |
| `⌘/Ctrl + W` | Close active tab |
| `⌘/Ctrl + T` | New query tab |
| `⌘/Ctrl + L` | Toggle log drawer |
| `⌘/Ctrl + ,` | Open settings modal |
| `⌘/Ctrl + Enter` | Execute query (in editor) |

## Constraints & Limits

Defined in `src/store/useAppStore.ts`:
- `MAX_TABS = 20` — Oldest auto-removed when exceeded
- `MAX_RESULT_ROWS = 1000` — Results truncated beyond this
- `MAX_ACTIVE_CONNECTIONS = 5` — UI limit

## Testing

Rust tests in `src-tauri/src/`:
```bash
cd src-tauri
cargo test              # All tests
cargo test engines      # Engine tests only
cargo test sqlite       # SQLite tests only
cargo test -- --nocapture  # Show println output
```

GitHub Actions runs tests on PRs to main (`.github/workflows/rust-tests.yml`).

## Storage Architecture

| Storage | File | Purpose |
|---------|------|---------|
| `tauri-plugin-store` | `app_settings.json` | Connection metadata, tags, preferences, tabs |
| `tauri-plugin-stronghold` | `credentials.hold` | Encrypted passwords/auth tokens (ready for v0.3+) |

## Event System

Custom DOM events for decoupled communication:
- `vibedb:connect` — Dispatched from `ConnectionDialog` with connection details, handled in `App.tsx`

## Adding New Database Engines

See `ROADMAP.md` for planned engines. Implementation checklist:

1. Create `src-tauri/src/engines/<engine>.rs` implementing `DatabaseEngine` trait
2. Add variant to `EngineType` in `types.rs`
3. Register in `EngineRegistry::connect()` in `mod.rs`
4. Add connection config UI in frontend
5. Handle engine-specific types in query results
6. Write integration tests
