# AGENTS.md — VibeDB

Read this before editing the repo.

## Project

- App: VibeDB, cross-platform SQLite database manager
- Stack: Tauri v2 + Rust + React 19 + TypeScript + Vite
- Package manager: `bun`
- Tauri identifier: `kh.com.vibedb`
- Dev frontend URL: `http://localhost:1420`

## Commands

```bash
bun install
bun run dev
bun run tdev
bun run build
bun run preview
bun run cargo:test
```

## Source Of Truth

- [`package.json`](/Users/a1234/Documents/Project/vibe-db/package.json): scripts, deps, versions
- [`src/store/useAppStore.ts`](/Users/a1234/Documents/Project/vibe-db/src/store/useAppStore.ts): root Zustand store composer + persistence config
- [`src/store/slices/*`](/Users/a1234/Documents/Project/vibe-db/src/store/slices): state/action slices (`ai`, `connection`, `tabs`, `ui`)
- [`src/store/types.ts`](/Users/a1234/Documents/Project/vibe-db/src/store/types.ts): shared Zustand/domain types
- [`src/store/constants.ts`](/Users/a1234/Documents/Project/vibe-db/src/store/constants.ts): store limits/defaults (`MAX_*`, default page size)
- [`src/store/helpers.ts`](/Users/a1234/Documents/Project/vibe-db/src/store/helpers.ts): shared store helper logic
- [`src/store/storage.ts`](/Users/a1234/Documents/Project/vibe-db/src/store/storage.ts): Tauri Store-backed Zustand storage adapter
- [`src/lib/db.ts`](/Users/a1234/Documents/Project/vibe-db/src/lib/db.ts): frontend wrappers around Tauri commands
- [`src-tauri/src/commands.rs`](/Users/a1234/Documents/Project/vibe-db/src-tauri/src/commands.rs): backend command module root and re-exports
- [`src-tauri/src/commands/*`](/Users/a1234/Documents/Project/vibe-db/src-tauri/src/commands): backend command implementations split by domain (`connection`, `query`, `schema`, `rows`)
- [`src-tauri/src/lib.rs`](/Users/a1234/Documents/Project/vibe-db/src-tauri/src/lib.rs): Tauri setup, plugins, command registration
- [`src/index.css`](/Users/a1234/Documents/Project/vibe-db/src/index.css): theme variables and shared styling tokens
- [`STYLE_GUIDE.md`](/Users/a1234/Documents/Project/vibe-db/STYLE_GUIDE.md): UI rules
- [`.agents/workflows/performance-rules.md`](/Users/a1234/Documents/Project/vibe-db/.agents/workflows/performance-rules.md): required performance and state-management rules

## Architecture

- Frontend state lives in Zustand with a root store in `src/store/useAppStore.ts` composed from slice modules in `src/store/slices`.
- Persisted state uses Tauri Store via `app_settings.json`, not browser localStorage.
- Backend DB operations are implemented under `src-tauri/src/commands/`, with `src-tauri/src/commands.rs` as the module root.
- `src-tauri/src/lib.rs` wires plugins and exposes commands.
- Current custom event: `vibedb:connect`.

## Current Backend Commands

Re-exported from `src-tauri/src/commands.rs` and implemented under `src-tauri/src/commands/`:

| Category | Commands |
|----------|----------|
| Connection | `connect_database`, `disconnect_database`, `set_active_connection` |
| Schema/data | `list_tables`, `get_table_structure`, `get_table_data` |
| Querying | `execute_query`, `execute_transaction` |
| Counts/meta | `get_table_row_count`, `get_filtered_row_count`, `get_database_version` |
| Creation/helpers | `create_database`, `build_create_table_sql` |
| AI config | `get_default_ai_provider_config` |

## Storage Architecture

| Storage | File | Purpose |
|---------|------|---------|
| `tauri-plugin-store` | `app_settings.json` | Connection metadata, tags, preferences, tabs |
| `tauri-plugin-stronghold` | `credentials.hold` | Encrypted passwords/auth tokens |

## Working Rules

- Keep UI dark-first, compact, and use CSS variables from `src/index.css`.
- Do not hardcode colors. Existing neon accent `#00e599` is allowed sparingly.
- Follow [`STYLE_GUIDE.md`](/Users/a1234/Documents/Project/vibe-db/STYLE_GUIDE.md) for visual direction.
- VibeDB should look like a devtool: sharp corners, dense layouts, restrained glow, no soft SaaS cards.
- Avoid `rounded-full` and large radii on primary UI surfaces. Reserve fully round shapes for tiny indicators only.
- Preserve existing visual patterns in the area you touch.
- Do not duplicate domain logic across components. Move shared logic/constants to `src/lib/*`.
- Keep frontend and backend validation in sync for user input.
- When touching tables/logs/sidebar lists, preserve virtualization.
- Keep metadata fetches separate from paginated row fetches.
- Avoid repeated per-cell work in table rendering; memoize lookup maps when reused.
- Preserve editable-grid behavior: double-click enters edit, `Escape` cancels, `Cmd/Ctrl+Enter` commits.
- Follow [`.agents/workflows/performance-rules.md`](/Users/a1234/Documents/Project/vibe-db/.agents/workflows/performance-rules.md) when changing React, Zustand, async effects, or performance-sensitive code.

## TypeScript / React

- TS is strict: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`.
- Prefer explicit parameter/return types for exported functions.
- Use `import type` where appropriate.
- Prefer interfaces for object shapes unless a union/type alias is clearer.
- Follow the local style of the file you are editing. This repo mixes `PascalCase` component files with nested feature folders.

## Event System

Custom DOM events for decoupled communication:
- `vibedb:connect` — Dispatched from `ConnectionDialog` with connection details, handled in `App.tsx`

## Adding New Database Engines

Implementation checklist:
1. Create `src-tauri/src/engines/<engine>.rs` implementing `DatabaseEngine` trait
2. Add variant to `EngineType` in `types.rs`
3. Register in `EngineRegistry::connect()` in `mod.rs`
4. Add connection config UI in frontend
5. Handle engine-specific types in query results
6. Write integration tests

## Testing

- There is no frontend test suite yet.
- Rust tests exist under `src-tauri/tests`.
- Preferred existing test command: `bun run cargo:test`
- If you change critical editing or data behavior, add tests when practical.
