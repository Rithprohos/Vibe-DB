import { memo, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Extension } from '@codemirror/state';
import CodeMirror from '@uiw/react-codemirror';
import { Copy, Loader2, Play, Save, ShieldAlert, WrapText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QueryEditorPaneProps {
  editorPaneRef: RefObject<HTMLDivElement | null>;
  editorRef: RefObject<any>;
  editorHeight: number;
  isResizing: boolean;
  canRun: boolean;
  canSave: boolean;
  running: boolean;
  saveButtonLabel: string;
  query: string;
  editorExtensions: Extension[];
  editorTheme: Extension;
  wrapEditor: boolean;
  isProductionConnection: boolean;
  basicSetup: Record<string, boolean>;
  onRun: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onToggleWrapEditor: () => void;
  onQueryChange: (value: string) => void;
  onPointerDownResizer: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

export const QueryEditorPane = memo(function QueryEditorPane({
  editorPaneRef,
  editorRef,
  editorHeight,
  isResizing,
  canRun,
  canSave,
  running,
  saveButtonLabel,
  query,
  editorExtensions,
  editorTheme,
  wrapEditor,
  isProductionConnection,
  basicSetup,
  onRun,
  onSave,
  onSaveAs,
  onToggleWrapEditor,
  onQueryChange,
  onPointerDownResizer,
}: QueryEditorPaneProps) {
  const shortcutBadgeClass =
    'text-[10px] font-mono font-semibold text-foreground/90 uppercase tracking-wider bg-secondary/80 px-2 py-1 border border-border/80 rounded shadow-sm';

  return (
    <div
      ref={editorPaneRef}
      className="flex flex-col flex-shrink-0 relative group min-h-0 overflow-hidden"
      style={{ height: editorHeight, minHeight: 100 }}
    >
      <div className="relative z-10 flex items-center justify-between px-4 h-12 border-b border-border bg-secondary/30 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onRun}
            disabled={!canRun}
            className="h-8 shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {running ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Play size={14} className="mr-2" />}
            {running ? 'Running...' : 'Run Query'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onSave}
            disabled={!canSave}
            className="h-8 border-border/60 bg-background/70"
          >
            <Save size={14} className="mr-2" />
            {saveButtonLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onSaveAs}
            disabled={!canSave}
            className="h-8 text-muted-foreground hover:text-foreground"
          >
            <Copy size={14} className="mr-2" />
            Save As
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleWrapEditor}
            className={cn(
              'h-7 gap-2 px-2 text-xs text-muted-foreground hover:text-foreground',
              wrapEditor && 'bg-secondary text-foreground'
            )}
          >
            <WrapText size={13} />
            {wrapEditor ? 'Wrapped' : 'No Wrap'}
          </Button>
          <span className={shortcutBadgeClass}>
            ⌘ + Enter
          </span>
          <span className={shortcutBadgeClass}>
            ⌘ + ⇧ + Enter
          </span>
          <span className={shortcutBadgeClass}>
            ⌘ + S
          </span>
        </div>
      </div>

      {isProductionConnection ? (
        <div className="relative z-10 border-b border-warning/20 bg-warning/8 px-4 py-2.5 text-warning">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.14em]">
            <ShieldAlert size={13} />
            Production Query Policy Active
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-warning/80">Disabled in Query Editor:</span>
            <span className="border border-warning/30 bg-warning/10 px-1.5 py-0.5 font-mono font-semibold">
              DROP
            </span>
            <span className="border border-warning/30 bg-warning/10 px-1.5 py-0.5 font-mono font-semibold">
              TRUNCATE
            </span>
            <span className="text-warning/70">
              Use guided actions for destructive changes with confirmation.
            </span>
          </div>
        </div>
      ) : null}

      <div className="relative z-0 min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          ref={editorRef}
          value={query}
          height="100%"
          extensions={editorExtensions}
          theme={editorTheme}
          onChange={onQueryChange}
          className="h-full w-full overflow-hidden bg-background text-[14px] custom-scrollbar-hide focus-within:ring-inset focus-within:ring-1 focus-within:ring-primary/20 cm-editor-wrapper"
          basicSetup={basicSetup}
        />
      </div>

      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 h-2 cursor-row-resize hover:bg-primary z-20 transition-colors opacity-0 group-hover:opacity-100 touch-none',
          isResizing && 'bg-primary opacity-100 shadow-glow'
        )}
        onPointerDown={onPointerDownResizer}
      />
    </div>
  );
});
