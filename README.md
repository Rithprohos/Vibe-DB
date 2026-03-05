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

A modern, high-performance SQLite database manager built with Tauri v2 and React. Engineered for speed, security, and a premium developer experience.

![VibeDB](https://img.shields.io/badge/version-0.2.5-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
[![Roadmap](https://img.shields.io/badge/Roadmap-View-blueviolet)](./ROADMAP.md)

## Why VibeDB?

Paid database tools made sense before AI. Now a solo dev with agents can build the same thing in weeks — and give it away free. That's VibeDB.

<p align="center">
  <img src="./screenshot/screen-shot-1.png" alt="VibeDB Screenshot" width="100%">
</p>

## ✨ What's New (v0.2.5)

With the completion of **Phase 1.5**, VibeDB is now stable and performance-hardened:

- **🚀 Code-Splitting** — Comprehensive lazy-loading for heavy UI chunks (Views, Dialogs, Drawers, AI Panel, Alerts) for faster initial loads and reduced bundle size.
- **⚡ TableView Optimization** — Further refined virtual row and cell paths into highly memoized sub-components with stable callbacks to eliminate unnecessary rerenders.
- **🛠️ Dev Instrumentation** — Added internal tools to measure render counts and fetch latency in development mode for easier performance monitoring.
- **💎 Transactional Editing** — Stage multiple cell edits across different rows and commit them all in a single atomic SQL transaction.
- **🚨 Global Alert System** — Unified, theme-matched notification system for instant feedback on success, errors, and warnings.

## 🛠️ Features

- **Multi-Engine Ready** — Trait-based abstraction (SQLite active; Turso, Postgres, MySQL coming soon).
- **Visual Table Builder** — Create tables with a polished GUI including real-time SQL preview and syntax highlighting.
- **Smart Data Filtering** — Visual WHERE clause builder with support for `BETWEEN`, `NOT BETWEEN`, and multiple conditions.
- **Encrypted Security** — Credentials stored in a `Stronghold` vault (Argon2id + XChaCha20-Poly1305).
- **Workflow Mastery** — Multi-tab interface, persistent state, and keyboard-first design (`⌘N`, `⌘T`, `⌘↵`).
- **Pollinations AI** — Intelligent SQL assistance built right into the query editor.
- **Premium Themes** — Switch between **Dark**, **Light**, and **Purple Solarized** modes.

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
- **Backend**: Rust + Tauri v2 + sqlx (Async SQLite)
- **Editor**: CodeMirror 6 with SQL support
- **State**: Persistent JSON via `tauri-plugin-store`

---

_Crafted with vibe coding and AI assistance. See [ROADMAP.md](./ROADMAP.md) for the journey to v0.3 (Turso Edge Support)._
