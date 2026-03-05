import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Database, FileText, ChevronUp, ChevronDown, Download, RefreshCw, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdater } from '@/hooks/useUpdater';
import { listen } from '@tauri-apps/api/event';

export default function StatusBar() {
  const connections = useAppStore(s => s.connections);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const tablesByConnection = useAppStore(s => s.tablesByConnection);
  const showLogDrawer = useAppStore(s => s.showLogDrawer);
  const setShowLogDrawer = useAppStore(s => s.setShowLogDrawer);
  const logCount = useAppStore(s => s.logs.length);
  const {
    checking,
    downloading,
    downloaded,
    updateInfo,
    progress,
    checkForUpdates,
    downloadAndInstall
  } = useUpdater();
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

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

  useEffect(() => {
    if (updateInfo?.available) {
      setShowUpdateBanner(true);
    }
  }, [updateInfo]);

  const checkForUpdatesRef = useRef(checkForUpdates);
  checkForUpdatesRef.current = checkForUpdates;

  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | null = null;

    listen('vibedb:check-updates', () => {
      checkForUpdatesRef.current();
    }).then((fn) => {
      if (mounted) {
        unsub = fn;
      } else {
        fn();
      }
    });

    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  return (
    <>
      {showUpdateBanner && updateInfo?.available && (
        <div className="h-[var(--statusbar-height)] flex items-center px-4 bg-primary/10 border-b border-primary/30 text-[11px] text-primary">
          <Sparkles size={12} className="mr-2" />
          <span className="font-medium">Update available: v{updateInfo.version}</span>
          <button
            className="ml-3 px-2 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 transition-colors flex items-center gap-1"
            onClick={downloadAndInstall}
            disabled={downloading}
          >
            {downloading ? (
              <>
                <RefreshCw size={10} className="animate-spin" />
                <span>{progress}%</span>
              </>
            ) : (
              <>
                <Download size={10} />
                <span>Install</span>
              </>
            )}
          </button>
          <button
            className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowUpdateBanner(false)}
          >
            ✕
          </button>
        </div>
      )}
      <footer className="h-[var(--statusbar-height)] flex items-center px-4 bg-secondary border-t border-border text-[11px] text-muted-foreground select-none flex-shrink-0 relative z-20">
      <div className="flex items-center space-x-2 mr-6">
        <span className={cn(
          "w-2 h-2 rounded-full",
          activeConnection ? "bg-primary glow-shadow" : "bg-muted-foreground"
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
        className="flex items-center gap-1.5 px-2 h-full hover:bg-accent hover:text-foreground transition-all cursor-pointer outline-none"
        onClick={checkForUpdates}
        disabled={checking}
      >
        {updateInfo?.available ? (
          <Download size={12} className="text-primary" />
        ) : downloaded ? (
          <Check size={12} className="text-primary" />
        ) : (
          <RefreshCw size={12} className={cn(checking && "animate-spin")} />
        )}
      </button>
      
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
    </>
  );
}