import { useState, useRef, useEffect, useMemo, memo, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { sql } from '@codemirror/lang-sql';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

import { executeQuery, listTables } from '../lib/db';
import {
  analyzeQueryExecutionPolicy,
  getBlockedQueryEditorMessage,
  type QueryExecutionPolicy,
} from '@/lib/queryGuard';
import { buildSavedQueryDefaultName } from '@/lib/savedQueries';
import { useDevRenderCounter } from '@/lib/dev-performance';
import { getCodeMirrorTheme } from '@/lib/codemirrorTheme';
import { useAppStore, MAX_RESULT_ROWS } from '../store/useAppStore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { QueryEditorPane } from './query-editor/EditorPane';
import { QueryResultsPane } from './query-editor/ResultsPane';
import { isEditorViewLike, type EditorViewLike, type SelectedCell } from './query-editor/types';
import SavedQueryDialog, { type SavedQueryDialogMode } from './SavedQueryDialog';

interface Props {
  tabId: string;
}

const EMPTY_ARRAY: any[] = [];
const MIN_EDITOR_HEIGHT = 120;
const MIN_RESULTS_HEIGHT = 180;

interface SaveDialogState {
  open: boolean;
  mode: SavedQueryDialogMode;
  initialName: string;
}

interface PendingConfirmationState {
  query: string;
  policy: QueryExecutionPolicy;
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
  const connectionId = useAppStore(useCallback(s => s.tabs.find(t => t.id === tabId)?.connectionId ?? '', [tabId]));
  const title = useAppStore(useCallback(s => s.tabs.find(t => t.id === tabId)?.title ?? '', [tabId]));
  const query = useAppStore(useCallback(s => s.tabs.find(t => t.id === tabId)?.query ?? '', [tabId]));
  const theme = useAppStore(s => s.theme);
  const result = useAppStore(useCallback(s => s.tabs.find(t => t.id === tabId)?.result ?? null, [tabId]));
  const error = useAppStore(useCallback(s => s.tabs.find(t => t.id === tabId)?.error ?? '', [tabId]));
  const savedQueryId = useAppStore(useCallback(s => s.tabs.find(t => t.id === tabId)?.savedQueryId ?? null, [tabId]));
  const activeConnection = useAppStore(useCallback(s => s.connections.find(c => c.id === connectionId), [connectionId]));
  const linkedSavedQuery = useAppStore(
    useCallback(
      s => (savedQueryId ? s.savedQueries.find(savedQuery => savedQuery.id === savedQueryId) ?? null : null),
      [savedQueryId],
    ),
  );
  const showToast = useAppStore(s => s.showToast);
  const tablesOptions = useAppStore(useCallback(s => s.tablesByConnection[connectionId], [connectionId]));
  const tables = tablesOptions || EMPTY_ARRAY;

  const [running, setRunning] = useState(false);
  const [duration, setDuration] = useState(0);
  const [editorHeight, setEditorHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [wrapEditor, setWrapEditor] = useState(false);
  const [wrapCells, setWrapCells] = useState(false);
  const [saveDialogState, setSaveDialogState] = useState<SaveDialogState>({
    open: false,
    mode: 'create',
    initialName: '',
  });
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmationState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const editorPaneRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(300);
  const currentHeightRef = useRef(300);
  const rafId = useRef<number | null>(null);

  const schema = useMemo(() => {
    const nextSchema: Record<string, string[]> = {};
    tables.forEach((table) => {
      nextSchema[table.name] = [];
    });
    return nextSchema;
  }, [tables]);

  const setQuery = useCallback((value: string) => {
    useAppStore.getState().updateTab(tabId, { query: value });
  }, [tabId]);

  const handleSelectCell = useCallback((rowIdx: number, cellIdx: number) => {
    setSelectedCell({ rowIndex: rowIdx, columnIndex: cellIdx });
  }, []);

  const activeConnectionId = activeConnection?.id;
  const activeConnectionConnId = activeConnection?.connId;
  const isProductionConnection = activeConnection?.tag === 'production';
  const saveButtonLabel = linkedSavedQuery ? 'Update' : 'Save';
  const canSave = !running;

  const getQueryToRun = useCallback((editorView?: EditorViewLike) => {
    const store = useAppStore.getState();
    const currentTab = store.tabs.find(t => t.id === tabId);
    let queryToRun = (currentTab?.query || '').trim();

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

    return queryToRun;
  }, [tabId]);

  // On failed queries, Tauri can emit the SQL log a tick after the promise rejects.
  // Retry briefly so the editor duration can use the same backend timing as Logs.
  const getLoggedDuration = useCallback(
    async (sql: string, status: 'success' | 'error', startedAtMs: number) => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const match = useAppStore
          .getState()
          .logs.find(
            (log) =>
              log.status === status &&
              log.sql === sql &&
              log.timestamp >= startedAtMs,
          );

        if (match) {
          return match.duration;
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 16);
        });
      }

      return null;
    },
    [],
  );

  const openSaveDialog = useCallback((mode: SavedQueryDialogMode) => {
    const store = useAppStore.getState();
    const currentTab = store.tabs.find(tab => tab.id === tabId);
    setSaveDialogState({
      open: true,
      mode,
      initialName: buildSavedQueryDefaultName(currentTab?.savedQueryName ?? currentTab?.title ?? title),
    });
  }, [tabId, title]);

  const handleUpdateSavedQuery = useCallback(() => {
    const store = useAppStore.getState();
    const currentTab = store.tabs.find(tab => tab.id === tabId);
    if (!currentTab) return;

    const currentSavedQuery = currentTab.savedQueryId
      ? store.savedQueries.find(savedQuery => savedQuery.id === currentTab.savedQueryId)
      : null;

    if (!currentSavedQuery) {
      openSaveDialog('create');
      return;
    }

    try {
      const nextSavedQuery = store.saveQuery({
        id: currentSavedQuery.id,
        name: currentSavedQuery.name,
        sql: currentTab.query ?? '',
        connectionId: currentTab.connectionId,
      });
      store.updateTab(tabId, {
        savedQueryId: nextSavedQuery.id,
        savedQueryName: nextSavedQuery.name,
        title: nextSavedQuery.name,
      });
      showToast({ type: 'success', message: 'Saved query updated' });
    } catch (errorValue) {
      showToast({
        type: 'error',
        message: errorValue instanceof Error ? errorValue.message : 'Unable to update saved query',
      });
    }
  }, [openSaveDialog, showToast, tabId]);

  const handleSave = useCallback(() => {
    if (linkedSavedQuery) {
      handleUpdateSavedQuery();
      return;
    }

    openSaveDialog('create');
  }, [handleUpdateSavedQuery, linkedSavedQuery, openSaveDialog]);

  const handleSaveAs = useCallback(() => {
    openSaveDialog('save-as');
  }, [openSaveDialog]);

  const handleSubmitSaveDialog = useCallback(async ({
    name,
  }: {
    name: string;
  }) => {
    const store = useAppStore.getState();
    const currentTab = store.tabs.find(tab => tab.id === tabId);
    if (!currentTab) {
      throw new Error('Query tab no longer exists');
    }

    const savedQuery = store.saveQuery({
      name,
      sql: currentTab.query ?? '',
      connectionId: currentTab.connectionId,
    });

    store.updateTab(tabId, {
      savedQueryId: savedQuery.id,
      savedQueryName: savedQuery.name,
      title: savedQuery.name,
    });

    showToast({
      type: 'success',
      message: saveDialogState.mode === 'save-as' ? 'Saved as a new query' : 'Query saved',
    });
  }, [saveDialogState.mode, showToast, tabId]);

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

  const startResizing = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = event.clientY;
    dragStartHeightRef.current =
      editorPaneRef.current?.getBoundingClientRect().height ?? currentHeightRef.current;
    setIsResizing(true);
    document.body.classList.add('select-none', 'cursor-row-resize');
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
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
    const handlePointerMove = (event: PointerEvent) => resize(event.clientY);
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

  useEffect(() => {
    return () => {
      document.body.classList.remove('select-none', 'cursor-row-resize');
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  useEffect(() => {
    setSelectedCell(null);
  }, [error, result]);

  const runQuery = useCallback(async (queryToRun: string, policy?: QueryExecutionPolicy) => {
    const store = useAppStore.getState();
    if (!activeConnectionConnId || !queryToRun) return;

    setRunning(true);
    setPendingConfirmation(null);
    store.updateTab(tabId, { error: '', result: null });
    const start = performance.now();
    const startedAt = Date.now();

    try {
      const nextResult = await executeQuery(queryToRun, activeConnectionConnId, 'query-editor');
      setDuration(nextResult.durationMs ?? performance.now() - start);

      const truncated = nextResult.rows.length > MAX_RESULT_ROWS;
      const resultToStore = truncated
        ? { ...nextResult, rows: nextResult.rows.slice(0, MAX_RESULT_ROWS) }
        : nextResult;

      store.updateTab(tabId, { result: resultToStore, error: '' });

      if ((policy?.shouldRefreshSchema ?? false) && activeConnectionId) {
        const tablesList = await listTables(activeConnectionConnId);
        store.setTables(activeConnectionId, tablesList);
      }
    } catch (errorValue: any) {
      // Prefer backend-reported duration for consistency with Log Drawer.
      const loggedDuration = await getLoggedDuration(queryToRun, 'error', startedAt);
      setDuration(loggedDuration ?? performance.now() - start);
      store.updateTab(tabId, { error: errorValue.toString(), result: null });
    } finally {
      setRunning(false);
    }
  }, [activeConnectionConnId, activeConnectionId, getLoggedDuration, tabId]);

  const handleRun = useCallback(async (editorView?: EditorViewLike) => {
    const queryToRun = getQueryToRun(editorView);
    if (!queryToRun) return;

    const policy = analyzeQueryExecutionPolicy(queryToRun, {
      connectionTag: activeConnection?.tag,
      surface: 'query-editor',
    });

    if (policy.blockedStatements.length > 0) {
      useAppStore.getState().updateTab(tabId, {
        error: getBlockedQueryEditorMessage(policy.blockedStatements),
        result: null,
      });
      return;
    }

    if (policy.requiresConfirmation) {
      setPendingConfirmation({ query: queryToRun, policy });
      return;
    }

    await runQuery(queryToRun, policy);
  }, [activeConnection?.tag, getQueryToRun, runQuery, tabId]);

  const handleRunRef = useRef(handleRun);
  handleRunRef.current = handleRun;
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const handleSaveAsRef = useRef(handleSaveAs);
  handleSaveAsRef.current = handleSaveAs;

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
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              handleSaveRef.current();
              return true;
            },
          },
          {
            key: 'Mod-Shift-s',
            preventDefault: true,
            run: () => {
              handleSaveAsRef.current();
              return true;
            },
          },
        ])
      ),
    []
  );

  const editorExtensions = useMemo(
    () => (wrapEditor ? [sql({ schema }), EditorView.lineWrapping, runKeymap] : [sql({ schema }), runKeymap]),
    [schema, runKeymap, wrapEditor],
  );
  const editorTheme = useMemo(() => getCodeMirrorTheme(theme), [theme]);

  const canRun = Boolean(activeConnectionConnId) && !running;
  const confirmationStatements = pendingConfirmation?.policy.confirmStatements.join(', ') ?? '';

  return (
    <div ref={rootRef} className="flex flex-col h-full w-full bg-background relative z-0">
      <QueryEditorPane
        editorPaneRef={editorPaneRef}
        editorRef={editorRef}
        editorHeight={editorHeight}
        isResizing={isResizing}
        canRun={canRun}
        canSave={canSave}
        running={running}
        saveButtonLabel={saveButtonLabel}
        query={query}
        editorExtensions={editorExtensions}
        editorTheme={editorTheme}
        wrapEditor={wrapEditor}
        isProductionConnection={isProductionConnection}
        basicSetup={BASIC_SETUP}
        onRun={() => void handleRun()}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onToggleWrapEditor={() => setWrapEditor((current) => !current)}
        onQueryChange={setQuery}
        onPointerDownResizer={startResizing}
      />

      <div className="h-[1px] bg-border w-full flex-shrink-0" />

      <QueryResultsPane
        result={result}
        error={error}
        duration={duration}
        selectedCell={selectedCell}
        wrapCells={wrapCells}
        onSelectCell={handleSelectCell}
        onToggleWrapCells={() => setWrapCells((current) => !current)}
      />

      <SavedQueryDialog
        open={saveDialogState.open}
        mode={saveDialogState.mode}
        initialName={saveDialogState.initialName}
        connection={activeConnection ?? null}
        onOpenChange={(open) => setSaveDialogState((current) => ({ ...current, open }))}
        onSubmit={handleSubmitSaveDialog}
      />

      <Dialog
        open={pendingConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) setPendingConfirmation(null);
        }}
      >
        <DialogContent className="max-w-md border-warning/30 bg-card shadow-2xl shadow-black/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <ShieldAlert className="h-5 w-5" />
              Confirm Production Query
            </DialogTitle>
            <DialogDescription>
              This connection is tagged as <strong>PRODUCTION</strong>. The query editor requires
              confirmation before running write or schema statements.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-sm border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning/90">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                About to run: <strong>{confirmationStatements}</strong>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingConfirmation(null)} disabled={running}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!pendingConfirmation) return;
                void runQuery(pendingConfirmation.query, pendingConfirmation.policy);
              }}
              disabled={running}
              className="bg-warning text-black hover:bg-warning/90"
            >
              Run Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default QueryEditor;
