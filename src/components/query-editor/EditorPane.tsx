import { memo, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Extension } from '@codemirror/state';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { Loader2, Play, WrapText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QueryEditorPaneProps {
  editorPaneRef: RefObject<HTMLDivElement | null>;
  editorRef: RefObject<any>;
  editorHeight: number;
  isResizing: boolean;
  canRun: boolean;
  running: boolean;
  query: string;
  editorExtensions: Extension[];
  wrapEditor: boolean;
  basicSetup: Record<string, boolean>;
  onRun: () => void;
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
  running,
  query,
  editorExtensions,
  wrapEditor,
  basicSetup,
  onRun,
  onToggleWrapEditor,
  onQueryChange,
  onPointerDownResizer,
}: QueryEditorPaneProps) {
  return (
    <div
      ref={editorPaneRef}
      className="flex flex-col flex-shrink-0 relative group min-h-0 overflow-hidden"
      style={{ height: editorHeight, minHeight: 100 }}
    >
      <div className="relative z-10 flex items-center justify-between px-4 h-12 border-b border-border bg-secondary/30 backdrop-blur-sm">
        <Button
          size="sm"
          onClick={onRun}
          disabled={!canRun}
          className="h-8 shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          {running ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Play size={14} className="mr-2" />}
          {running ? 'Running...' : 'Run Query'}
        </Button>
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
          extensions={editorExtensions}
          theme={vscodeDark}
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
