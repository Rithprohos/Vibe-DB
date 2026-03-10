# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeDB is a cross-platform SQLite database manager built with Tauri v2 (Rust) and React 19. It uses an extensible database engine abstraction to support multiple database types (SQLite and Turso now, PostgreSQL/MySQL planned).

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

| Category | Commands |
|----------|----------|
| Connection | `connect_database`, `disconnect_database`, `set_active_connection` |
| Schema/data | `list_tables`, `get_table_structure`, `get_table_data` |
| Querying | `execute_query`, `execute_transaction` |
| Counts/meta | `get_table_row_count`, `get_filtered_row_count`, `get_database_version` |
| Creation/helpers | `create_database`, `build_create_table_sql` |
| AI config | `get_default_ai_provider_config` |

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

Store composition is centralized in `src/store/useAppStore.ts`, with domain slices under `src/store/slices/`:

- `connectionSlice.ts` — connection lifecycle and table lists
- `tabsSlice.ts` — tab lifecycle + per-tab table-view state
- `uiSlice.ts` — logs, toasts, theme, settings, alerts, metadata
- `aiSlice.ts` — AI provider/profile state

Shared store definitions:
- `src/store/types.ts` — exported interfaces/types
- `src/store/constants.ts` — limits/defaults (`MAX_*`)
- `src/store/helpers.ts` — store helper logic
- `src/store/storage.ts` — Tauri Store adapter used by `persist`

Public hook remains:

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

**Critical:** Persistence uses `tauri-plugin-store` via `src/store/storage.ts` (not localStorage). Connection metadata is stored in `app_settings.json`; credentials will use `tauri-plugin-stronghold` when remote engines are added.

**Performance patterns enforced throughout:**
- Use granular selectors: `useAppStore(s => s.connections)` not `useAppStore(state => ({...}))`
- Wrap handlers in `useCallback`, expensive computations in `useMemo`
- Components like `QueryEditor`, `WelcomeScreen` are wrapped in `memo()`

### Performance Rules

See [`.agents/workflows/performance-rules.md`](.agents/workflows/performance-rules.md) for complete rules. Key points:

- **Granular selectors:** `useAppStore(s => s.connections)` not `useAppStore(state => ({...}))`
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
| `src/store/useAppStore.ts` | Root Zustand store composition + persistence config |
| `src/store/slices/*` | Domain-specific Zustand slices (`ai`, `connection`, `tabs`, `ui`) |
| `src/store/types.ts` | Shared store/domain types |
| `src/store/constants.ts` | Store limits/defaults |
| `src/lib/db.ts` | Tauri invoke wrappers |
| `src-tauri/src/commands.rs` | Tauri command implementations |
| `src-tauri/src/lib.rs` | Tauri setup, plugins, command registration |
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

## Working Rules

- Keep UI dark-first, compact, and use CSS variables from `src/index.css`.
- Do not hardcode colors. Existing neon accent `#00e599` is allowed sparingly.
- VibeDB should look like a devtool: sharp corners, dense layouts, restrained glow, no soft SaaS cards.
- Avoid `rounded-full` and large radii on primary UI surfaces. Reserve fully round shapes for tiny indicators only.
- Preserve existing visual patterns in the area you touch.
- Do not duplicate domain logic across components. Move shared logic/constants to `src/lib/*`.
- Keep frontend and backend validation in sync for user input.
- When touching tables/logs/sidebar lists, preserve virtualization.
- Keep metadata fetches separate from paginated row fetches.
- Avoid repeated per-cell work in table rendering; memoize lookup maps when reused.
- Preserve editable-grid behavior: double-click enters edit, `Escape` cancels, `Cmd/Ctrl+Enter` commits.
- Follow [`.agents/workflows/performance-rules.md`](.agents/workflows/performance-rules.md) when changing React, Zustand, async effects, or performance-sensitive code.

## TypeScript / React

- TS is strict: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- Prefer explicit parameter/return types for exported functions.
- Use `import type` where appropriate.
- Prefer interfaces for object shapes unless a union/type alias is clearer.
- Follow the local style of the file you are editing. This repo mixes `PascalCase` component files with nested feature folders.

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

Defined in `src/store/constants.ts`:
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
cargo test turso        # Turso tests only
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

See `ROADMAP.md` for planned engines. Reference implementations:
- **SQLite**: `src-tauri/src/engines/sqlite.rs`
- **Turso**: `src-tauri/src/engines/turso.rs`

Implementation checklist:

1. Create `src-tauri/src/engines/<engine>.rs` implementing `DatabaseEngine` trait
2. Add variant to `EngineType` in `types.rs`
3. Register in `EngineRegistry::connect()` in `mod.rs`
4. Add connection config helpers in `types.rs` (e.g., `ConnectionConfig::turso_remote()`)
5. Add connection config UI in frontend
6. Handle engine-specific types in query results
7. Write integration tests
