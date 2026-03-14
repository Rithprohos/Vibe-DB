# VibeDB 🇰🇭

<p align="center">
  <img src="./app-icon.png" alt="VibeDB Logo" width="120" height="120">
</p>

<p align="center">
  <a href="./README.md"><b>🏠 Overview</b></a> &nbsp;•&nbsp;
  <a href="./ROADMAP.md">🗺️ Roadmap</a> &nbsp;•&nbsp;
  <a href="https://github.com/Rithprohos/vibe-db/releases">🚀 Releases</a> &nbsp;•&nbsp;
  <a href="./changelog/">📜 Changelog</a> &nbsp;•&nbsp;
  <a href="./LICENSE">⚖️ License</a>
</p>

---

A modern, high-performance database manager built with Tauri v2 and React. Supports SQLite, Turso (libSQL), and PostgreSQL. Engineered for speed, security, and a premium developer experience.

![VibeDB](https://img.shields.io/badge/version-0.4.10-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=for-the-badge)
[![Roadmap](https://img.shields.io/badge/Roadmap-View-blueviolet?style=for-the-badge)](./ROADMAP.md)

## Why VibeDB?

Paid database tools made sense before AI. Now a solo dev with agents can build the same thing in weeks — and give it away free. That's VibeDB.

<p align="center">
  <img src="./screenshot/screen-shot-1.png" alt="VibeDB Screenshot" width="100%">
</p>

## 🛠️ Core Features

- **🚀 High Performance** — TanStack virtualization across table browsing, query results, logs, and sidebar lists, plus aggressive code-splitting for heavy UI paths.
- **💎 Transactional Editing** — Stage multiple cell edits across different rows and commit them all in a single atomic SQL transaction. All row inserts, updates, and deletes are built and executed in Rust.
- **🌍 Multi-Engine Ready** — SQLite, Turso (libSQL), and PostgreSQL supported. MySQL coming soon.
- **🏗️ Visual Table & View Builder** — Create tables and views with a polished GUI including real-time, syntax-highlighted SQL preview.
- **🕸️ Schema Visualization Canvas** — Explore table relationships on an interactive schema canvas with pan/zoom and draggable cards.
- **🔍 Smart Data Filtering** — Visual WHERE clause builder with support for `BETWEEN`, `NOT BETWEEN`, and multiple conditions, plus click-to-sort columns and drag-to-resize headers.
- **🔎 Row Inspector** — Side panel for detailed row viewing and in-place field editing with save/cancel flow and JSON-aware helpers.
- **🧪 Developer Sample Data Generator** — Generate sample rows directly into a selected table.
- **🗑️ Safe Row Deletion** — Multi-select rows and delete with a production-environment confirmation guard to prevent accidental data loss.
- **🛡️ Encrypted Security** — Credentials stored in a `Stronghold` vault (Argon2id + XChaCha20-Poly1305).
- **✨ AI SQL Assistant** — Intelligent SQL assistance built into the query editor, with Pollinations by default and support for custom/OpenAI profiles.
- **🎨 Premium Themes** — Switch between **Dark**, **Dark Modern**, **Light**, and **Purple Solarized** modes.
- **⌨️ Workflow Mastery** — Multi-tab interface, persistent state, and keyboard-first design (`⌘N`, `⌘T`, `⌘↵`).

## 🚀 Getting Started

```bash
# Clone and install
git clone https://github.com/Rithprohos/vibe-db.git
cd vibe-db
bun install

# Launch in dev mode
bun run tdev

# Build for production
bun run build
bun run tauri build
```

## 🏗️ Architecture

- **Frontend**: React 19 + TypeScript + Zustand + Vanilla CSS (design token system)
- **Backend**: Rust + Tauri v2 + sqlx (SQLite & PostgreSQL) + libsql (Turso)
- **Editor**: CodeMirror 6 with SQL syntax support
- **State**: Persistent JSON via `tauri-plugin-store`; secrets via `tauri-plugin-stronghold`

## 🔐 Security Posture

As of **March 11, 2026**, VibeDB includes important baseline protections, but security hardening is still in progress.

### Implemented

- Query safety checks block destructive patterns such as `DELETE`/`UPDATE` without `WHERE`, tautological predicates (`1=1`, `TRUE`), and common `OR 1=1` injection forms.
- Sensitive secrets (AI API keys and Turso auth tokens) are persisted via `tauri-plugin-stronghold` encryption at rest.
- Connection metadata and UI preferences are stored through `tauri-plugin-store` instead of browser localStorage.

### Current Gaps / In Progress

- Strict Content Security Policy (CSP) is not fully enforced yet in `tauri.conf.json`.
- Tauri capability scopes are broader than desired and are being audited to remove unused permissions.
- Current Stronghold unlock material is app-known; encryption is present, but machine-bound or user-provided secret protection is not complete yet.

### Guidance

- Treat current storage protections as a strong baseline, not a finalized security model.
- Avoid storing high-sensitivity production credentials until the unlock model is upgraded to OS-backed secret storage or a user passphrase flow.

---

_Crafted with vibe coding and AI assistance. See [ROADMAP.md](./ROADMAP.md) for upcoming features — MySQL is next._
