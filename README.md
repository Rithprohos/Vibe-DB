# VibeDB

<p align="center">
  <img src="./app-icon.png" alt="VibeDB Logo" width="120" height="120">
</p>

<p align="center">
  <a href="./README.md"><b>Overview</b></a> &nbsp;•&nbsp;
  <a href="./ROADMAP.md">Roadmap</a> &nbsp;•&nbsp;
  <a href="https://github.com/Rithprohos/vibe-db/releases">Releases</a> &nbsp;•&nbsp;
  <a href="./LICENSE">License</a>
</p>

<p align="center">
  Desktop database management for developers who want speed, clarity, and production-aware safety.
</p>

<p align="center">
  <img src="./screenshot/screen-shot-1.png" alt="VibeDB Screenshot" width="100%">
</p>

## Product Story

VibeDB is a desktop database manager built for real working sessions: browsing tables, shaping schemas, editing rows, running SQL, and moving carefully when a connection points at production.

It is designed to feel like a sharp devtool, not a bloated admin panel. Dense layouts, direct interactions, and visible safety rails are part of the product.

## Core Values

- **Move fast, stay sharp** - Production access should stay usable, but never casual.
- **Local-first trust** - Connections, preferences, and credentials stay in native desktop storage flows instead of living in the browser.
- **Dense developer workflow** - Keyboard-first navigation, multi-tab work, and compact surfaces keep the tool focused on throughput.
- **Safety as product** - Guardrails are visible, deliberate, and part of everyday usage instead of being buried behind configuration.

## Why Teams Reach For VibeDB

- **Production-aware query policy** - VibeDB sits between unrestricted SQL editors and fully read-only modes. Production-tagged connections remain usable, while destructive statements are blocked or explicitly confirmed.
- **Transactional editing** - Multi-row changes are staged and committed as a single atomic operation instead of becoming a fragile sequence of ad hoc updates.
- **Visual schema workflows** - Tables and views can be created through a polished builder with real-time SQL preview, while the schema canvas helps explore relationships quickly.
- **Fast table navigation** - Large results, logs, and sidebar lists stay responsive through virtualization and compact UI patterns.
- **Pin important tables** - Right-click any table in the sidebar to pin it, keeping critical tables at the top of the list for faster access.
- **Built-in query workflow** - SQL editing, saved queries, execution results, and schema refresh behavior live in one place instead of being scattered across modal-heavy flows.
- **Local secret handling** - Sensitive credentials are stored with desktop-native protection primitives rather than plain browser storage.

## Feature Highlights

### Query With Confidence

- `DROP` and `TRUNCATE` are blocked in the query editor for production-tagged connections.
- `ALTER`, `CREATE`, `DELETE`, `INSERT`, `REPLACE`, and `UPDATE` require explicit confirmation before they run against production-tagged connections.
- Read queries remain fast and direct.
- Query policy is visible in the editor so developers know when the tool is treating a connection differently.
- Guided flows such as create table, create view, edit table, row delete, and table truncate remain available with purpose-built confirmations instead of being treated like ad hoc SQL.

### Edit Data Like A Devtool

- Inline editing and row inspection are built for quick, repeated changes.
- Selected row deletes use confirmation guardrails for sensitive environments.
- Schema-changing flows refresh the surrounding context so the app stays aligned with the database.

### Stay In Flow

- Multi-tab workflow for switching between queries, tables, and saved work.
- Sidebar table context menu supports `Pin Table` / `Unpin Table`.
- Pinned tables are shown at the top of the table list.
- Keyboard-first query execution and editing.
- Compact, dark-first UI tuned for long working sessions.

### Work Across Engines

- SQLite
- Turso / libSQL
- PostgreSQL
- MySQL is planned next

## Query Policy

Query policy is one of VibeDB's clearest product values.

Many tools push teams toward only two extremes: fully unrestricted SQL access or fully read-only access. VibeDB takes a more practical approach for day-to-day engineering work. A production-tagged connection stays usable, but the editor applies statement-aware guardrails where mistakes are most expensive.

Current behavior:

- `DROP` and `TRUNCATE` are blocked in the query editor on production-tagged connections.
- `ALTER`, `CREATE`, `DELETE`, `INSERT`, `REPLACE`, and `UPDATE` require confirmation there before execution.
- Query parsing supports multi-statement SQL and ignores semicolons inside strings and comments.
- Blocked editor statements are re-checked in Rust before execution.
- Backend enforcement distinguishes between query editor execution and guided app flows, so query-editor restrictions do not accidentally break structured schema tools.
- Guided destructive actions such as row deletion and table truncation keep their own production confirmation flows.

This is an application-level safety rail. It complements database roles and permissions; it does not replace them.

## Trust Model

- Credentials and sensitive tokens are stored with `tauri-plugin-stronghold`.
- App state and preferences are stored with `tauri-plugin-store`.
- VibeDB is built to reduce accidental mistakes in live environments, especially during direct SQL work.

## Designed For

- Solo developers working across local, staging, and production environments
- Small teams that want a fast desktop client with clear operational guardrails
- Developers who prefer direct database access without giving up visible safety cues

## Project Links

- [Roadmap](./ROADMAP.md)
- [Releases](https://github.com/Rithprohos/vibe-db/releases)
- [License](./LICENSE)
