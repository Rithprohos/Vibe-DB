# VibeDB Style Guide

## Direction

VibeDB should feel like a developer tool, not a SaaS dashboard.

- Dark-first
- Dense, utilitarian, and calm
- Sharp surfaces over soft cards
- Accent color used sparingly
- Data surfaces optimized for scanning, not decoration

## Visual Rules

- Prefer square or near-square corners.
- Default radii come from [`src/index.css`](/Users/a1234/Documents/Project/vibe-db/src/index.css):
  - `--radius-sm: 2px`
  - `--radius-md: 3px`
  - `--radius-lg: 4px`
- Do not introduce large rounded corners on panels, dialogs, tables, drawers, menus, or buttons.
- Avoid pill buttons and pill cards. `rounded-full` is allowed only for status dots and similar micro-indicators.
- Prefer borders, separators, and contrast over blur, glow, or oversized shadows.
- Keep glass/glow effects minimal and out of primary work surfaces.

## Color

Use CSS variables only. Do not hardcode colors in components.

Core dark tokens:

- `--bg-primary`: app background
- `--bg-secondary`: sidebars, toolbars, status bars
- `--bg-tertiary`: controls, headers, muted surfaces
- `--bg-surface`: dialogs and contained panels
- `--bg-hover`: hover state
- `--bg-active`: active state
- `--accent-primary`: `#00e599`
- `--accent-secondary`: secondary accent
- `--border-primary`: strong border
- `--border-secondary`: subtle divider

Rules:

- Neon green is the primary accent. Use it for active state, focus, success, and key actions.
- Secondary accent should not dominate the UI.
- Destructive and warning colors should stay localized to alerts and risky actions.
- Large bright fills should be rare.

## Typography

- App chrome: `Inter`
- Data, SQL, paths, identifiers, counts: `JetBrains Mono`
- Keep UI copy compact.
- Prefer uppercase micro-labels for section headers and metadata labels.

## Component Guidance

### Buttons

- Primary buttons should read as precise actions, not marketing CTAs.
- Use small radii and compact heights.
- Avoid oversized rounded call-to-action styling.
- Ghost buttons should stay visually quiet until hover.

### Inputs / Selects

- Use border-defined fields with subtle focus treatment.
- Keep shapes sharp and spacing compact.
- Placeholder text should stay low-contrast.

### Dialogs / Popovers / Menus

- Use hard edges, visible borders, and restrained shadow.
- Avoid soft-card presentation.
- Dialogs should feel like tool windows.

### Tables / Query / Inspectors

- Prioritize scanability and density.
- Use mono where values or schema matter.
- Keep row hover, selected state, and resize affordances clear.
- Do not trade editability or performance for visual flair.

### Sidebar / Tabs / Toolbars

- These should feel IDE-like.
- Active states should rely on border, background shift, and accent color.
- Keep badges and counters compact and mostly square.

## Interaction Rules

- Preserve editable-grid behavior and keyboard flows.
- Do not weaken hover/focus/active contrast in the name of minimalism.
- Resizers must remain obvious on hover and drag.
- Dense layouts are preferred, but not at the cost of hit targets for core actions.

## Do

- Use CSS variables from [`src/index.css`](/Users/a1234/Documents/Project/vibe-db/src/index.css)
- Favor sharp rectangles and compact layouts
- Use mono for data-heavy surfaces
- Keep dialogs, drawers, and inspectors tool-like
- Use accent color intentionally, not everywhere

## Don't

- Don't make the UI look rounded, playful, or consumer-SaaS
- Don't add large-radius cards or pill-shaped primary buttons
- Don't overuse glow, blur, gradients, or decorative shadows
- Don't add generous padding to dense data views
- Don't hardcode colors in component classes when a token exists
