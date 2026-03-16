import { useAppStore } from '../store/useAppStore';
import { Button } from '@/components/ui/button';
import { ChevronDown, Trash2, Copy, AlertCircle, CheckCircle2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, memo, useRef, useCallback, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDevRenderCounter } from '@/lib/dev-performance';
import { copyToClipboard } from '@/lib/copy';

const selectors = {
  logs: (s: ReturnType<typeof useAppStore.getState>) => s.logs,
  showLogDrawer: (s: ReturnType<typeof useAppStore.getState>) => s.showLogDrawer,
  setShowLogDrawer: (s: ReturnType<typeof useAppStore.getState>) => s.setShowLogDrawer,
  clearLogs: (s: ReturnType<typeof useAppStore.getState>) => s.clearLogs,
};

interface LogItemProps {
  log: ReturnType<typeof useAppStore.getState>['logs'][0];
  onCopy: (sql: string) => void;
}

const LogItem = memo(function LogItem({ log, onCopy }: LogItemProps) {
  const timeString = useMemo(() => new Date(log.timestamp).toLocaleTimeString(), [log.timestamp]);
  const durationString = useMemo(() => `${Math.round(log.duration)}ms`, [log.duration]);
  const isError = log.status === 'error';
  const containerClass = useMemo(() => cn(
    "flex items-start gap-2 rounded-md border bg-secondary/50 text-xs overflow-hidden group transition-colors hover:bg-secondary/80",
    isError ? "border-destructive/30" : "border-border/50"
  ), [isError]);
  const iconClass = useMemo(() => cn(
    "flex items-center justify-center w-6 h-6 flex-shrink-0",
    isError ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
  ), [isError]);

  return (
    <div className={containerClass}>
      <div className={iconClass}>
        {isError ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
      </div>
      <div className="flex-1 min-w-0 py-1.5 pr-2">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-[10px] text-muted-foreground">
            {timeString}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/70">
            {durationString}
          </span>
        </div>
        <pre className="font-mono text-foreground/90 whitespace-pre-wrap break-all leading-relaxed">
          {log.sql}
        </pre>
        {log.status === 'error' && (
          <div className="mt-1 text-destructive text-[10px] font-medium">
            {log.message}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity mr-1 mt-1"
        onClick={() => onCopy(log.sql)}
        title="Copy SQL"
      >
        <Copy size={10} />
      </Button>
    </div>
  );
});

interface VirtualRowProps {
  index: number;
  start: number;
  log: ReturnType<typeof useAppStore.getState>['logs'][0];
  onCopy: (sql: string) => void;
  measureRef: (el: HTMLElement | null) => void;
}

const VirtualRow = memo(function VirtualRow({ index, start, log, onCopy, measureRef }: VirtualRowProps) {
  const style = useMemo(() => ({ top: start, paddingBottom: '6px' }), [start]);

  return (
    <div
      data-index={index}
      ref={measureRef}
      className="absolute left-0 w-full"
      style={style}
    >
      <LogItem log={log} onCopy={onCopy} />
    </div>
  );
});

export default function LogDrawer() {
  useDevRenderCounter('LogDrawer');
  const logs = useAppStore(selectors.logs);
  const showLogDrawer = useAppStore(selectors.showLogDrawer);
  const setShowLogDrawer = useAppStore(selectors.setShowLogDrawer);
  const clearLogs = useAppStore(selectors.clearLogs);
  const [height, setHeight] = useState(200);
  const drawerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(200);
  const isDraggingRef = useRef(false);

  const handleCopy = useCallback((sql: string) => {
    void copyToClipboard(sql, { successMessage: 'Copied SQL' });
  }, []);

  const toggleDrawer = useCallback(() => {
    setShowLogDrawer((prev) => !prev);
  }, [setShowLogDrawer]);

  const getScrollElement = useCallback(() => viewportRef.current, []);
  const estimateSize = useCallback(() => 80, []);
  const getItemKey = useCallback((index: number) => logs[index]?.id ?? index, [logs]);

  const logVirtualizer = useVirtualizer({
    count: showLogDrawer ? logs.length : 0,
    getScrollElement,
    estimateSize,
    overscan: 3,
    getItemKey,
  });

  const measureElementRef = useRef(logVirtualizer.measureElement);
  useEffect(() => {
    measureElementRef.current = logVirtualizer.measureElement;
  }, [logVirtualizer.measureElement]);

  const measureElement = useCallback((el: HTMLElement | null) => {
    if (el) measureElementRef.current(el);
  }, []);

  useEffect(() => {
    return () => {
      isDraggingRef.current = false;
    };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    const startY = e.clientY;
    const startHeight = heightRef.current;
    let rafId: number | null = null;
    let pendingHeight = startHeight;

    const handleMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !drawerRef.current) return;
      pendingHeight = Math.max(100, Math.min(500, startHeight - (e.clientY - startY)));
      if (rafId !== null) return;

      rafId = window.requestAnimationFrame(() => {
        heightRef.current = pendingHeight;
        if (drawerRef.current) {
          drawerRef.current.style.transition = 'none';
          drawerRef.current.style.maxHeight = `${pendingHeight}px`;
          drawerRef.current.style.height = `${pendingHeight}px`;
        }
        rafId = null;
      });
    };

    const handleUp = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (isDraggingRef.current && drawerRef.current) {
        drawerRef.current.style.transition = '';
        setHeight(heightRef.current);
        isDraggingRef.current = false;
      }
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, []);

  return (
    <div
      ref={drawerRef}
      className={cn(
        "absolute bottom-[var(--statusbar-height)] left-0 right-0 bg-background border-t border-border flex flex-col z-40 transition-[max-height,opacity] duration-200 ease-out overflow-hidden",
        showLogDrawer ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      style={{ maxHeight: showLogDrawer ? height : 0, height: showLogDrawer ? height : undefined }}
    >
      <div
        className="h-1 bg-border hover:bg-primary/50 cursor-ns-resize transition-colors flex-shrink-0"
        onMouseDown={handleDragStart}
      />
      
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm tracking-wide">Logs</span>
          {logs.length > 0 && (
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {logs.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearLogs} className="h-7 text-xs px-2 hover:bg-destructive/10 hover:text-destructive transition-colors">
            <Trash2 size={12} className="mr-1.5" />
            Clear
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleDrawer} className="h-7 w-7 rounded-full">
            <ChevronDown size={14} />
          </Button>
        </div>
      </div>

      <div ref={viewportRef} className="flex-1 bg-background overflow-auto">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
            <Database size={24} className="opacity-40 mb-2" />
            <span className="text-sm font-medium">No logs yet</span>
            <span className="text-xs text-muted-foreground/70 mt-1">Execute a query to see logs</span>
          </div>
        ) : (
          <div className="p-2" style={{ height: `${logVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {showLogDrawer && logVirtualizer.getVirtualItems().map((vi) => (
              <VirtualRow
                key={vi.key}
                index={vi.index}
                start={vi.start}
                log={logs[vi.index]}
                onCopy={handleCopy}
                measureRef={measureElement}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
