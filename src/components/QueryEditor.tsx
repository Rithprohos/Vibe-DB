import { useState, useRef, useEffect, useMemo, memo, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { useAppStore, MAX_RESULT_ROWS } from '../store/useAppStore';
import { executeQuery, listTables } from '../lib/db';
import { formatCellValue } from '../lib/formatters';
import { Button } from '@/components/ui/button';
import { Play, Loader2, AlertCircle, CheckCircle2, ChevronsLeftRightEllipsis, Rows3, WrapText } from 'lucide-react';
import { cn } from '@/lib/utils';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDevRenderCounter } from '@/lib/dev-performance';

interface Props {
  tabId: string;
}

interface SelectedCell {
  rowIndex: number;
  columnIndex: number;
}

interface EditorViewLike {
  state: {
    selection: {
      main: {
        empty: boolean;
        from: number;
        to: number;
      };
    };
    sliceDoc: (from: number, to: number) => string;
  };
}

const EMPTY_ARRAY: any[] = [];
const MIN_EDITOR_HEIGHT = 120;
const MIN_RESULTS_HEIGHT = 180;

// Memoized cell component to prevent re-render during scroll
interface TableCellProps {
  cell: unknown;
  rowIdx: number;
  cellIdx: number;
  isActive: boolean;
  wrapCells: boolean;
  onSelect: (rowIdx: number, cellIdx: number) => void;
}

const TableCell = memo(function TableCell({
  cell,
  rowIdx,
  cellIdx,
  isActive,
  wrapCells,
  onSelect,
}: TableCellProps) {
  const { text, className } = formatCellValue(cell);
  const isNumeric = typeof cell === 'number';

  const isFirstColumn = cellIdx === 0;

  return (
    <td
      className={cn(
        'overflow-hidden border-b border-r border-border/50 px-4 py-2.5 align-top last:border-r-0',
        isFirstColumn ? 'w-[80px] min-w-[80px] max-w-[80px]' : 'w-[220px] min-w-[220px] max-w-[220px]',
        isActive && 'bg-primary/10 outline outline-1 outline-primary/40 -outline-offset-1'
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(rowIdx, cellIdx)}
        className={cn(
          'block w-full overflow-hidden rounded-sm py-0.5 outline-none transition-opacity hover:opacity-100 focus-visible:ring-1 focus-visible:ring-primary/40',
          isNumeric ? 'text-right' : 'text-left'
        )}
        title={text}
      >
        <span
          className={cn(
            'block w-full overflow-hidden',
            wrapCells
              ? 'whitespace-pre-wrap break-words leading-5'
              : 'text-ellipsis whitespace-nowrap',
            className
          )}
        >
          {text}
        </span>
      </button>
    </td>
  );
});

// Memoized row component to prevent re-render during scroll
// Only re-renders when: row data changes, wrapCells changes, or THIS row's selection changes
interface TableRowProps {
  row: unknown[];
  rowIdx: number;
  selectedColumnIndex: number | null;
  wrapCells: boolean;
  onSelectCell: (rowIdx: number, cellIdx: number) => void;
  measureRef: (node: HTMLElement | null) => void;
}

const TableRow = memo(function TableRow({
  row,
  rowIdx,
  selectedColumnIndex,
  wrapCells,
  onSelectCell,
  measureRef,
}: TableRowProps) {
  return (
    <tr
      data-index={rowIdx}
      ref={measureRef}
      className={cn(
        rowIdx % 2 === 0 ? 'bg-background' : 'bg-secondary/12',
        'hover:bg-secondary/30'
      )}
    >
      {row.map((cell, cellIdx) => (
        <TableCell
          key={cellIdx}
          cell={cell}
          rowIdx={rowIdx}
          cellIdx={cellIdx}
          isActive={selectedColumnIndex === cellIdx}
          wrapCells={wrapCells}
          onSelect={onSelectCell}
        />
      ))}
    </tr>
  );
});

function isEditorViewLike(value: unknown): value is EditorViewLike {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<EditorViewLike>;
  const state = candidate.state;
  const main = state?.selection?.main;

  return Boolean(
    state &&
    typeof state.sliceDoc === 'function' &&
    main &&
    typeof main.empty === 'boolean' &&
    typeof main.from === 'number' &&
    typeof main.to === 'number'
  );
}

const BASIC_SETUP = {
  lineNumbers: true,
  foldGutter: true,
  dropCursor: true,
  allowMultipleSelections: true,
  indentOnInput: true,
  bracketMatching: true,
  closeBrackets: true,
  autocompletion: true,
  rectangularSelection: true,
  crosshairCursor: true,
  highlightActiveLine: true,
  highlightSelectionMatches: true,
  closeBracketsKeymap: true,
  defaultKeymap: true,
  searchKeymap: true,
  historyKeymap: true,
  foldKeymap: true,
  completionKeymap: true,
  lintKeymap: true,
} as const;

const QueryEditor = memo(function QueryEditor({ tabId }: Props) {
  useDevRenderCounter('QueryEditor', tabId);
  const tab = useAppStore(useCallback(s => s.tabs.find(t => t.id === tabId), [tabId]));
  const activeConnection = useAppStore(useCallback(s => s.connections.find(c => c.id === tab?.connectionId), [tab?.connectionId]));
  const tablesOptions = useAppStore(useCallback(s => s.tablesByConnection[tab?.connectionId || ''], [tab?.connectionId]));
  const tables = tablesOptions || EMPTY_ARRAY;
  
  const query = tab?.query || '';
  const result = tab?.result || null;
  const error = tab?.error || '';
  
  const [running, setRunning] = useState(false);
  const [duration, setDuration] = useState(0);
  const [editorHeight, setEditorHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const handleSelectCell = useCallback((rowIdx: number, cellIdx: number) => {
    setSelectedCell({ rowIndex: rowIdx, columnIndex: cellIdx });
  }, []);
  const [wrapCells, setWrapCells] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const editorPaneRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  const schema = useMemo(() => {
    const s: Record<string, string[]> = {};
    tables.forEach(t => {
      s[t.name] = [];
    });
    return s;
  }, [tables]);

  const setQuery = useCallback((val: string) => {
    useAppStore.getState().updateTab(tabId, { query: val });
  }, [tabId]);

  // Resizing logic - using refs to avoid effect re-runs
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(300);
  const currentHeightRef = useRef(300);
  const rafId = useRef<number | null>(null);

  const scheduleEditorHeight = useCallback((nextHeight: number) => {
    currentHeightRef.current = nextHeight;

    if (rafId.current) return;

    rafId.current = requestAnimationFrame(() => {
      if (editorPaneRef.current) {
        editorPaneRef.current.style.height = `${currentHeightRef.current}px`;
      }
      rafId.current = null;
    });
  }, []);

  const startResizing = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = editorPaneRef.current?.getBoundingClientRect().height ?? currentHeightRef.current;
    setIsResizing(true);
    document.body.classList.add('select-none', 'cursor-row-resize');
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    document.body.classList.remove('select-none', 'cursor-row-resize');
    setEditorHeight(currentHeightRef.current);
  }, []);

  const resize = useCallback((clientY: number) => {
    if (!rootRef.current) return;

    const containerHeight = rootRef.current.getBoundingClientRect().height;
    const maxEditorHeight = Math.max(MIN_EDITOR_HEIGHT, containerHeight - MIN_RESULTS_HEIGHT);
    const nextHeight = Math.max(
      MIN_EDITOR_HEIGHT,
      Math.min(maxEditorHeight, dragStartHeightRef.current + (clientY - dragStartYRef.current))
    );

    scheduleEditorHeight(nextHeight);
  }, [scheduleEditorHeight]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => resize(e.clientY);
    const handlePointerUp = () => stopResizing();

    if (isResizing) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isResizing, resize, stopResizing]);

  useEffect(() => {
    currentHeightRef.current = editorHeight;
    if (editorPaneRef.current) {
      editorPaneRef.current.style.height = `${editorHeight}px`;
    }
  }, [editorHeight]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove('select-none', 'cursor-row-resize');
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  useEffect(() => {
    setSelectedCell(null);
  }, [result, error]);

  const handleRun = useCallback(async (editorView?: any) => {
    // Read query from store to avoid stale closure
    const store = useAppStore.getState();
    const currentTab = store.tabs.find(t => t.id === tabId);
    let queryToRun = (currentTab?.query || '').trim();

    // Use the passed EditorView (from keymap) or fallback to ref
    const refView = editorRef.current?.view;
    const view = isEditorViewLike(editorView)
      ? editorView
      : isEditorViewLike(refView)
        ? refView
        : null;

    if (view) {
      const selection = view.state.selection.main;
      if (!selection.empty) {
        queryToRun = view.state.sliceDoc(selection.from, selection.to).trim();
      }
    }

    if (!activeConnection?.connId || !queryToRun) return;
    setRunning(true);
    store.updateTab(tabId, { error: '', result: null });
    const start = performance.now();

    try {
      const res = await executeQuery(queryToRun, activeConnection.connId);
      const elapsed = performance.now() - start;
      setDuration(elapsed);
      
      const truncated = res.rows.length > MAX_RESULT_ROWS;
      const resultToStore = truncated
        ? { ...res, rows: res.rows.slice(0, MAX_RESULT_ROWS) }
        : res;
      
      store.updateTab(tabId, { result: resultToStore, error: '' });

      const upper = queryToRun.toUpperCase();
      if (upper.startsWith('CREATE') || upper.startsWith('DROP') || upper.startsWith('ALTER')) {
        const tablesList = await listTables(activeConnection.connId);
        store.setTables(activeConnection.id, tablesList);
      }
    } catch (e: any) {
      const elapsed = performance.now() - start;
      setDuration(elapsed);
      const errMsg = e.toString();
      store.updateTab(tabId, { error: errMsg, result: null });

    } finally {
      setRunning(false);
    }
  }, [activeConnection, tabId]);

  // Keep a stable ref to the latest handleRun so the keymap never needs to be recreated
  const handleRunRef = useRef(handleRun);
  handleRunRef.current = handleRun;

  // Cmd+Enter keymap extension for CodeMirror — stable, never recreated
  const runKeymap = useMemo(
    () =>
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: (view) => {
              handleRunRef.current(view);
              return true;
            },
          },
        ])
      ),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const selectedCellDetails = useMemo(() => {
    if (!result || !selectedCell) return null;

    const columnName = result.columns[selectedCell.columnIndex];
    const row = result.rows[selectedCell.rowIndex];
    if (!columnName || !row) return null;

    const rawValue = row[selectedCell.columnIndex];
    const { text, className } = formatCellValue(rawValue, { prettyJson: true });

    return {
      columnName,
      rowNumber: selectedCell.rowIndex + 1,
      rawValue,
      text,
      className,
    };
  }, [result, selectedCell]);

  const hasRows = Boolean(result && result.columns.length > 0);
  const rowCount = result?.rows.length ?? 0;
  const columnCount = result?.columns.length ?? 0;
  const canRun = Boolean(activeConnection?.connId) && !running;
  const estimateSize = useCallback(() => (wrapCells ? 72 : 44), [wrapCells]);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => resultsScrollRef.current,
    estimateSize,
    overscan: 10,
  });

  // Keep virtualizer reference stable for the measureElement callback
  const virtualizerRef = useRef(rowVirtualizer);
  virtualizerRef.current = rowVirtualizer;

  // Stable ref callback for measuring elements - critical for scroll performance
  // Uses ref to avoid dependency on rowVirtualizer object which changes when data changes
  const measureElement = useCallback((node: HTMLElement | null) => {
    if (node) {
      virtualizerRef.current.measureElement(node);
    }
  }, []);
  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualPaddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const virtualPaddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;



  return (
    <div ref={rootRef} className="flex flex-col h-full w-full bg-background relative z-0">
      {/* Editor Area */}
      <div 
        ref={editorPaneRef}
        className="flex flex-col flex-shrink-0 relative group min-h-0 overflow-hidden"
        style={{ height: editorHeight, minHeight: 100 }}
      >
        <div className="relative z-10 flex items-center justify-between px-4 h-12 border-b border-border bg-secondary/30 backdrop-blur-sm">
          <Button 
            size="sm" 
            onClick={() => void handleRun()}
            disabled={!canRun}
            className="h-8 shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {running ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Play size={14} className="mr-2" />}
            {running ? 'Running...' : 'Run Query'}
          </Button>
          <div className="flex items-center space-x-4">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider bg-background/50 px-2 py-1 border border-border rounded shadow-sm">
              ⌘ + Enter
            </span>
          </div>
        </div>
        
        <div className="relative z-0 min-h-0 flex-1 overflow-hidden">
          <CodeMirror
            ref={editorRef}
            value={query}
            height="100%"
            extensions={[sql({ schema }), runKeymap]}
            theme={vscodeDark}
            onChange={setQuery}
            className="h-full w-full overflow-hidden bg-background text-[14px] custom-scrollbar-hide focus-within:ring-inset focus-within:ring-1 focus-within:ring-primary/20 cm-editor-wrapper"
            basicSetup={BASIC_SETUP}
          />
        </div>
        
        {/* Resizer */}
        <div 
          ref={resizerRef}
          className={cn(
            "absolute bottom-0 left-0 right-0 h-2 cursor-row-resize hover:bg-primary z-20 transition-colors opacity-0 group-hover:opacity-100 touch-none",
            isResizing && "bg-primary opacity-100 shadow-glow"
          )}
          onPointerDown={startResizing}
        />
      </div>

      <div className="h-[1px] bg-border w-full flex-shrink-0" />

      {/* Results Area */}
      <div className="flex-1 flex flex-col min-h-0 bg-background relative z-0">
        {error ? (
          <div className="p-6 h-full flex flex-col">
            <div className="flex items-center space-x-2 text-destructive mb-4">
              <AlertCircle size={18} />
              <span className="font-bold text-sm tracking-tight">Database Error</span>
            </div>
            <div className="p-5 bg-destructive/10 border border-destructive/20 text-destructive text-[13px] font-mono rounded-xl shadow-inner flex-1 overflow-auto whitespace-pre-wrap leading-relaxed custom-scrollbar">
              {error}
            </div>
          </div>
        ) : result ? (
          <div className="flex flex-col h-full w-full min-h-0">
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-secondary/10 flex-shrink-0">
              <div className="flex items-center gap-3 text-primary min-w-0">
                <div className="flex items-center gap-2 shrink-0">
                  <CheckCircle2 size={16} />
                  <span className="font-semibold text-sm">Success</span>
                </div>
                <span className="text-muted-foreground text-[13px] font-medium tracking-wide border-l border-border pl-3 truncate">
                  {result.message}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium text-muted-foreground tracking-[0.18em] uppercase px-2">
                  <span>{rowCount} rows</span>
                  <span className="text-border">/</span>
                  <span>{columnCount} cols</span>
                </div>
                {duration > 0 && (
                  <span className="text-[11px] font-mono text-muted-foreground tracking-widest bg-background border border-border px-2 py-0.5 rounded-full">
                    {duration < 1000 ? `${Math.round(duration)}ms` : `${(duration / 1000).toFixed(2)}s`}
                  </span>
                )}
              </div>
            </div>

            {hasRows ? (
              <div className="flex flex-1 min-h-0 min-w-0">
                <div className="flex min-w-0 flex-1 flex-col border-r border-border/70">
                  <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-secondary/20 px-4 py-2.5">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      <Rows3 size={13} />
                      <span>Results Grid</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setWrapCells(current => !current)}
                      className={cn(
                        'h-7 gap-2 px-2 text-xs text-muted-foreground hover:text-foreground',
                        wrapCells && 'bg-secondary text-foreground'
                      )}
                    >
                      <WrapText size={13} />
                      {wrapCells ? 'Wrapped' : 'Truncate'}
                    </Button>
                  </div>

                  <div ref={resultsScrollRef} className="flex-1 min-h-0 min-w-0 overflow-auto bg-background">
                    <table className="border-separate border-spacing-0 text-left" style={{ width: `${80 + (columnCount - 1) * 220}px` }}>
                      <thead className="sticky top-0 z-20 bg-background shadow-[0_1px_0_0_var(--border-primary)]">
                        <tr className="border-b border-border">
                          {result.columns.map((col, idx) => (
                            <th
                              key={idx}
                              className={cn(
                                "h-11 overflow-hidden border-b border-r border-border bg-background px-4 text-left text-[12px] font-semibold tracking-[0.04em] text-foreground last:border-r-0",
                                idx === 0 ? "w-[80px] min-w-[80px] max-w-[80px]" : "w-[220px] min-w-[220px] max-w-[220px]"
                              )}
                            >
                              <span className="block overflow-hidden text-ellipsis whitespace-nowrap leading-5">
                                {col}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {virtualPaddingTop > 0 && (
                          <tr>
                            <td colSpan={columnCount} style={{ height: `${virtualPaddingTop}px`, padding: 0 }} />
                          </tr>
                        )}

                        {virtualRows.map((virtualRow) => {
                          const rowIdx = virtualRow.index;
                          const isRowSelected = selectedCell?.rowIndex === rowIdx;
                          return (
                            <TableRow
                              key={rowIdx}
                              row={result.rows[rowIdx]}
                              rowIdx={rowIdx}
                              selectedColumnIndex={isRowSelected ? selectedCell!.columnIndex : null}
                              wrapCells={wrapCells}
                              onSelectCell={handleSelectCell}
                              measureRef={measureElement}
                            />
                          );
                        })}

                        {virtualPaddingBottom > 0 && (
                          <tr>
                            <td colSpan={columnCount} style={{ height: `${virtualPaddingBottom}px`, padding: 0 }} />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <aside className="hidden w-[320px] shrink-0 flex-col bg-secondary/10 xl:flex">
                  <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    <ChevronsLeftRightEllipsis size={13} />
                    <span>Cell Inspector</span>
                  </div>
                  {selectedCellDetails ? (
                    <div className="flex min-h-0 flex-1 flex-col">
                      <div className="border-b border-border/70 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Row {selectedCellDetails.rowNumber}</div>
                        <div className="mt-1 truncate font-semibold text-foreground">{selectedCellDetails.columnName}</div>
                      </div>
                      <div className="flex-1 overflow-auto p-4">
                        <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Value</div>
                        <pre className={cn('whitespace-pre-wrap break-words rounded-xl border border-border/70 bg-background/80 p-4 text-[12px] leading-6 shadow-inner', selectedCellDetails.className)}>
                          {selectedCellDetails.text}
                        </pre>
                        <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Type</div>
                        <div className="mt-2 text-sm text-foreground">
                          {selectedCellDetails.rawValue === null || selectedCellDetails.rawValue === undefined
                            ? 'NULL'
                            : Array.isArray(selectedCellDetails.rawValue)
                              ? 'Array'
                              : typeof selectedCellDetails.rawValue}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      Select a cell to inspect long values without expanding the grid width.
                    </div>
                  )}
                </aside>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <span className="text-sm font-medium opacity-70 border border-border/50 p-4 rounded-xl bg-secondary/20 shadow-inner max-w-sm text-center">
                  {result.message}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-grid-pattern">
            <div className="w-20 h-20 rounded-2xl bg-secondary shadow-inner flex items-center justify-center mb-6">
              <Play size={32} className="opacity-30 translate-x-1" />
            </div>
            <span className="text-sm font-medium tracking-wide">Enter a query above and press <span className="font-mono bg-background border px-1.5 py-0.5 rounded ml-1 text-xs">Run</span></span>
          </div>
        )}
      </div>
    </div>
  );
});

export default QueryEditor;
