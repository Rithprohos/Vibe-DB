# Global Quick Search (Cmd/Ctrl+K)

Plan for a Spotlight-style command palette focused on fast table navigation in the active connection.

## Goal

Add a global quick search that lets the user:

- Open the palette with `Cmd+K` / `Ctrl+K`
- Search tables from the active sidebar connection
- Navigate results with the keyboard
- Open the selected table directly in the existing tab flow

This should feel like an IDE command palette, not a marketing modal: dense, dark, sharp corners, compact spacing.

## Scope

### Phase 1

- Search tables only
- Use the active sidebar connection as the search context
- Open table data view on `Enter`
- Support `Up`, `Down`, `Enter`, and `Escape`
- Show a compact empty state when there are no matches

### Phase 2

- Add recent tables
- Add saved queries to results
- Add alternate actions such as opening table structure
- Improve ranking if basic substring matching is not sufficient

Current status:

- Recent tables are now implemented
- Saved queries, alternate actions, and richer ranking are still pending

## Existing Building Blocks

- Table metadata already exists in `tablesByConnection`
- The active search context already exists in `activeSidebarConnectionId`
- Table opening already exists via `openTableTab(connectionId, tableName, "data")`
- Dialog primitives already exist in `src/components/ui/dialog.tsx`

The first pass should reuse these pieces rather than introducing a new search backend or a large store refactor.

## Recommended Implementation

1. Add lightweight UI state
   - Extend the UI slice with `isQuickSearchOpen`
   - Add `setIsQuickSearchOpen`
   - Keep this in UI state only; do not persist it

2. Create `src/components/QuickSearch.tsx`
   - Render with the existing dialog primitives
   - Keep the layout narrow, dense, and keyboard-first
   - Autofocus the input when opened
   - Derive results from store selectors instead of copying tables into local state

3. Build the result list from the active connection
   - Read `activeSidebarConnectionId`
   - Read `tablesByConnection[activeSidebarConnectionId] ?? []`
   - Normalize display labels for schema-qualified tables when available
   - Do not fetch metadata from the backend in this component

4. Start with simple matching
   - Use case-insensitive substring matching first
   - Rank exact prefix matches above general substring matches
   - Only add true fuzzy matching if the basic matcher feels insufficient in real usage

5. Reuse existing navigation actions
   - On `Enter`, call `openTableTab(connectionId, tableName, "data")`
   - Close the palette after selection
   - If there is no active connection, show a short empty state instead of trying to recover

6. Register the global shortcut in `App.tsx`
   - Listen for `Cmd+K` / `Ctrl+K`
   - Ignore the shortcut while typing in editable targets such as `input`, `textarea`, or contenteditable elements
   - Prevent the browser default only when the app handles the shortcut

## Interaction Details

- `Cmd+K` / `Ctrl+K`: open palette
- `Escape`: close palette
- `ArrowUp` / `ArrowDown`: move highlighted result
- `Enter`: open highlighted table
- Initial highlight should default to the first result
- When the query changes, reset the highlight to the first visible result

## UI Notes

- Use existing CSS tokens only
- Keep corners small and surfaces border-defined
- Prefer mono for table names and schema-qualified identifiers
- Avoid oversized shadows, glass effects, or rounded card styling
- Keep the result rows compact enough to scan quickly

## Data Model Notes

Recent items do not need to block Phase 1.

When added, store them as lightweight references rather than duplicated metadata. A shape like this is enough:

```ts
interface QuickSearchRecentItem {
  connectionId: string;
  tableName: string;
  openedAt: number;
}
```

Cap the history to a small fixed size and update it from the same action path that opens a table, so the behavior stays consistent.

Current implementation notes:

- Recent tables are recorded from `openTableTab(...)`
- Recents are scoped by `connectionId`
- The quick search shows a `Recent tables` section when the query is empty
- Recents fall back to the normal table list if the referenced table metadata is no longer loaded

## Risks And Guardrails

- Do not subscribe the component to the entire Zustand store; use granular selectors
- Do not add backend calls on open; the palette should read already-loaded metadata
- Do not introduce expensive per-keystroke work if the table list grows; keep filtering simple and derived
- Do not break existing keyboard flows in editors or form inputs when registering the global shortcut

## Acceptance Criteria

- Pressing `Cmd+K` / `Ctrl+K` opens the palette from anywhere outside editable inputs
- Results are scoped to the active sidebar connection
- Selecting a result opens the table in the existing data tab flow
- The palette is fully usable with keyboard only
- The UI matches VibeDB's compact devtool styling

## Nice-To-Have Follow-Ups

- Saved queries in the same palette with a distinct icon
- Secondary action hint for opening structure view
- Optional fuzzy scoring if substring search proves too limited
