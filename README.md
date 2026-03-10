# VibeDB 🇰🇭

<p align="center">
  <img src="./app-icon.png" alt="VibeDB Logo" width="120" height="120">
</p>

<p align="center">
  <a href="./README.md"><b>🏠 Overview</b></a> &nbsp;•&nbsp;
  <a href="./ROADMAP.md">🗺️ Roadmap</a> &nbsp;•&nbsp;
  <a href="https://github.com/Rithprohos/vibe-db/releases">🚀 Releases</a> &nbsp;•&nbsp;
  <a href="./LICENSE">⚖️ License</a>
</p>

---

A modern, high-performance database manager built with Tauri v2 and React. Supports SQLite and Turso (libSQL). Engineered for speed, security, and a premium developer experience.

![VibeDB](https://img.shields.io/badge/version-0.2.7-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
[![Roadmap](https://img.shields.io/badge/Roadmap-View-blueviolet)](./ROADMAP.md)

## Why VibeDB?

Paid database tools made sense before AI. Now a solo dev with agents can build the same thing in weeks — and give it away free. That's VibeDB.

<p align="center">
  <img src="./screenshot/screen-shot-1.png" alt="VibeDB Screenshot" width="100%">
</p>

## 🛠️ Core Features

- **🚀 High Performance** — TanStack virtualization across table browsing, query results, logs, and sidebar lists, plus aggressive code-splitting for heavy UI paths.
- **💎 Transactional Editing** — Stage multiple cell edits across different rows and commit them all in a single atomic SQL transaction.
- **🌍 Multi-Engine Ready** — SQLite and Turso (libSQL) supported. PostgreSQL and MySQL coming soon.
- **🏗️ Visual Table Builder** — Create tables with a polished GUI including real-time, syntax-highlighted SQL preview.
- **🔍 Smart Data Filtering** — Visual WHERE clause builder with support for `BETWEEN`, `NOT BETWEEN`, and multiple conditions.
- **🛡️ Encrypted Security** — Credentials stored in a `Stronghold` vault (Argon2id + XChaCha20-Poly1305).
- **✨ Pollinations AI** — Intelligent SQL assistance built right into the query editor.
- **🎨 Premium Themes** — Switch between **Dark**, **Light**, and **Purple Solarized** modes.
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

- **Frontend**: React 19 + TypeScript + Zustand + Tailwind CSS
- **Backend**: Rust + Tauri v2 + sqlx (SQLite) + libsql (Turso)
- **Editor**: CodeMirror 6 with SQL support
- **State**: Persistent JSON via `tauri-plugin-store`

## 🔐 Security Posture

As of **March 10, 2026**, VibeDB includes important baseline protections, but security hardening is still in progress.

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

_Crafted with vibe coding and AI assistance. See [ROADMAP.md](./ROADMAP.md) for upcoming features (PostgreSQL, MySQL support)._
