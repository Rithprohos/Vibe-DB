# Schema Visualization

Schema Visualization opens the current database schema in a dedicated canvas tab so you can scan tables visually instead of opening them one by one.

## How to open it

1. Connect to a database.
2. In the sidebar, right-click a table.
3. Choose `Open Table Visualize`.

This opens a `Visualize` tab for the active connection.

## Tab behavior

- Only one visualization tab can exist per connection.
- Opening `Open Table Visualize` again for the same connection reuses the existing visualization tab.
- When reused, the tab updates to the latest scope and focuses the canvas.

## Scope rules

- PostgreSQL: the canvas loads tables from the currently selected schema filter in the sidebar.
- PostgreSQL with `All schemas` selected: the canvas loads tables from every visible schema.
- SQLite and Turso: the canvas loads the full database table set and uses `main` as the canvas label.

## Supported interactions

- Drag a table card to reposition it.
- Drag the empty canvas background to pan.
- Use the zoom controls in the header to zoom in or out.
- Use `Reset View` to return the canvas viewport to the default pan and zoom.

Table positions, pan, and zoom are preserved while the tab stays open.

## Current non-goals

This first version is focused on fast table browsing and layout control.

It does not include:

- relationship lines
- minimap
- auto-layout
- schema editing from the canvas
