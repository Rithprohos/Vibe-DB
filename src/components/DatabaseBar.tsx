import { useCallback, useMemo } from 'react';
import { Database, Plus, X, XCircle, XCircleIcon } from 'lucide-react';
import { useAppStore, type Connection } from '../store/useAppStore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';

const selectors = {
  connections: (s: ReturnType<typeof useAppStore.getState>) => s.connections,
  activeSidebarConnectionId: (s: ReturnType<typeof useAppStore.getState>) => s.activeSidebarConnectionId,
  setActiveSidebarConnection: (s: ReturnType<typeof useAppStore.getState>) => s.setActiveSidebarConnection,
  setShowConnectionDialog: (s: ReturnType<typeof useAppStore.getState>) => s.setShowConnectionDialog,
  disconnectConnection: (s: ReturnType<typeof useAppStore.getState>) => s.disconnectConnection,
  closeAllConnections: (s: ReturnType<typeof useAppStore.getState>) => s.closeAllConnections,
  closeOtherConnections: (s: ReturnType<typeof useAppStore.getState>) => s.closeOtherConnections,
};

const TAG_STYLES: Record<NonNullable<Connection['tag']>, string> = {
  local: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-300',
  testing: 'border-amber-500/30 bg-amber-500/12 text-amber-300',
  development: 'border-sky-500/30 bg-sky-500/12 text-sky-300',
  production: 'border-rose-500/35 bg-rose-500/12 text-rose-300',
};

export default function DatabaseBar() {
  const connections = useAppStore(selectors.connections);
  const activeSidebarConnectionId = useAppStore(selectors.activeSidebarConnectionId);
  const setActiveSidebarConnection = useAppStore(selectors.setActiveSidebarConnection);
  const setShowConnectionDialog = useAppStore(selectors.setShowConnectionDialog);
  const disconnectConnection = useAppStore(selectors.disconnectConnection);
  const closeAllConnections = useAppStore(selectors.closeAllConnections);
  const closeOtherConnections = useAppStore(selectors.closeOtherConnections);

  const activeConnections = useMemo(
    () => connections.filter(c => c.connId),
    [connections]
  );

  const handleConnectionClick = useCallback((conn: Connection) => {
    setActiveSidebarConnection(conn.id);
  }, [setActiveSidebarConnection]);

  const handleDisconnect = useCallback((id: string) => () => disconnectConnection(id), [disconnectConnection]);
  const handleCloseOtherConnections = useCallback((id: string) => () => closeOtherConnections(id), [closeOtherConnections]);
  const handleShowConnectionDialog = useCallback(() => setShowConnectionDialog(true), [setShowConnectionDialog]);

  if (activeConnections.length === 0) return null;

  return (
    <div className="w-[72px] bg-background border-r border-border/50 flex flex-col items-center py-2 px-1.5 gap-1.5 shrink-0 select-none overflow-y-auto hidden-scrollbar z-10">
      <div className="w-full px-1 pb-0.5">
        <div className="rounded-sm border border-border/60 bg-secondary/20 px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80 text-center">
          DBs
        </div>
      </div>
      <TooltipProvider delayDuration={300}>
        {activeConnections.map((conn) => (
          <ContextMenu key={conn.id}>
            <Tooltip>
              <ContextMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleConnectionClick(conn)}
                    className={cn(
                      "relative w-full rounded-md border px-1.5 py-1.5 text-left transition-all group overflow-hidden",
                      activeSidebarConnectionId === conn.id 
                        ? "border-primary/35 bg-primary/10 text-foreground shadow-[0_0_20px_hsl(var(--primary)/0.10)]"
                        : "border-border/50 bg-secondary/10 text-muted-foreground hover:border-primary/20 hover:bg-secondary/50 hover:text-foreground"
                    )}
                  >
                    {activeSidebarConnectionId === conn.id && (
                      <div className="absolute inset-y-2 left-0 w-0.5 bg-primary" />
                    )}

                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md border transition-all",
                          activeSidebarConnectionId === conn.id
                            ? "border-primary/30 bg-primary/15 text-primary"
                            : "border-border/60 bg-background/80 text-muted-foreground group-hover:border-primary/25 group-hover:text-primary"
                        )}
                      >
                        <div className="flex items-center justify-center">
                          <Database
                            size={18}
                            className={cn(
                              "transition-transform",
                              activeSidebarConnectionId === conn.id ? "scale-100" : "group-hover:scale-110"
                            )}
                          />
                        </div>
                      </div>

                      <div className="w-full space-y-0.5 pt-0.5 text-center">
                        <p className="truncate text-[10px] font-medium leading-none text-foreground/90">
                          {conn.name}
                        </p>
                        {conn.tag && (
                          <span
                            className={cn(
                              'inline-flex max-w-full items-center rounded-sm border px-1 py-0.5 text-[7px] font-semibold uppercase tracking-[0.12em]',
                              TAG_STYLES[conn.tag]
                            )}
                          >
                            {conn.tag}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>
              </ContextMenuTrigger>
              <TooltipContent side="right" className="bg-popover text-popover-foreground border-border ml-1 px-3 py-1.5 shadow-xl">
                <p className="font-medium text-sm">{conn.name}</p>
                {conn.tag && <p className="text-[10px] uppercase opacity-70 mt-0.5">{conn.tag}</p>}
              </TooltipContent>
            </Tooltip>
            <ContextMenuContent className="w-48">
              <ContextMenuItem onClick={handleDisconnect(conn.id)} className="text-sm">
                <X className="w-4 h-4 mr-2" />
                Close
              </ContextMenuItem>
              <ContextMenuItem onClick={handleCloseOtherConnections(conn.id)} className="text-sm">
                <XCircle className="w-4 h-4 mr-2" />
                Close Others
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={closeAllConnections} className="text-sm">
                <XCircleIcon className="w-4 h-4 mr-2" />
                Close All
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
        
        {activeConnections.length > 0 && <div className="w-10 h-px bg-border/70 my-0.5" />}
        
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleShowConnectionDialog}
              className="w-full rounded-md border border-dashed border-border/60 bg-secondary/10 px-1.5 py-2 text-muted-foreground hover:border-primary/30 hover:bg-secondary/40 hover:text-foreground transition-all group mt-0.5"
            >
              <div className="flex flex-col items-center gap-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/80 group-hover:border-primary/25 group-hover:text-primary">
                  <Plus size={18} className="group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-[9px] font-medium uppercase tracking-[0.12em]">New</span>
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-popover text-popover-foreground border-border ml-1">
            <p>New Connection</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
