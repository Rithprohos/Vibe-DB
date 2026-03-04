import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Database, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function StatusBar() {
  const connections = useAppStore(s => s.connections);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const tablesByConnection = useAppStore(s => s.tablesByConnection);
  const showLogDrawer = useAppStore(s => s.showLogDrawer);
  const setShowLogDrawer = useAppStore(s => s.setShowLogDrawer);
  const logCount = useAppStore(s => s.logs.length);

  const activeConnection = useMemo(
    () => connections.find(c => c.id === activeSidebarConnectionId),
    [connections, activeSidebarConnectionId]
  );
  const tableCount = useMemo(
    () => activeConnection ? (tablesByConnection[activeConnection.id] || []).length : 0,
    [activeConnection, tablesByConnection]
  );
  const toggleLogDrawer = useCallback(
    () => setShowLogDrawer(!showLogDrawer),
    [setShowLogDrawer, showLogDrawer]
  );

  return (
    <footer className="h-[var(--statusbar-height)] flex items-center px-4 bg-secondary border-t border-border text-[11px] text-muted-foreground select-none flex-shrink-0 relative z-20">
      <div className="flex items-center space-x-2 mr-6">
        <span className={cn(
          "w-2 h-2 rounded-full",
          activeConnection ? "bg-primary shadow-[0_0_6px_rgba(0,229,153,0.4)]" : "bg-muted-foreground"
        )} />
        <span className="font-medium tracking-wide uppercase">{activeConnection ? 'Connected' : 'Disconnected'}</span>
      </div>
      
      {activeConnection && (
        <>
          <div className="flex items-center gap-2 mr-6 border-l border-border pl-6">
            <Database size={12} className="text-primary/70" />
            <span className="font-medium text-foreground">{activeConnection.name}</span>

            {activeConnection.tag && (
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border leading-none flex items-center h-[18px]",
                activeConnection.tag === 'production' 
                  ? "bg-red-500/20 text-red-400 border-red-500/40" 
                  : "bg-primary/20 text-primary border-primary/40"
              )}>
                {activeConnection.tag}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5 border-l border-border pl-6">
            <span className="font-mono">{tableCount}</span>
            <span>tables</span>
          </div>
        </>
      )}

      <div className="flex-1" />
      
      <button 
        className={cn(
          "flex items-center gap-1.5 px-3 h-full hover:bg-accent hover:text-foreground transition-all cursor-pointer outline-none",
          showLogDrawer && "bg-accent/50 text-foreground"
        )}
        onClick={toggleLogDrawer}
      >
        <FileText size={12} className={showLogDrawer ? "text-primary" : ""} />
        <span className="font-medium tracking-wide uppercase">Logs</span>
        {logCount > 0 && (
          <span className={cn(
            "text-[10px] px-1.5 rounded-full",
            showLogDrawer ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
          )}>
            {logCount}
          </span>
        )}
        {showLogDrawer ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
    </footer>
  );
}