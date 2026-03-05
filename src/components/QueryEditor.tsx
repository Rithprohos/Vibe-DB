import { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import { useAppStore, MAX_RESULT_ROWS } from '../store/useAppStore';
import { executeQuery, listTables } from '../lib/db';
import { formatCellValue } from '../lib/formatters';
import { Button } from '@/components/ui/button';
import { Play, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

interface Props {
  tabId: string;
}

const EMPTY_ARRAY: any[] = [];

const QueryEditor = memo(function QueryEditor({ tabId }: Props) {
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
  const resizerRef = useRef<HTMLDivElement>(null);
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
  const isResizingRef = useRef(false);
  const currentHeightRef = useRef(300);
  const rafId = useRef<number | null>(null);

  const startResizing = useCallback(() => {
    isResizingRef.current = true;
    setIsResizing(true);
    document.body.classList.add('select-none', 'cursor-row-resize');
  }, []);

  const stopResizing = useCallback(() => {
    isResizingRef.current = false;
    setIsResizing(false);
    document.body.classList.remove('select-none', 'cursor-row-resize');
    setEditorHeight(currentHeightRef.current);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !resizerRef.current?.parentElement) return;
    
    currentHeightRef.current = Math.max(100, Math.min(window.innerHeight - 200, e.clientY - resizerRef.current.parentElement.getBoundingClientRect().top));
    
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        if (resizerRef.current?.parentElement) {
          const editorContainer = resizerRef.current.parentElement.querySelector('.cm-editor');
          if (editorContainer) {
            (editorContainer as HTMLElement).style.height = `${currentHeightRef.current}px`;
          }
        }
        rafId.current = null;
      });
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => resize(e);
    const handleMouseUp = () => stopResizing();

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resize, stopResizing]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove('select-none', 'cursor-row-resize');
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const handleRun = useCallback(async () => {
    let queryToRun = query.trim();
    if (editorRef.current?.view) {
      const view = editorRef.current.view;
      const selection = view.state.selection.main;
      if (!selection.empty) {
        queryToRun = view.state.sliceDoc(selection.from, selection.to).trim();
      }
    }

    if (!activeConnection?.connId || !queryToRun) return;
    setRunning(true);
    const store = useAppStore.getState();
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

      store.addLog({
        sql: queryToRun,
        status: 'success',
        duration: elapsed,
        message: truncated ? `${res.message} (showing ${MAX_RESULT_ROWS} of ${res.rows.length})` : res.message
      });

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

      store.addLog({
        sql: queryToRun,
        status: 'error',
        duration: elapsed,
        message: errMsg
      });
    } finally {
      setRunning(false);
    }
  }, [activeConnection, query, tabId]);

  // Cmd+Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleRun]);



  return (
    <div className="flex flex-col h-full w-full bg-background relative z-0">
      {/* Editor Area */}
      <div 
        className="flex flex-col flex-shrink-0 relative group"
        style={{ height: editorHeight, minHeight: 100 }}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-secondary/30 backdrop-blur-sm">
          <Button 
            size="sm" 
            onClick={handleRun}
            disabled={running || !query.trim()}
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
        
        <CodeMirror
          ref={editorRef}
          value={query}
          height="100%"
          extensions={[sql({ schema })]}
          theme={vscodeDark}
          onChange={(val) => setQuery(val)}
          className="flex-1 w-full bg-background text-[14px] custom-scrollbar-hide focus-within:ring-inset focus-within:ring-1 focus-within:ring-primary/20 cm-editor-wrapper"
          basicSetup={{
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
          }}
        />
        
        {/* Resizer */}
        <div 
          ref={resizerRef}
          className={cn(
            "absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize hover:bg-primary z-20 transition-colors opacity-0 group-hover:opacity-100",
            isResizing && "bg-primary opacity-100 shadow-glow"
          )}
          onMouseDown={startResizing}
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
          <div className="flex flex-col h-full w-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/10 flex-shrink-0">
              <div className="flex items-center space-x-2 text-primary">
                <CheckCircle2 size={16} />
                <span className="font-semibold text-sm">Success</span>
                <span className="text-muted-foreground text-[13px] ml-2 font-medium tracking-wide border-l border-border pl-4">&middot; {result.message}</span>
              </div>
              {duration > 0 && (
                <span className="text-[11px] font-mono text-muted-foreground tracking-widest bg-background border border-border px-2 py-0.5 rounded-full">
                  {duration < 1000 ? `${Math.round(duration)}ms` : `${(duration / 1000).toFixed(2)}s`}
                </span>
              )}
            </div>
            
            {result.columns.length > 0 ? (
              <ScrollArea className="flex-1 w-full h-full bg-background">
                <Table className="w-full text-left max-w-none whitespace-nowrap">
                  <TableHeader className="bg-secondary/60 sticky top-0 backdrop-blur-md z-10 border-b border-border shadow-sm">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="w-[50px] text-muted-foreground font-semibold uppercase tracking-wider text-[10px] text-center border-r border-border/50 bg-background/20 h-8">#</TableHead>
                      {result.columns.map((col, idx) => (
                        <TableHead key={idx} className="font-semibold uppercase tracking-wider text-[10px] text-foreground border-r border-border/50 last:border-0 px-4 h-8 bg-background/20">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row, rowIdx) => (
                      <TableRow key={rowIdx} className={cn(
                        "border-b border-border/20 transition-colors hover:bg-secondary/40",
                        rowIdx % 2 === 0 ? "bg-transparent" : "bg-secondary/10"
                      )}>
                        <TableCell className="font-mono text-muted-foreground/50 text-[10px] text-center border-r border-border/30 bg-background/10">
                          {rowIdx + 1}
                        </TableCell>
                        {row.map((cell, cellIdx) => {
                          const { text, className } = formatCellValue(cell);
                          return (
                            <TableCell key={cellIdx} className="px-4 border-r border-border/30 last:border-0 max-w-[400px] truncate" title={text}>
                                <span className={className}>
                                    {text}
                                </span>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
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
