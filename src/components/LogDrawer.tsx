import { useAppStore } from '../store/useAppStore';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, Trash2, Copy, AlertCircle, CheckCircle2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export default function LogDrawer() {
  const { logs, showLogDrawer, setShowLogDrawer, clearLogs } = useAppStore();
  const [height, setHeight] = useState(200);

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
  };

  const toggleDrawer = () => {
    setShowLogDrawer(!showLogDrawer);
  };

  return (
    <div
      className={cn(
        "absolute bottom-[var(--statusbar-height)] left-0 right-0 bg-background border-t border-border flex flex-col z-40 transition-[max-height,opacity] duration-200 ease-out overflow-hidden",
        showLogDrawer ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      style={{ maxHeight: showLogDrawer ? height : 0, height: showLogDrawer ? height : undefined }}
    >
      <div
        className="h-1 bg-border hover:bg-primary/50 cursor-ns-resize transition-colors flex-shrink-0"
        onMouseDown={(e) => {
          const startY = e.clientY;
          const startHeight = height;
          const handleMove = (e: MouseEvent) => {
            const newHeight = startHeight - (e.clientY - startY);
            setHeight(Math.max(100, Math.min(500, newHeight)));
          };
          const handleUp = () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
          };
          document.addEventListener('mousemove', handleMove);
          document.addEventListener('mouseup', handleUp);
        }}
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

      <ScrollArea className="flex-1 bg-background">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
            <Database size={24} className="opacity-40 mb-2" />
            <span className="text-sm font-medium">No logs yet</span>
            <span className="text-xs text-muted-foreground/70 mt-1">Execute a query to see logs</span>
          </div>
        ) : (
          <div className="p-2 space-y-1.5">
            {[...logs].reverse().map((log) => (
              <div
                key={log.id}
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
                  onClick={() => handleCopy(log.sql)}
                  title="Copy SQL"
                >
                  <Copy size={10} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}