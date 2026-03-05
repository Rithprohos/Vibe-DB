import { useAppStore } from '../store/useAppStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, Trash2, Copy, AlertCircle, CheckCircle2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo, memo, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDevRenderCounter } from '@/lib/dev-performance';

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
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border bg-secondary/50 text-xs overflow-hidden group transition-colors hover:bg-secondary/80",
        log.status === 'error' ? "border-destructive/30" : "border-border/50"
      )}
    >
      <div className={cn(
        "flex items-center justify-center w-6 h-6 flex-shrink-0",
        log.status === 'error' ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
      )}>
        {log.status === 'error' ? (
          <AlertCircle size={12} />
        ) : (
          <CheckCircle2 size={12} />
        )}
      </div>
      <div className="flex-1 min-w-0 py-1.5 pr-2">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-[10px] text-muted-foreground">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/70">
            {log.duration.toFixed(1)}ms
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

  const reversedLogs = useMemo(() => {
    return [...logs].reverse();
  }, [logs]);

  const handleCopy = useCallback((sql: string) => {
    navigator.clipboard.writeText(sql);
  }, []);

  const toggleDrawer = useCallback(() => {
    setShowLogDrawer(!showLogDrawer);
  }, [setShowLogDrawer, showLogDrawer]);

  const logVirtualizer = useVirtualizer({
    count: reversedLogs.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  useEffect(() => {
    return () => {
      isDraggingRef.current = false;
    };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    const startY = e.clientY;
    const startHeight = heightRef.current;

    const handleMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !drawerRef.current) return;
      const newHeight = Math.max(100, Math.min(500, startHeight - (e.clientY - startY)));
      heightRef.current = newHeight;
      drawerRef.current.style.transition = 'none';
      drawerRef.current.style.maxHeight = `${newHeight}px`;
      drawerRef.current.style.height = `${newHeight}px`;
    };

    const handleUp = () => {
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

      <ScrollArea className="flex-1 bg-background" viewportRef={viewportRef}>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
            <Database size={24} className="opacity-40 mb-2" />
            <span className="text-sm font-medium">No logs yet</span>
            <span className="text-xs text-muted-foreground/70 mt-1">Execute a query to see logs</span>
          </div>
        ) : (
          <div className="p-2" style={{ height: `${logVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {logVirtualizer.getVirtualItems().map((virtualItem) => {
              const log = reversedLogs[virtualItem.index];
              return (
                <div
                  key={log.id}
                  data-index={virtualItem.index}
                  ref={logVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    paddingBottom: '6px',
                  }}
                >
                  <LogItem log={log} onCopy={handleCopy} />
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
