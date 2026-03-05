# AGENTS.md — VibeDB Development Guide

> This file provides essential context for AI agents working on VibeDB. Read before making changes.

## Project Overview

- **Name**: VibeDB — cross-platform SQLite database manager
- **Stack**: Tauri v2 (Rust) + React 19 + TypeScript + Vite
- **Package Manager**: bun
- **Identifier**: `com.vibedb.app`

---

## Commands

### Development

```bash
bun install          # Install dependencies (first time)
bun run dev          # Frontend dev server only (port 1420)
bun run tauri dev    # Full app (Rust + Vite HMR) — first compile ~2-3min
bun run tdev         # Alias for tauri dev
```

### Build & Typecheck

```bash
bun run build        # TypeScript check + Vite production build
bun run preview      # Preview production build locally
bun run tauri build  # Build Tauri app for distribution
```

### Testing

> **Note**: This project currently has no test suite. Tests are encouraged.

To add tests, use Vitest:

```bash
bun add -D vitest @testing-library/react @testing-library/jest-dom jsdom
bun vitest run src/store/useAppStore.test.ts
bun vitest run --testNamePattern "addConnection"
```

---

## Code Style

### General Principles

- **Dark-first UI** — Use CSS variables from `src/index.css`. Never hardcode hex colors.
- **Information density** — DB tools need compact data display.
- **Neon accent** — Use `#00e599` sparingly.

### TypeScript

- **Strict mode**: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Use explicit types for parameters/returns, `type` for imports: `import { type Connection }`
- Prefer interfaces over types for object shapes

### React

- Functional components with hooks, `useCallback` for handlers, `useMemo` for expensive ops

### Performance Rules

- **Fetch metadata separately from row data** — avoid re-fetching table structure and total row count on every page/sort update.
- **Memoize lookup maps** — for repeated cell rendering, build maps once (for example column-name → column-info) instead of repeated `Array.find` calls.
- **Avoid duplicated per-cell work** — compute formatted cell values once per render path and reuse.
- **Keep memo dependencies minimal** — only include values actually used by the memoized computation.
- **Use stable callbacks for list items** — pass `useCallback` handlers to memoized children to prevent avoidable rerenders.
- **Prefer single-pass filtering/partitioning** — when deriving multiple filtered lists from the same source, compute them together in one memoized pass.
- **Virtualize long lists/tables** — use row virtualization when rendering large result sets (tables, logs, sidebar objects).

### Naming & Imports

| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `TableView.tsx` |
| Files | kebab-case | `query-editor.tsx` |
| Functions/vars | camelCase | `addConnection` |
| Types | PascalCase | `Connection`, `TabType` |

```typescript
// External first, then relative
import { useState, useEffect } from 'react';
import { useAppStore, type Connection } from './store/useAppStore';
import { listTables } from './lib/db';
import './index.css';
```

### CSS & Error Handling

- CSS variables for colors (`var(--bg-primary)`), Tailwind for layout, `cva` for variants
- Try/catch for Tauri commands, log errors: `console.error('Failed to connect:', e)`

---

## Architecture

### State (Zustand)

All app state in `src/store/useAppStore.ts`:

```typescript
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      connections: [],
      tables: [],
      tabs: [],
      addConnection: (conn) => set(...),
    }),
    { name: 'vibedb-storage' }
  )
);
```

### Tauri Commands

Located in `src-tauri/src/lib.rs`:

| Command | Purpose |
|---------|---------|
| `list_tables` | Get all tables/views |
| `get_table_structure` | Column definitions |
| `execute_query` | Run SQL, return results |
| `get_table_row_count` | Pagination support |
| `create_database` | Create new SQLite file |

### Custom Events

- `vibedb:connect` — Dispatched from ConnectionDialog with connection details

---

## Design System

See [STYLE_GUIDE.md](./STYLE_GUIDE.md) for colors, typography, and component rules.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/index.css` | CSS variables (~1100 lines) |
| `src/store/useAppStore.ts` | Global state |
| `src/lib/db.ts` | Tauri invoke wrappers |
| `src-tauri/src/lib.rs` | Rust commands |
| `tailwind.config.js` | Tailwind → CSS var mapping |
