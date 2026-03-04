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
const connections = useAppStore((s) => s.connections);
```

**Why:** Zustand's `useStore()` with no selector subscribes to the **entire** store. Every state change (typing in an editor, adding a log, resizing a panel) triggers a re-render in every component that destructures the store. With granular selectors, each component only re-renders when _its_ subscribed slice changes.

**For derived values from the store**, use a selector that computes it:

```tsx
// ✅ Only re-renders when logs.length changes, not on every log mutation
const logCount = useAppStore((s) => s.logs.length);
```

---

## 2. 🔴 Stable useEffect Dependencies

**Rule:** Use primitive or stable values as `useEffect` dependencies, not object references.

```tsx
// ❌ BAD — activeConnection is a new object reference on every render
useEffect(() => {
  if (!activeConnection?.connId) return;
  fetchData(activeConnection.connId);
}, [activeConnection]);

// ✅ GOOD — connId is a primitive string, stable reference
const connId = activeConnection?.connId;
useEffect(() => {
  if (!connId) return;
  fetchData(connId);
}, [connId]);
```

**Why:** Objects are compared by reference in React's dependency array. Even if the object's contents haven't changed, a new reference (from a store update, for example) will trigger the effect again, causing unnecessary API calls and re-renders.

---

## 3. 🟡 Memoize Derived Values

**Rule:** Use `useMemo` for derived computations that involve `.find()`, `.filter()`, or other array operations.

```tsx
// ❌ BAD — runs .find() on every render
const activeConnection = connections.find(
  (c) => c.id === activeSidebarConnectionId,
);

// ✅ GOOD — only re-computes when dependencies change
const activeConnection = useMemo(
  () => connections.find((c) => c.id === activeSidebarConnectionId),
  [connections, activeSidebarConnectionId],
);
```

**Exception:** Simple property access or primitives don't need memo:

```tsx
// This is fine without useMemo
const isDataTabActive = activeTab?.type === "data";
```

---

## 4. 🟡 Stabilize Callbacks with useCallback

**Rule:** Wrap event handlers in `useCallback` when they are:

- Passed as props to child components
- Used as dependencies in `useEffect`
- Used in `.map()` or list rendering contexts

```tsx
// ❌ BAD — new function reference every render
<button onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}>

// ✅ GOOD — stable reference
const toggleAiPanel = useCallback(
  () => setIsAiPanelOpen(!isAiPanelOpen),
  [setIsAiPanelOpen, isAiPanelOpen]
);
<button onClick={toggleAiPanel}>
```

**Exception:** Inline handlers in simple event handlers that don't get passed as props are fine:

```tsx
// This is OK — the handler stays within the same component
<input onChange={(e) => setSearch(e.target.value)} />
```

---

## 5. 🟡 Use Refs for High-Frequency Values

**Rule:** For values that update very frequently (mouse position, resize state, animation frames), use `useRef` instead of `useState` to avoid triggering re-renders.

```tsx
// ❌ BAD — triggers re-render on every mouse move
const [width, setWidth] = useState(260);
const resize = (e: MouseEvent) => setWidth(e.clientX);

// ✅ GOOD — updates DOM directly, syncs state on mouse up
const widthRef = useRef(260);
const resize = (e: MouseEvent) => {
  widthRef.current = e.clientX;
  sidebarRef.current!.style.width = `${e.clientX}px`;
};
const stopResize = () => setSidebarWidth(widthRef.current); // sync to state once
```

---

## 6. 🟡 Use requestAnimationFrame for Resize/Drag Operations

**Rule:** Throttle resize and drag handlers with `requestAnimationFrame` to prevent layout thrashing.

```tsx
// ❌ BAD — can fire faster than the browser can paint
const resize = (e: MouseEvent) => {
  element.style.width = `${e.clientX}px`;
};

// ✅ GOOD — one update per frame
const rafId = useRef<number | null>(null);
const resize = (e: MouseEvent) => {
  targetWidth.current = e.clientX;
  if (!rafId.current) {
    rafId.current = requestAnimationFrame(() => {
      element.style.width = `${targetWidth.current}px`;
      rafId.current = null;
    });
  }
};
```

---

## 7. 🔴 Parallel Data Fetching

**Rule:** When fetching multiple independent pieces of data, use `Promise.all()` instead of sequential awaits.

```tsx
// ❌ BAD — sequential, total time = sum of all
const data = await getTableData(tableName, connId);
const count = await getTableRowCount(tableName, connId);
const structure = await getTableStructure(tableName, connId);

// ✅ GOOD — parallel, total time = max of all
const [data, count, structure] = await Promise.all([
  getTableData(tableName, connId),
  getTableRowCount(tableName, connId),
  getTableStructure(tableName, connId),
]);
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

This ensures selector identity stability and makes the component's store dependencies self-documenting.

---

## 11. 🔴 Cleanup Async Effects (Prevent State-After-Unmount)

**Rule:** Every `useEffect` that triggers an async operation MUST return a cleanup function with a `cancelled` flag to prevent `setState` calls on unmounted components.

```tsx
// ❌ BAD — if component unmounts during fetch, setState is called on unmounted component
useEffect(() => {
  fetchData().then(setData);
}, [id]);

// ✅ GOOD — stale responses are ignored
useEffect(() => {
  let cancelled = false;
  fetchData()
    .then((result) => {
      if (!cancelled) setData(result);
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

**Why:** When a component unmounts (e.g., user switches tabs) while an async fetch is still in-flight, the `.then()` callback fires after the component is gone, causing React warnings and potential bugs.

---

## 12. 🔴 Clean Up Timers with Refs

**Rule:** All `setTimeout` / `setInterval` calls MUST be tracked in a `useRef` and cleared on unmount.

```tsx
// ❌ BAD — timer fires after unmount, calls setState on dead component
const handleAction = () => {
  setTimeout(() => setResult("done"), 1000);
};

// ✅ GOOD — timer is tracked and cleared
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };
}, []);

const handleAction = () => {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => setResult("done"), 1000);
};
```

---

## 13. 🔴 Clean Up DOM Side Effects

**Rule:** Every `useEffect` that modifies the DOM (adding classes, event listeners, etc.) MUST return a cleanup function that reverses the modification.

```tsx
// ❌ BAD — classes leak onto body if component unmounts while resizing
useEffect(() => {
  if (isResizing) document.body.classList.add("select-none");
  else document.body.classList.remove("select-none");
}, [isResizing]);

// ✅ GOOD — always clean up on unmount
useEffect(() => {
  if (isResizing) document.body.classList.add("select-none");
  else document.body.classList.remove("select-none");
  return () => document.body.classList.remove("select-none");
}, [isResizing]);
```

**Same applies to event listeners:**

```tsx
// ✅ Always return removeEventListener
useEffect(() => {
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [handler]);
```
