import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { listTables } from '../lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Database, LayoutTemplate, Eye, RefreshCw, Plus, ChevronRight, ChevronDown, Inbox, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import EditConnectionDialog from './EditConnectionDialog';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDevRenderCounter } from '@/lib/dev-performance';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

export default function Sidebar() {
  useDevRenderCounter('Sidebar');
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const connections = useAppStore(s => s.connections);
  const isConnected = useAppStore(s => s.isConnected);
  const tablesByConnection = useAppStore(s => s.tablesByConnection);
  const selectedTable = useAppStore(s => s.selectedTable);
  const setTables = useAppStore(s => s.setTables);
  const openTableTab = useAppStore(s => s.openTableTab);
  const addTab = useAppStore(s => s.addTab);

  const activeConnection = activeSidebarConnectionId 
    ? connections.find(c => c.id === activeSidebarConnectionId) 
    : undefined;
  const tables = activeSidebarConnectionId 
    ? (tablesByConnection[activeSidebarConnectionId] || []) 
    : [];

  const [search, setSearch] = useState('');
  const [tablesOpen, setTablesOpen] = useState(true);
  const [viewsOpen, setViewsOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const currentWidthRef = useRef(260);
  const rafIdRef = useRef<number | null>(null);
  const targetWidthRef = useRef(260);
  const tablesListRef = useRef<HTMLDivElement>(null);
  const viewsListRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback(() => {
    isResizingRef.current = true;
    setIsResizing(true);
    document.body.classList.add('select-none', 'cursor-col-resize');
  }, []);

  const stopResizing = useCallback(() => {
    isResizingRef.current = false;
    setIsResizing(false);
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    document.body.classList.remove('select-none', 'cursor-col-resize');
    setSidebarWidth(currentWidthRef.current);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return;
    
    targetWidthRef.current = Math.max(200, Math.min(600, e.clientX));
    
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        const newWidth = targetWidthRef.current;
        if (newWidth !== currentWidthRef.current && sidebarRef.current) {
          currentWidthRef.current = newWidth;
          sidebarRef.current.style.width = `${newWidth}px`;
          sidebarRef.current.style.minWidth = `${newWidth}px`;
        }
        rafIdRef.current = null;
      });
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => resize(e);
    const handleMouseUp = () => stopResizing();

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resize, stopResizing]);

  const normalizedSearch = useMemo(() => search.trim().toLowerCase(), [search]);

  const { filteredTables, filteredViews } = useMemo(() => {
    const nextTables: typeof tables = [];
    const nextViews: typeof tables = [];

    tables.forEach((table) => {
      if (normalizedSearch && !table.name.toLowerCase().includes(normalizedSearch)) {
        return;
      }

      if (table.table_type === 'view') {
        nextViews.push(table);
      } else if (table.table_type === 'table') {
        nextTables.push(table);
      }
    });

    return { filteredTables: nextTables, filteredViews: nextViews };
  }, [tables, normalizedSearch]);

  const tableVirtualizer = useVirtualizer({
    count: tablesOpen ? filteredTables.length : 0,
    getScrollElement: () => tablesListRef.current,
    estimateSize: () => 34,
    overscan: 12,
  });

  const viewVirtualizer = useVirtualizer({
    count: viewsOpen ? filteredViews.length : 0,
    getScrollElement: () => viewsListRef.current,
    estimateSize: () => 34,
    overscan: 12,
  });

  const handleRefresh = async () => {
    if (!activeConnection?.connId) return;
    try {
      const result = await listTables(activeConnection.connId);
      setTables(activeConnection.id, result);
    } catch (e) {
      console.error('Failed to refresh:', e);
    }
  };

  const handleNewQuery = () => {
    if (!activeConnection) return;
    const id = `query-${Date.now()}`;
    addTab({
      id,
      connectionId: activeConnection.id,
      type: 'query',
      title: 'New Query',
      query: '',
    });
  };

  const handleCreateTable = () => {
    if (!activeConnection) return;
    const id = `create-table-${Date.now()}`;
    addTab({
      id,
      connectionId: activeConnection.id,
      type: 'create-table',
      title: 'Create Table',
    });
  };

  const handleEditTable = useCallback((tableName: string) => {
    if (!activeConnection) return;
    openTableTab(activeConnection.id, tableName, 'edit-table');
  }, [activeConnection, openTableTab]);

  return (
    <div 
      className={cn(
        "relative flex flex-col bg-background border-r border-border/50 h-full flex-shrink-0 select-none",
        !isResizing && "transition-[width] duration-200 ease-out"
      )}
      ref={sidebarRef}
      style={{ 
        width: sidebarWidth, 
        minWidth: sidebarWidth,
      }}
    >
      <div className="p-3">
        {isConnected && activeConnection?.connId ? (
          <>
            <div 
              className="relative flex items-center space-x-3 p-3 rounded-md bg-background border border-border cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={() => setEditDialogOpen(true)}
            >
              <Database size={18} className="text-primary group-hover:neon-text transition-all flex-shrink-0" />
              <div className="flex-1 min-w-0 pr-12">
                <div className="text-sm font-medium text-foreground truncate leading-tight">
                  {activeConnection.name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex-shrink-0">SQLite</div>
                  {activeConnection.tag && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border flex-shrink-0 whitespace-nowrap",
                      activeConnection.tag === 'production' 
                        ? "bg-red-500/20 text-red-400 border-red-500/40" 
                        : "bg-primary/20 text-primary border-primary/40"
                    )}>
                      {activeConnection.tag}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons - Absolute positioned to not interfere with text layout */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                <button
                  className="p-1.5 rounded-md hover:bg-primary/10 hover:text-primary text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditDialogOpen(true);
                  }}
                  title="Edit Connection"
                >
                  <Pencil size={12} />
                </button>
              </div>
            </div>
            <EditConnectionDialog
              connection={activeConnection}
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
            />
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Connections</div>
              <button
                className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                onClick={() => useAppStore.getState().setShowConnectionDialog(true)}
              >
                + New
              </button>
            </div>
            {connections.length > 0 ? (
              <div className="space-y-1.5">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="relative flex items-center space-x-3 p-2.5 rounded-lg border border-border/50 cursor-pointer hover:bg-secondary/50 hover:border-primary/30 transition-all group"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('vibedb:connect', { detail: conn })
                      );
                    }}
                  >
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                      <Database size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate leading-tight">
                        {conn.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {conn.type === 'sqlite' ? 'SQLite' : conn.type}
                        </span>
                        {conn.tag && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border flex-shrink-0 whitespace-nowrap leading-none",
                            conn.tag === 'production'
                              ? "bg-red-500/20 text-red-400 border-red-500/40"
                              : conn.tag === 'development'
                                ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                : "bg-primary/20 text-primary border-primary/40"
                          )}>
                            {conn.tag}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Remove button on hover */}
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/0 group-hover:text-muted-foreground transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        useAppStore.getState().removeConnection(conn.id);
                      }}
                      title="Remove connection"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 px-2">
                <Database size={20} className="mx-auto text-muted-foreground/40 mb-2" />
                <div className="text-xs text-muted-foreground">No saved connections</div>
              </div>
            )}
          </div>
        )}
      </div>

      {isConnected && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex px-3 gap-2 pb-3 border-b border-border">
            <Button variant="outline" size="sm" className="flex-1 space-x-1 border-border/50 bg-background/50 hover:bg-accent/50" onClick={handleNewQuery}>
              <Plus size={14} />
              <span>Query</span>
            </Button>
            <Button variant="outline" size="sm" className="flex-1 space-x-1 border-border/50 bg-background/50 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/30" onClick={handleCreateTable}>
              <Plus size={14} />
              <span>Table</span>
            </Button>
            <Button variant="outline" size="sm" className="space-x-1 border-border/50 bg-background/50 hover:bg-accent/50 px-2" onClick={handleRefresh}>
              <RefreshCw size={14} />
            </Button>
          </div>

          <div className="p-3">
            <Input
              type="text"
              placeholder="Search tables..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background/50 border-border placeholder:text-muted-foreground/50 text-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-8"
            />
          </div>

          <ScrollArea className="flex-1 px-3">
            <div className="space-y-4 pb-4">
              {/* Tables */}
              <div className="space-y-1">
                <div
                  className="flex items-center space-x-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors group px-2 py-1"
                  onClick={() => setTablesOpen(!tablesOpen)}
                >
                  <span className="text-[10px] transform transition-transform text-muted-foreground group-hover:text-primary">
                    {tablesOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <span className="flex-1">Tables</span>
                  <span className="bg-background px-1.5 py-0.5 rounded text-[10px] font-mono border border-border">
                    {filteredTables.length}
                  </span>
                </div>
                
                {tablesOpen && (
                  <div ref={tablesListRef} className="max-h-80 overflow-auto pr-1">
                    <div style={{ height: `${tableVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                      {tableVirtualizer.getVirtualItems().map((virtualItem) => {
                        const t = filteredTables[virtualItem.index];
                        return (
                          <div
                            key={t.name}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${virtualItem.start}px)`,
                              paddingBottom: '2px',
                            }}
                          >
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  className={cn(
                                    "flex items-center space-x-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-all",
                                    selectedTable === t.name
                                      ? "bg-primary/10 text-primary border border-primary/20"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                  )}
                                  onClick={() => openTableTab(activeConnection!.id, t.name, 'data')}
                                  onDoubleClick={() => openTableTab(activeConnection!.id, t.name, 'structure')}
                                >
                                  <LayoutTemplate size={14} className={selectedTable === t.name ? "text-primary" : "text-muted-foreground"} />
                                  <span className="truncate">{t.name}</span>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-48">
                                <ContextMenuItem onClick={() => openTableTab(activeConnection!.id, t.name, 'data')}>
                                  Open Data
                                </ContextMenuItem>
                                <ContextMenuItem onClick={() => openTableTab(activeConnection!.id, t.name, 'structure')}>
                                  Open Structure
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem onClick={() => handleEditTable(t.name)}>
                                  Edit Table
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Views */}
              {filteredViews.length > 0 && (
                <div className="space-y-1">
                  <div
                    className="flex items-center space-x-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors group px-2 py-1"
                    onClick={() => setViewsOpen(!viewsOpen)}
                  >
                    <span className="text-[10px] transform transition-transform text-muted-foreground group-hover:text-primary">
                      {viewsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                    <span className="flex-1">Views</span>
                    <span className="bg-background px-1.5 py-0.5 rounded text-[10px] font-mono border border-border">
                      {filteredViews.length}
                    </span>
                  </div>
                  
                  {viewsOpen && (
                    <div ref={viewsListRef} className="max-h-64 overflow-auto pr-1">
                      <div style={{ height: `${viewVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                        {viewVirtualizer.getVirtualItems().map((virtualItem) => {
                          const t = filteredViews[virtualItem.index];
                          return (
                            <div
                              key={t.name}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualItem.start}px)`,
                                paddingBottom: '2px',
                              }}
                            >
                              <div
                                className={cn(
                                  "flex items-center space-x-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-all",
                                  selectedTable === t.name
                                    ? "bg-primary/10 text-primary border border-primary/20"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                )}
                                onClick={() => openTableTab(activeConnection!.id, t.name, 'data')}
                              >
                                <Eye size={14} className={selectedTable === t.name ? "text-primary" : "text-muted-foreground"} />
                                <span className="truncate">{t.name}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {filteredTables.length === 0 && filteredViews.length === 0 && !search && (
                <div className="text-center py-8 px-4 border border-dashed border-border rounded-lg bg-background/30 mt-4">
                  <Inbox size={24} className="mx-auto text-muted-foreground mb-2 opacity-50" />
                  <div className="text-sm font-medium text-foreground mb-1">No tables found</div>
                  <div className="text-xs text-muted-foreground max-w-[160px] mx-auto">
                    Create a table to get started with VibeDB
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
      
      {/* Resizer handle */}
      <div 
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary active:bg-primary z-10",
          !isResizing && "transition-colors",
          isResizing && "bg-primary glow-shadow"
        )}
        onMouseDown={startResizing}
      />
    </div>
  );
}
