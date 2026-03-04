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
  removeConnection: (s: ReturnType<typeof useAppStore.getState>) => s.removeConnection,
  disconnectConnection: (s: ReturnType<typeof useAppStore.getState>) => s.disconnectConnection,
  closeAllConnections: (s: ReturnType<typeof useAppStore.getState>) => s.closeAllConnections,
  closeOtherConnections: (s: ReturnType<typeof useAppStore.getState>) => s.closeOtherConnections,
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
    <div className="w-[52px] bg-background border-r border-border/50 flex flex-col items-center py-4 gap-3 shrink-0 select-none overflow-y-auto hidden-scrollbar z-10">
      <TooltipProvider delayDuration={300}>
        {activeConnections.map((conn) => (
          <ContextMenu key={conn.id}>
            <Tooltip>
              <ContextMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleConnectionClick(conn)}
                    className={cn(
                      "relative w-11 h-11 rounded-xl flex items-center justify-center transition-all group",
                      activeSidebarConnectionId === conn.id 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    {activeSidebarConnectionId === conn.id && (
                      <div className="absolute -left-1 w-1 h-6 bg-primary rounded-r-md shadow-[0_0_10px_rgba(0,229,153,0.5)]" />
                    )}
                    
                    <Database size={22} className={cn("transition-transform", activeSidebarConnectionId === conn.id ? "scale-100" : "group-hover:scale-110")} />
                  </button>
                </TooltipTrigger>
              </ContextMenuTrigger>
              <TooltipContent side="right" className="bg-[#2a2a2a] text-white border-[#333] ml-1 px-3 py-1.5 shadow-xl">
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
        
        {activeConnections.length > 0 && <div className="w-6 h-px bg-[#333] my-1" />}
        
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleShowConnectionDialog}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all group mt-1"
            >
              <Plus size={24} className="group-hover:scale-110 transition-transform" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-[#2a2a2a] text-white border-[#333] ml-1">
            <p>New Connection</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
