# VibeDB — Style Guide & Design Rules

## Design Philosophy

VibeDB's visual identity is inspired by **Neon DB's** dark, developer-centric aesthetic. The UX flow mirrors **TablePlus** — a familiar, no-frills database client pattern. The goal is a premium-feeling dev tool that's beautiful but never gets in the way.

**Principles:**

1. **Dark-first** — deep blacks with subtle differentiation between surface layers
2. **Neon accents** — green (`#00e599`) is the signature. Use sparingly for interactive elements and success states
3. **Information density** — DB tools need to show lots of data compactly. Avoid excessive padding
4. **Monospace for data** — all database values use `JetBrains Mono`; UI chrome uses `Inter`

---

## Color Palette

| Token                | Value     | Usage                              |
| -------------------- | --------- | ---------------------------------- |
| `--bg-primary`       | `#0a0a0f` | Main background, editor bg         |
| `--bg-secondary`     | `#111118` | Sidebar, toolbars, status bar      |
| `--bg-tertiary`      | `#1a1a24` | Input fields, table headers        |
| `--bg-surface`       | `#16161f` | Cards, dialogs                     |
| `--bg-elevated`      | `#1e1e2a` | Hover states, elevated cards       |
| `--bg-hover`         | `#252533` | Row/item hover                     |
| `--bg-active`        | `#2a2a3a` | Active/pressed states              |
| `--accent-primary`   | `#00e599` | Primary accent (Neon green)        |
| `--accent-secondary` | `#7c3aed` | Secondary accent (Electric purple) |
| `--text-primary`     | `#e4e4ed` | Body text                          |
| `--text-secondary`   | `#9898a6` | Labels, secondary info             |
| `--text-tertiary`    | `#6b6b7b` | Hints, placeholders, row numbers   |
| `--text-error`       | `#ef4444` | Error messages                     |
| `--text-warning`     | `#f59e0b` | Warnings, NOT NULL badges          |
| `--border-primary`   | `#2a2a3a` | Visible borders                    |
| `--border-secondary` | `#1e1e2a` | Subtle dividers                    |

### Data Type Colors (in grids)

| Type     | Color             | Class           |
| -------- | ----------------- | --------------- |
| NULL     | `#6b6b7b` italic  | `.null-value`   |
| Numbers  | `#60a5fa` (blue)  | `.number-value` |
| Booleans | `#f59e0b` (amber) | `.bool-value`   |
| Strings  | `--text-primary`  | default         |

---

## Typography

| Context          | Font           | Size           | Weight             |
| ---------------- | -------------- | -------------- | ------------------ |
| UI labels / body | Inter          | 12-13px        | 400-500            |
| Section headers  | Inter          | 11px uppercase | 600                |
| Sidebar logo     | Inter          | 15px           | 700, gradient fill |
| Data grid cells  | JetBrains Mono | 12px           | 400                |
| Query editor     | JetBrains Mono | 13px           | 400                |
| Status bar       | Inter          | 11px           | 400                |
| Dialog titles    | Inter          | 17px           | 600                |
| Welcome title    | Inter          | 28px           | 700, gradient fill |

---

## Layout Constants

| Token                | Value   | Description                       |
| -------------------- | ------- | --------------------------------- |
| `--sidebar-width`    | `260px` | Initial sidebar width (resizable) |
| `--statusbar-height` | `28px`  | Bottom status bar                 |
| `--tabbar-height`    | `38px`  | Tab strip height                  |
| `--radius-sm`        | `4px`   | Buttons, inputs                   |
| `--radius-md`        | `8px`   | Cards, dialogs, connection btn    |
| `--radius-lg`        | `12px`  | Dialogs outer radius              |

---

## Component Rules

### Buttons

- **Primary** (Run, Connect): `--accent-primary` bg, `--bg-primary` text, 600 weight
- **Secondary** (Browse, toolbar): `--bg-tertiary` bg, `--border-primary` border, `--text-secondary` text
- **Ghost** (tab close, small actions): transparent bg, visible on hover only
- All buttons: `font-family: inherit`, `cursor: pointer`, `var(--transition-fast)` on hover

### Toolbar Buttons

Toolbar action buttons (Refresh, Add Record, Filter, etc.) must use a **consistent hover pattern**:

```
text-muted-foreground hover:text-foreground hover:bg-accent/50
```

- **Default**: muted text, transparent background
- **Hover**: text brightens + subtle background pill appears (`accent/50`)
- **Active/toggled state** (e.g. active filter): use `bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25`

This gives buttons a tactile, clickable feel without being visually heavy — similar to VS Code and TablePlus toolbars.

### Inputs

- Background: `--bg-tertiary`
- Border: `--border-primary`, transitions to `--accent-primary` on focus
- Text: `--text-primary`, placeholder: `--text-tertiary`
- Border-radius: `--radius-sm`

### Data Grid

- Headers: sticky, uppercase 11px, `--bg-tertiary` bg, 2px bottom border
- Cells: `JetBrains Mono` 12px, 6px vertical / 12px horizontal padding
- Row hover: `--bg-hover` on entire row
- Row numbers: `--text-tertiary`, centered
- Max cell width: 300px with text-overflow ellipsis

### Tabs

- Active: neon green text + 2px bottom border + subtle green bg tint
- Inactive: `--text-secondary`
- Close button: hidden, shows on tab hover at 0.6 opacity

### Dialogs

- Overlay: `rgba(0,0,0,0.7)` with `backdrop-filter: blur(4px)`
- Card: `--bg-surface`, `--radius-lg`, `300ms slideUp` animation
- Width: 440px (max 90vw)

### Sidebar

- Items: 2px transparent left border, turns `--accent-primary` when active
- Section headers: 11px uppercase, `--text-tertiary`, collapsible with ▶ arrow
- Count badges: `--bg-tertiary` pill

### Resizer Components

- **Sidebar**: Draggable right edge (`.resizer`). Cursor: `col-resize`.
- **Query Editor**: Draggable bottom edge (`.resizer-h`). Cursor: `row-resize`.
- **Behavior**: Resizers highlight with `var(--accent-primary)` on hover and during drag.
- **Constraints**: Sidebar (200px-600px), Query Editor (min 100px).

---

## Animation Rules

| Animation             | Duration                | Use                              |
| --------------------- | ----------------------- | -------------------------------- |
| `--transition-fast`   | 150ms ease              | Hover states, button transitions |
| `--transition-normal` | 250ms ease              | Color changes, layout shifts     |
| `float`               | 3s ease-in-out infinite | Welcome logo only                |
| `fadeIn`              | 200ms ease              | Dialog overlay                   |
| `slideUp`             | 300ms ease              | Dialog card entrance             |
| `spin`                | 0.6s linear infinite    | Loading spinner                  |

---

## Do's and Don'ts

### ✅ Do

- Use CSS variables for ALL colors — never hardcode hex in components
- Use `font-family: inherit` on all buttons/inputs
- Keep data density high — this is a dev tool, not a marketing page
- Use `JetBrains Mono` for any database values or SQL code
- Use subtle glow effects (`--shadow-glow`) for accent hover states
- Use the gradient (green → purple) for branding elements only (logo, welcome title)

### ❌ Don't

- Don't use bright/saturated backgrounds — keep surfaces dark
- Don't add excessive padding in data views — every pixel counts
- Don't use rounded corners > 12px — keep it sharp and professional
- Don't animate data grids or tables — performance matters
- Don't use emojis in production icons — replace with proper SVG icons later
- Don't use inline styles for colors — always use CSS variables
