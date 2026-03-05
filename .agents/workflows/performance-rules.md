---
description: Performance and best practice rules for the VibeDB codebase
---

# VibeDB Performance & Best Practice Rules

These rules must be followed when writing or modifying code in the VibeDB project.

### Priority Tiers

- 🔴 **Must** — Non-negotiable. Violating these causes real bugs, memory leaks, or cascading re-renders.
- 🟡 **Recommended** — Good engineering hygiene. Impact grows as the app scales.

---

## 1. 🔴 Zustand Store: Always Use Granular Selectors

**Rule:** NEVER destructure the entire Zustand store. Always use individual selectors.

```tsx
// ❌ BAD — re-renders on ANY store change
const { tabs, activeTabId, connections } = useAppStore();

// ✅ GOOD — re-renders only when specific value changes
const tabs = useAppStore((s) => s.tabs);
const activeTabId = useAppStore((s) => s.activeTabId);
```

**Why:** `useStore()` with no selector subscribes to the **entire** store. Every state change triggers a re-render in every component that destructures it.

For derived values, compute in the selector: `const logCount = useAppStore((s) => s.logs.length);`

---

## 2. 🔴 Stable useEffect Dependencies

**Rule:** Use primitive or stable values as `useEffect` dependencies, not object references.

```tsx
// ❌ BAD — new object reference on every render
useEffect(() => {
  fetchData(activeConnection.connId);
}, [activeConnection]);

// ✅ GOOD — primitive string, stable reference
const connId = activeConnection?.connId;
useEffect(() => {
  if (connId) fetchData(connId);
}, [connId]);
```

**Why:** Objects are compared by reference. A new reference triggers the effect even if contents haven't changed.

---

## 3. 🟡 Memoize Derived Values

**Rule:** Use `useMemo` for derived computations involving `.find()`, `.filter()`, or array operations.

```tsx
// ❌ BAD — runs .find() on every render
const conn = connections.find((c) => c.id === activeId);

// ✅ GOOD — only re-computes when dependencies change
const conn = useMemo(
  () => connections.find((c) => c.id === activeId),
  [connections, activeId],
);
```

**Exception:** Simple property access doesn't need memo: `const isActive = tab?.type === "data";`

---

## 4. 🟡 Stabilize Callbacks with useCallback

**Rule:** Wrap handlers in `useCallback` when passed as props, used in `useEffect` deps, or in list rendering.

```tsx
// ❌ BAD — new function every render
<button onClick={() => setOpen(!open)}>

// ✅ GOOD — stable reference
const toggle = useCallback(() => setOpen(!open), [open]);
<button onClick={toggle}>
```

**Exception:** Inline handlers not passed as props are fine: `<input onChange={(e) => setVal(e.target.value)} />`

---

## 5. 🟡 Use Refs for High-Frequency Values

**Rule:** For values updating frequently (mouse position, resize), use `useRef` instead of `useState`.

```tsx
// ❌ BAD — re-render on every mouse move
const [width, setWidth] = useState(260);
const resize = (e: MouseEvent) => setWidth(e.clientX);

// ✅ GOOD — update DOM directly, sync state on mouse up
const widthRef = useRef(260);
const resize = (e: MouseEvent) => {
  widthRef.current = e.clientX;
  el.style.width = `${e.clientX}px`;
};
const stopResize = () => setWidth(widthRef.current);
```

---

## 6. 🟡 Use requestAnimationFrame for Resize/Drag

**Rule:** Throttle resize/drag handlers with `requestAnimationFrame` to prevent layout thrashing.

```tsx
const rafId = useRef<number | null>(null);
const resize = (e: MouseEvent) => {
  target.current = e.clientX;
  if (!rafId.current) {
    rafId.current = requestAnimationFrame(() => {
      el.style.width = `${target.current}px`;
      rafId.current = null;
    });
  }
};
```

---

## 7. 🔴 Parallel Data Fetching

**Rule:** Use `Promise.all()` for multiple independent fetches instead of sequential awaits.

```tsx
// ❌ BAD — sequential, total = sum of all
const data = await getData(id);
const count = await getCount(id);

// ✅ GOOD — parallel, total = max of all
const [data, count] = await Promise.all([getData(id), getCount(id)]);
```

---

## 8. 🟡 Rust Backend: Borrow Instead of Clone

**Rule:** Prefer `&str` over `String` and `&T` over `T.clone()` in function parameters.

```rust
// ❌ BAD
fn process(name: String) { ... }
// ✅ GOOD
fn process(name: &str) { ... }
```

---

## 9. 🟡 Component Structure Conventions

| Pattern                   | Rule                                           |
| ------------------------- | ---------------------------------------------- |
| Store access              | Granular selectors only                        |
| Derived state             | `useMemo` for array ops, direct for primitives |
| Callbacks passed as props | Always `useCallback`                           |
| `useEffect` deps          | Primitives only, never object references       |
| High-frequency updates    | `useRef` + direct DOM manipulation             |
| Data fetching             | `Promise.all()` for independent requests       |
| Large components          | Wrap in `React.memo()`                         |
| Async effects             | Always return cleanup with `cancelled` flag    |
| Timers                    | Track in `useRef`, clear on unmount            |
| DOM side effects          | Always return cleanup in `useEffect`           |

---

## 10. 🟡 Zustand Selector Pattern for Reusable Components

**Rule:** For components used in multiple places, define selectors outside the component:

```tsx
const selectors = {
  connections: (s: AppState) => s.connections,
  activeId: (s: AppState) => s.activeSidebarConnectionId,
};

export default function DatabaseBar() {
  const connections = useAppStore(selectors.connections);
  const activeId = useAppStore(selectors.activeId);
}
```

---

## 11. 🔴 Cleanup Async Effects (Prevent State-After-Unmount)

**Rule:** Every async `useEffect` MUST return a cleanup with a `cancelled` flag.

```tsx
// ❌ BAD — setState on unmounted component
useEffect(() => {
  fetchData().then(setData);
}, [id]);

// ✅ GOOD — stale responses ignored
useEffect(() => {
  let cancelled = false;
  fetchData()
    .then((r) => {
      if (!cancelled) setData(r);
    })
    .catch((e) => {
      if (!cancelled) setError(e.toString());
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });
  return () => {
    cancelled = true;
  };
}, [id]);
```

---

## 12. 🔴 Clean Up Timers with Refs

**Rule:** All `setTimeout`/`setInterval` MUST be tracked in a `useRef` and cleared on unmount.

```tsx
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(
  () => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  },
  [],
);

const handleAction = () => {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => setResult("done"), 1000);
};
```

---

## 13. 🔴 Clean Up DOM Side Effects

**Rule:** Every `useEffect` that modifies the DOM MUST return a cleanup function.

```tsx
// ✅ Classes
useEffect(() => {
  if (isResizing) document.body.classList.add("select-none");
  else document.body.classList.remove("select-none");
  return () => document.body.classList.remove("select-none");
}, [isResizing]);

// ✅ Event listeners
useEffect(() => {
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [handler]);
```

---

## 14. 🟡 Stabilize Config Objects for Third-Party Components

**Rule:** Static config objects for third-party components MUST be module-level constants.

```tsx
// ❌ BAD — new object every render, causes reconfiguration
<CodeMirror basicSetup={{ lineNumbers: true, foldGutter: true }} />;

// ✅ GOOD — stable reference
const BASIC_SETUP = { lineNumbers: true, foldGutter: true } as const;
<CodeMirror basicSetup={BASIC_SETUP} />;
```

**Why:** Inline objects create new references each render, forcing expensive internal reconfiguration.

---

## 15. 🟡 Ref-Based Stable Callbacks for Library Extensions

**Rule:** Library extensions that call component handlers should use a `useRef` + `useMemo([], [])`.

```tsx
// ❌ BAD — extension recreated on every keystroke
const ext = useMemo(
  () =>
    keymap.of([
      {
        key: "Mod-Enter",
        run: () => {
          handleRun();
          return true;
        },
      },
    ]),
  [handleRun],
);

// ✅ GOOD — stable extension, latest handler via ref
const handleRunRef = useRef(handleRun);
handleRunRef.current = handleRun;

const ext = useMemo(
  () =>
    keymap.of([
      {
        key: "Mod-Enter",
        run: (view) => {
          handleRunRef.current(view);
          return true;
        },
      },
    ]),
  [],
);
```

**Why:** Recreating extensions forces the library to diff and reconfigure, causing performance issues and subtle bugs (e.g., lost selection state).

---

## 16. 🔴 Virtualize Large Render Lists

**Rule:** Any potentially large scrolling list (table rows, logs, sidebar objects) MUST use virtualization.

```tsx
// ✅ GOOD — virtualized rows
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 34,
  overscan: 8,
});

const virtualRows = rowVirtualizer.getVirtualItems();
```

**Where in VibeDB:**
- `TableView` row list
- `LogDrawer` logs list
- `Sidebar` tables/views list when connection has many objects

---

## 17. 🔴 Paginated Table Fetch Strategy

**Rule:** For paged table data, DO NOT fetch schema/row-count on every page or sort update.

```tsx
// ✅ GOOD
// 1) Structure fetch: table/connection change
// 2) Count fetch: filter/table/connection change
// 3) Data fetch: page/sort/filter change
```

**Why:** Schema and total row count change far less frequently than page data. Re-fetching all three on every page interaction creates avoidable latency and UI stalls.

---

## 18. 🟡 Precompute Lookup Maps for Hot Paths

**Rule:** Never do repeated `.find()` inside row/cell render loops. Build a map once and reuse.

```tsx
// ✅ GOOD
const columnInfoByName = useMemo(() => {
  const map: Record<string, ColumnInfo> = {};
  structure.forEach((c) => {
    map[c.name] = c;
  });
  return map;
}, [structure]);
```

**Why:** Cell rendering is a hot path; repeated linear scans multiply quickly with row × column count.

---

## 19. 🟡 Compute Cell Formatting Once

**Rule:** In a cell renderer, call expensive formatter utilities once and reuse both style + text outputs.

```tsx
// ❌ BAD
formatCellValue(value).className;
formatCellValue(value).text;

// ✅ GOOD
const formatted = formatCellValue(value);
formatted.className;
formatted.text;
```

**Why:** Avoids duplicated work in high-frequency render loops.

---

## 20. 🟡 React Table Memo Discipline

**Rule:** `columns`/`data` configs passed into TanStack Table MUST be memoized with minimal dependency arrays.

```tsx
// ❌ BAD — unrelated deps trigger full table config rebuild
useMemo(() => buildColumns(), [sortCol, page, pageSize, theme]);

// ✅ GOOD — only include values used to build columns
useMemo(() => buildColumns(), [sortCol, sortDir, structure]);
```

**Why:** Rebuilding table config too often invalidates internal memoization and increases render cost.
