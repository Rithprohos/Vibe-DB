import { useCallback, useMemo } from 'react';
import { Database, Plus, X, XCircle, XCircleIcon, Cloud, Server } from 'lucide-react';
import { useAppStore, type Connection } from '../store/useAppStore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getConnectionDatabaseName } from '@/lib/connectionDisplay';
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

function getConnectionTypeIcon(type: Connection['type'], className: string) {
  if (type === 'turso') {
    return <Cloud size={18} className={className} />;
  }

  if (type === 'postgres') {
    return <Server size={18} className={className} />;
  }

  return <Database size={18} className={className} />;
}

function getConnectionTagLabel(tag: NonNullable<Connection['tag']>) {
  if (tag === 'production') return 'PROD';
  if (tag === 'development') return 'DEV';
  if (tag === 'testing') return 'TEST';
  return 'LOCAL';
}

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
    <div
      className="relative z-10 hidden-scrollbar flex w-[76px] shrink-0 select-none flex-col items-center gap-1.5 overflow-y-auto border-r border-border/35 bg-background px-1.5 py-2"
      style={{
        backgroundImage:
          'radial-gradient(circle at top, rgba(var(--glow-color), 0.08), transparent 30%), linear-gradient(180deg, rgba(var(--glow-color), 0.025), transparent 22%)',
      }}
    >
      <div className="w-full px-1 pb-0.5">
        <div className="rounded-sm border border-border/35 bg-background/70 px-1.5 py-1 text-center text-[8px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75 shadow-sm shadow-black/10">
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
                      'group relative w-full overflow-hidden rounded-md border px-1.5 py-2 text-left transition-all duration-200',
                      activeSidebarConnectionId === conn.id
                        ? 'border-primary/25 bg-background/85 text-foreground shadow-[0_0_0_1px_rgba(var(--glow-color),0.08),0_14px_24px_rgba(0,0,0,0.22)]'
                        : 'border-border/30 bg-background/60 text-muted-foreground hover:border-primary/18 hover:bg-background/78 hover:text-foreground',
                    )}
                  >
                    <div
                      className={cn(
                        'absolute inset-0 opacity-0 transition-opacity duration-200',
                        activeSidebarConnectionId === conn.id
                          ? 'bg-[radial-gradient(circle_at_top,rgba(var(--glow-color),0.16),transparent_55%)] opacity-100'
                          : 'bg-[radial-gradient(circle_at_top,rgba(var(--glow-color),0.12),transparent_58%)] group-hover:opacity-100',
                      )}
                    />
                    {activeSidebarConnectionId === conn.id && (
                      <>
                        <div className="absolute inset-y-2 left-0 w-0.5 bg-primary" />
                        <div className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
                      </>
                    )}

                    <div className="relative flex flex-col items-center gap-1.5">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-md border transition-all duration-200',
                          activeSidebarConnectionId === conn.id
                            ? 'border-primary/22 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'
                            : 'border-border/30 bg-background/88 text-muted-foreground shadow-sm shadow-black/10 group-hover:border-primary/18 group-hover:text-primary',
                        )}
                      >
                        {getConnectionTypeIcon(
                          conn.type,
                          cn(
                            'transition-transform duration-200',
                            activeSidebarConnectionId === conn.id ? 'scale-100' : 'group-hover:scale-110',
                          ),
                        )}
                      </div>

                      <div className="w-full space-y-1 pt-0.5 text-center">
                        <p className="truncate px-0.5 text-[10px] font-medium leading-none text-foreground/90">
                          {conn.name}
                        </p>
                        {conn.tag && (
                          <span
                            className={cn(
                              'inline-flex max-w-full items-center rounded-sm border px-1 py-0.5 text-[7px] font-semibold uppercase tracking-[0.14em]',
                              TAG_STYLES[conn.tag],
                            )}
                          >
                            {getConnectionTagLabel(conn.tag)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>
              </ContextMenuTrigger>
              <TooltipContent side="right" className="ml-1 border-border/60 bg-popover px-3 py-1.5 text-popover-foreground shadow-xl">
                <p className="font-medium text-sm">{conn.name}</p>
                {getConnectionDatabaseName(conn) && (
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary/80">
                    {getConnectionDatabaseName(conn)}
                  </p>
                )}
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

        {activeConnections.length > 0 && (
          <div className="my-1 flex w-full justify-center px-1">
            <div className="h-px w-10 bg-gradient-to-r from-transparent via-border/50 to-transparent" />
          </div>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleShowConnectionDialog}
              className="group mt-0.5 w-full rounded-md border border-dashed border-border/35 bg-background/55 px-1.5 py-2 text-muted-foreground transition-all duration-200 hover:border-primary/22 hover:bg-background/78 hover:text-foreground"
            >
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border/30 bg-background/88 shadow-sm shadow-black/10 transition-colors group-hover:border-primary/18 group-hover:text-primary">
                  <Plus size={18} className="group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-[9px] font-medium uppercase tracking-[0.16em]">New</span>
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-1 border-border/60 bg-popover text-popover-foreground">
            <p>New Connection</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
