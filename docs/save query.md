# Save Query Feature Specification

## Goal

Allow users to save reusable SQL queries inside VibeDB, reopen them across sessions, and update them from query tabs without introducing a second persistence model or breaking existing editor behavior.

This spec is implementation-focused and aligned with the current architecture:

- Frontend state is owned by Zustand
- Persisted app state is written through `src/store/useAppStore.ts`
- Query tabs are the editing surface
- Sidebar lists must stay compact and performant

## Scope

### In Scope

- Save current query tab as a named saved query
- Reopen a saved query in a query tab
- Update an existing saved query from a linked tab
- Save a linked tab as a new saved query
- Rename and delete saved queries
- Browse and search saved queries in the sidebar
- Persist saved queries across app restarts

### Out Of Scope

- Export/import `.sql` files
- Nested folders or drag-and-drop organization
- Cross-device sync
- Query sharing
- Full-text SQL search

## Product Principles

- Saved queries are app metadata, not database objects
- Saving a query must not execute it
- A saved query can optionally be associated with a connection, but it must still be viewable even if that connection no longer exists
- Query tabs remain editable drafts; linking a tab to a saved query only adds metadata and save behavior
- Deleting a saved query never closes tabs; it only removes the saved record and unlinks affected tabs

## User Stories

- As a user, I want to save a query I am editing so I can reuse it later
- As a user, I want to browse saved queries from the sidebar
- As a user, I want to search saved queries by name quickly
- As a user, I want to open a saved query in a new tab without losing my current work
- As a user, I want `Cmd/Ctrl + S` to update a saved query when my tab is already linked
- As a user, I want `Cmd/Ctrl + Shift + S` to save the current query as a new record
- As a user, I want deleting a saved query to leave my open tabs intact as unsaved drafts

## State Model

### Saved Query Type

```ts
export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  connectionId: string | null;
  createdAt: number;
  updatedAt: number;
}
```

### Query Tab Additions

Saved-query behavior requires explicit tab metadata.

```ts
export interface Tab {
  id: string;
  connectionId: string;
  type: TabType;
  title: string;
  tableName?: string;
  query?: string;
  result?: QueryResult | null;
  error?: string;
  createViewDraft?: CreateViewDraft;
  savedQueryId?: string | null;
  savedQueryName?: string | null;
}
```

### App State Additions

Saved queries should live in Zustand and be persisted through the existing store pipeline.

```ts
export interface AppState {
  savedQueries: SavedQuery[];

  saveQuery: (input: {
    id?: string;
    name: string;
    sql: string;
    connectionId: string | null;
  }) => SavedQuery;
  renameSavedQuery: (id: string, name: string) => void;
  deleteSavedQuery: (id: string) => void;
  unlinkTabsForSavedQuery: (savedQueryId: string) => void;
}
```

## Persistence

Saved queries must be persisted through the existing Zustand `persist` configuration, not through a separate ad hoc store shape.

Implementation requirement:

- Add `savedQueries` to `AppState`
- Include `savedQueries` in `partialize(...)` inside `src/store/useAppStore.ts`
- Continue storing all persisted app metadata under the existing `vibedb-storage` entry in `app_settings.json`

This avoids introducing a second source of truth and keeps hydration behavior consistent with the rest of the app.

## Validation Rules

### Limits

- Maximum saved queries: 500
- Maximum name length: 100 characters
- Maximum SQL length: 100,000 characters

### Field Rules

- `name` is required after trimming
- `name` must be unique case-insensitively within the saved query list
- `sql` is required after trimming
- `connectionId` is optional and may be `null`

### Failure Behavior

- Validation failures are shown inline in the dialog
- Store actions must enforce the same rules as the UI
- If the query limit is reached, saving is blocked with a clear error

## UX Model

### Save Query Dialog

Single dialog used for both:

- Save new query
- Save as new query
- Rename saved query metadata before first save

### Fields

- `Name` required text input
- `Connection` optional select, defaulting to the tab connection when available

### Removed From Earlier Draft

- Freeform `folder`

Reason:

- It adds grouping and migration complexity without a clear first-release need
- The current sidebar already manages dense, performance-sensitive lists
- A flat searchable list is enough for v1

### Dialog Modes

- `create`: saving an unsaved tab
- `save-as`: creating a new saved query from a linked or unlinked tab
- `rename`: renaming from sidebar actions

### Saved Queries Sidebar Section

Add a new collapsible section to the sidebar below the connection-specific database objects.

### Features

- Section header with saved query count
- Search input filtering by saved query name
- Flat list sorted by `updatedAt` descending
- Context menu actions:
  - Open in new tab
  - Rename
  - Delete
- Visual connection badge when the saved query is associated with a connection that still exists
- Empty state for zero saved queries

### Performance Requirements

- Keep selector usage granular
- Memoize filtered results
- If the final UI can render enough rows to impact scroll performance, virtualize the saved query list
- Do not add repeated per-item lookup work inside render when a memoized map can be built once

### Tab Linking Rules

Linking is explicit metadata on a query tab.

### A Linked Tab Means

- `tab.savedQueryId` points to an existing saved query
- `tab.savedQueryName` mirrors the current saved query name for display
- The tab title should use the saved query name

### An Unlinked Tab Means

- `savedQueryId` is `null` or absent
- `Cmd/Ctrl + S` opens the save dialog instead of updating in place

### Deletion Rule

When a saved query is deleted:

- Remove it from `savedQueries`
- For all tabs linked to that query:
  - set `savedQueryId` to `null`
  - set `savedQueryName` to `null`
- Preserve tab `query` content
- Preserve open tab and results state

## Workflows

### Save New Query

1. User edits a query tab with non-empty SQL
2. User clicks toolbar `Save` or presses `Cmd/Ctrl + S`
3. If the tab is unlinked, open the Save Query dialog
4. Prefill:
   - `Name`: derived from the tab title if meaningful, otherwise a timestamped default
   - `Connection`: current tab connection
5. User confirms save
6. Store creates `SavedQuery`
7. Current tab becomes linked to the new saved query
8. Sidebar updates immediately

### Open Saved Query

1. User clicks a saved query in the sidebar
2. Open a new query tab
3. Populate:
   - `title`: saved query name
   - `query`: saved query SQL
   - `connectionId`: saved query connection when present, otherwise current sidebar connection or existing fallback behavior
   - `savedQueryId`: saved query id
   - `savedQueryName`: saved query name

Opening a saved query should always create a new tab rather than stealing focus from an unrelated existing query tab.

### Update Saved Query

1. User edits a linked query tab
2. User presses `Cmd/Ctrl + S` or clicks toolbar `Save`
3. Save updates the existing saved query record in place
4. `updatedAt` changes
5. Sidebar ordering refreshes if sorted by recency

### Save As New Query

1. User presses `Cmd/Ctrl + Shift + S` from any query tab
2. Open dialog in `save-as` mode
3. Create a new saved query record
4. Current tab is relinked to the newly created saved query

### Rename Saved Query

1. User opens sidebar context menu
2. Selects `Rename`
3. Dialog opens with current name
4. Confirming rename updates:
   - saved query name
   - all linked tab titles
   - all linked `savedQueryName` values

### Delete Saved Query

1. User opens sidebar context menu
2. Selects `Delete`
3. Confirmation dialog explains that open tabs will remain as unsaved drafts
4. On confirm:
   - delete saved query
   - unlink affected tabs
   - keep tab SQL intact

## Keyboard Shortcuts

Shortcuts must be wired where query editing actually happens.

### Required Behavior

- `Cmd/Ctrl + S`
  - In a linked query tab: update existing saved query
  - In an unlinked query tab: open Save Query dialog
- `Cmd/Ctrl + Shift + S`
  - In any query tab: open Save As dialog

### Implementation Requirement

These shortcuts must be implemented in the query editor key handling path, not only in the global `window` shortcut handler, because editor shortcuts are intentionally preserved inside CodeMirror.

## Toolbar Behavior

Add save actions to the query editor toolbar.

### Buttons

- `Save`
- `Save As`

### Labeling

- Unlinked tab: `Save`
- Linked tab: `Update`

`Save As` is always available.

## Connection Handling

Saved queries may outlive connections.

### Rules

- If a saved query references a deleted connection, keep the saved query
- Show it as detached or without a connection badge in the sidebar
- Opening it should still populate the SQL in a query tab
- Execution behavior continues to depend on the tab having a usable active connection

## Sorting And Search

### Default Sort

- `updatedAt` descending

### Search

- Filter by saved query name only for v1
- Match case-insensitively
- Ignore leading and trailing whitespace in the search term

## Error Cases

- Saving with empty SQL: block and show validation message
- Saving with empty name: block and show validation message
- Saving with duplicate name: block and show validation message
- Saving when max count reached: block and show validation message
- Renaming to an existing name: block and show validation message
- Attempting to update a linked tab whose saved query no longer exists: treat as unlinked and open Save dialog

## Acceptance Criteria

- Saved queries persist across app restarts
- Saving a query does not execute SQL
- Opening a saved query creates a query tab populated with the saved SQL
- `Cmd/Ctrl + S` works while focus is inside the SQL editor
- Renaming a saved query updates linked tab titles
- Deleting a saved query does not close tabs or erase tab SQL
- Validation is enforced in both UI and store actions
- The sidebar remains responsive with the maximum supported saved-query count

## Suggested Implementation Order

1. Add `SavedQuery` types, tab metadata, limits, and store actions
2. Persist `savedQueries` through `useAppStore`
3. Add query-editor save/update/save-as actions and keyboard shortcuts
4. Add save dialog with shared validation
5. Add saved queries sidebar section with search and context menu
6. Add rename and delete flows, including tab unlinking
7. Verify persistence, shortcut behavior, and tab-link edge cases

## Future Enhancements

- Export saved queries to `.sql`
- Import queries from files
- Tags or lightweight grouping
- Search inside SQL body
- Duplicate detection based on normalized SQL
