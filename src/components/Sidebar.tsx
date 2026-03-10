import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { listTables } from '../lib/db';
import { clearStoredConnectionAuthToken } from '../lib/connectionTokenStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Database, LayoutTemplate, Eye, RefreshCw, Plus, ChevronRight, ChevronDown, Inbox, Pencil, X, Cloud, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import EditConnectionDialog from './EditConnectionDialog';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDevRenderCounter } from '@/lib/dev-performance';
import {
  ALL_SCHEMAS_VALUE,
  getQualifiedTableName,
  getSchemaName,
} from '@/lib/databaseObjects';
import { getConnectionDatabaseName } from '@/lib/connectionDisplay';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuEpoch, setContextMenuEpoch] = useState(0);
  const [selectedSchema, setSelectedSchema] = useState(ALL_SCHEMAS_VALUE);

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
  const isPostgresConnection = activeConnection?.type === 'postgres';
  const activeDatabaseName = useMemo(
    () => (activeConnection ? getConnectionDatabaseName(activeConnection) : null),
    [activeConnection],
  );
  const schemaOptions = useMemo(() => {
    const counts = new Map<string, number>();

    tables.forEach((table) => {
      const schema = getSchemaName(table);
      if (!schema) return;
      counts.set(schema, (counts.get(schema) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([value, count]) => ({
        value,
        count,
      }));
  }, [tables]);
  const showSchemaFilter = isPostgresConnection && schemaOptions.length > 0;
  const showSchemaBadge = isPostgresConnection && schemaOptions.length > 1;
  const defaultSchemaValue = useMemo(
    () => (schemaOptions.length === 1 ? schemaOptions[0].value : ALL_SCHEMAS_VALUE),
    [schemaOptions],
  );

  useEffect(() => {
    setSelectedSchema(defaultSchemaValue);
  }, [activeSidebarConnectionId, defaultSchemaValue]);

  useEffect(() => {
    if (
      selectedSchema !== ALL_SCHEMAS_VALUE &&
      !schemaOptions.some((schema) => schema.value === selectedSchema)
    ) {
      setSelectedSchema(defaultSchemaValue);
    }
  }, [defaultSchemaValue, schemaOptions, selectedSchema]);

  const { filteredTables, filteredViews } = useMemo(() => {
    const nextTables: typeof tables = [];
    const nextViews: typeof tables = [];

    tables.forEach((table) => {
      const schemaName = getSchemaName(table);
      if (
        showSchemaFilter &&
        selectedSchema !== ALL_SCHEMAS_VALUE &&
        schemaName !== selectedSchema
      ) {
        return;
      }

      const haystack = `${table.name} ${schemaName ?? ''}`.toLowerCase();
      if (normalizedSearch && !haystack.includes(normalizedSearch)) {
        return;
      }

      if (table.table_type === 'view') {
        nextViews.push(table);
      } else if (table.table_type === 'table') {
        nextTables.push(table);
      }
    });

    return { filteredTables: nextTables, filteredViews: nextViews };
  }, [tables, normalizedSearch, selectedSchema, showSchemaFilter]);

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
    if (!activeConnection?.connId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await listTables(activeConnection.connId);
      setTables(activeConnection.id, result);
    } catch (e) {
      console.error('Failed to refresh:', e);
    } finally {
      setIsRefreshing(false);
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
  
  const handleCreateView = () => {
    if (!activeConnection) return;
    const id = `create-view-${Date.now()}`;
    addTab({
      id,
      connectionId: activeConnection.id,
      type: 'create-view',
      title: 'Create View',
      createViewDraft: {
        viewName: 'new_view',
        sourceSql: 'SELECT * FROM table_name',
        ifNotExists: true,
        temporary: false,
      },
    });
  };

  const handleEditTable = useCallback((tableName: string) => {
    if (!activeConnection) return;
    openTableTab(activeConnection.id, tableName, 'edit-table');
  }, [activeConnection, openTableTab]);

  const handleRemoveConnection = useCallback(async (connectionId: string) => {
    try {
      await clearStoredConnectionAuthToken(connectionId);
    } catch (e) {
      console.error(`Failed to clear secure token for ${connectionId}:`, e);
    } finally {
      useAppStore.getState().removeConnection(connectionId);
    }
  }, []);

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
              {activeConnection?.type === 'turso' ? (
                <Cloud size={18} className="text-primary group-hover:neon-text transition-all flex-shrink-0" />
              ) : activeConnection?.type === 'postgres' ? (
                <Server size={18} className="text-primary group-hover:neon-text transition-all flex-shrink-0" />
              ) : (
                <Database size={18} className="text-primary group-hover:neon-text transition-all flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0 pr-12">
                <div className="text-sm font-medium text-foreground truncate leading-tight">
                  {activeConnection.name}
                </div>
                {activeDatabaseName && (
                  <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-primary/80">
                    {activeDatabaseName}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex-shrink-0">{activeConnection.type}</div>
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
            {showSchemaFilter && (
              <div className="mt-3">
                <div className="mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                    Schema
                  </span>
                </div>
                <Select value={selectedSchema} onValueChange={setSelectedSchema}>
                  <SelectTrigger className="h-8 border-border/40 bg-secondary/10 px-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/90 focus:ring-1 focus:ring-primary/20">
                    <SelectValue placeholder="All schemas" />
                  </SelectTrigger>
                  <SelectContent>
                    {schemaOptions.length > 1 && (
                      <SelectItem value={ALL_SCHEMAS_VALUE}>All schemas</SelectItem>
                    )}
                    {schemaOptions.map((schema) => (
                      <SelectItem key={schema.value} value={schema.value}>
                        {schema.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                    <div className="w-8 h-8 rounded-sm bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                        {conn.type === 'turso' ? (
                          <Cloud size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        ) : conn.type === 'postgres' ? (
                          <Server size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        ) : (
                          <Database size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                      </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate leading-tight">
                        {conn.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {conn.type}
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
                        void handleRemoveConnection(conn.id);
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
            <Button variant="outline" size="sm" className="flex-1 space-x-1 border-border/50 bg-background/50 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/30" onClick={handleNewQuery}>
              <Plus size={14} />
              <span>Query</span>
            </Button>
            <Button variant="outline" size="sm" className="flex-1 space-x-1 border-border/50 bg-background/50 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30" onClick={handleCreateTable}>
              <Plus size={14} />
              <span>Table</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="space-x-1 border-border/50 bg-background/50 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30 px-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
            </Button>
          </div>

          <div className="p-3">
            <Input
              type="text"
              placeholder={showSchemaFilter ? "Search tables or schemas..." : "Search tables..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-border/30 placeholder:text-muted-foreground/20 text-sm focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary/30 h-8"
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
                  <div className="flex items-center gap-2">
                    <span className="bg-background px-1.5 py-0.5 rounded text-[10px] font-mono border border-border">
                      {filteredTables.length}
                    </span>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-emerald-500/20 hover:text-emerald-400 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateTable();
                      }}
                      title="Create Table"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                
                {tablesOpen && (
                  <div ref={tablesListRef} className="max-h-80 overflow-auto pr-1">
                    <div style={{ height: `${tableVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                      {tableVirtualizer.getVirtualItems().map((virtualItem) => {
                        const t = filteredTables[virtualItem.index];
                        const qualifiedName = getQualifiedTableName(t);
                        const schemaName = getSchemaName(t);
                        const menuKey = `table:${qualifiedName}`;
                        return (
                          <div
                            key={qualifiedName}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${virtualItem.start}px)`,
                              paddingBottom: '2px',
                            }}
                          >
                            <ContextMenu
                              key={`${menuKey}:${contextMenuEpoch}`}
                              onOpenChange={setIsContextMenuOpen}
                            >
                              <ContextMenuTrigger asChild>
                                <div
                                  className={cn(
                                    "flex items-center space-x-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-all",
                                    selectedTable === qualifiedName
                                      ? "bg-primary/10 text-primary border border-primary/20"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                  )}
                                  onClick={() => openTableTab(activeConnection!.id, qualifiedName, 'data')}
                                  onDoubleClick={() => openTableTab(activeConnection!.id, qualifiedName, 'structure')}
                                >
                                  <LayoutTemplate size={14} className={selectedTable === qualifiedName ? "text-primary" : "text-muted-foreground"} />
                                  <span className="truncate">{t.name}</span>
                                  {showSchemaBadge && schemaName && (
                                    <span className="ml-auto rounded-sm border border-border/60 bg-background/70 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground/70">
                                      {schemaName}
                                    </span>
                                  )}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-48">
                                <ContextMenuItem
                                  onClick={() => {
                                    setIsContextMenuOpen(false);
                                    openTableTab(activeConnection!.id, qualifiedName, 'data');
                                  }}
                                >
                                  Open Data
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => {
                                    setIsContextMenuOpen(false);
                                    openTableTab(activeConnection!.id, qualifiedName, 'structure');
                                  }}
                                >
                                  Open Structure
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  onClick={() => {
                                    setIsContextMenuOpen(false);
                                    handleEditTable(qualifiedName);
                                  }}
                                >
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
              <div className="space-y-1">
                <div
                  className="flex items-center space-x-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors group px-2 py-1"
                  onClick={() => setViewsOpen(!viewsOpen)}
                >
                  <span className="text-[10px] transform transition-transform text-muted-foreground group-hover:text-primary">
                    {viewsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <span className="flex-1">Views</span>
                  <div className="flex items-center gap-2">
                    <span className="bg-background px-1.5 py-0.5 rounded text-[10px] font-mono border border-border">
                      {filteredViews.length}
                    </span>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-indigo-500/20 hover:text-indigo-400 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateView();
                      }}
                      title="Create View"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                
                {viewsOpen && (
                  <div ref={viewsListRef} className="max-h-80 overflow-auto pr-1">
                    <div style={{ height: `${viewVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                      {viewVirtualizer.getVirtualItems().map((virtualItem) => {
                        const t = filteredViews[virtualItem.index];
                        const qualifiedName = getQualifiedTableName(t);
                        const schemaName = getSchemaName(t);
                        const menuKey = `view:${qualifiedName}`;
                        return (
                          <div
                            key={qualifiedName}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${virtualItem.start}px)`,
                              paddingBottom: '2px',
                            }}
                          >
                            <ContextMenu
                              key={`${menuKey}:${contextMenuEpoch}`}
                              onOpenChange={setIsContextMenuOpen}
                            >
                              <ContextMenuTrigger asChild>
                                <div
                                  className={cn(
                                    "flex items-center space-x-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-all",
                                    selectedTable === qualifiedName
                                      ? "bg-primary/10 text-primary border border-primary/20"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                  )}
                                  onClick={() => openTableTab(activeConnection!.id, qualifiedName, 'data')}
                                  onDoubleClick={() => openTableTab(activeConnection!.id, qualifiedName, 'structure')}
                                >
                                  <Eye size={14} className={selectedTable === qualifiedName ? "text-primary" : "text-muted-foreground"} />
                                  <span className="truncate">{t.name}</span>
                                  {showSchemaBadge && schemaName && (
                                    <span className="ml-auto rounded-sm border border-border/60 bg-background/70 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground/70">
                                      {schemaName}
                                    </span>
                                  )}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-48">
                                <ContextMenuItem
                                  onClick={() => {
                                    setIsContextMenuOpen(false);
                                    openTableTab(activeConnection!.id, qualifiedName, 'data');
                                  }}
                                >
                                  Open Data
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => {
                                    setIsContextMenuOpen(false);
                                    openTableTab(activeConnection!.id, qualifiedName, 'structure');
                                  }}
                                >
                                  Open Structure
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

              {/* Empty state */}
              {filteredTables.length === 0 && filteredViews.length === 0 && !search && (
                <div className="text-center py-8 px-4 border border-dashed border-border rounded-lg bg-background/30 mt-4">
                  <Inbox size={24} className="mx-auto text-muted-foreground mb-2 opacity-50" />
                  <div className="text-sm font-medium text-foreground mb-1">
                    {selectedSchema === ALL_SCHEMAS_VALUE
                      ? 'No tables found'
                      : `No objects in ${selectedSchema}`}
                  </div>
                  <div className="text-xs text-muted-foreground max-w-[160px] mx-auto">
                    {selectedSchema === ALL_SCHEMAS_VALUE
                      ? 'Create a table to get started with VibeDB'
                      : 'Choose another schema or create an object in this schema'}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {isContextMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onPointerDown={() => {
            setContextMenuEpoch((value) => value + 1);
            setIsContextMenuOpen(false);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenuEpoch((value) => value + 1);
            setIsContextMenuOpen(false);
          }}
        />
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
