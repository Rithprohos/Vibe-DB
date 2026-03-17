import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { listTables } from '../lib/db';
import { clearStoredConnectionAuthToken } from '../lib/connectionTokenStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Database,
  LayoutTemplate,
  Eye,
  RefreshCw,
  Plus,
  Inbox,
  Pencil,
  X,
  Cloud,
  Server,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EditConnectionDialog from './EditConnectionDialog';
import SavedQueriesSection from './SavedQueriesSection';
import SidebarObjectSection from './SidebarObjectSection';
import { ImportConfirmDialog } from '@/features/table-transfer/ImportConfirmDialog';
import { useTableTransfer } from '@/features/table-transfer/useTableTransfer';
import { useDevRenderCounter } from '@/lib/dev-performance';
import {
  ALL_SCHEMAS_VALUE,
  getSchemaName,
} from '@/lib/databaseObjects';
import { getConnectionDatabaseName } from '@/lib/connectionDisplay';
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import TruncateTableDialog from './TruncateTableDialog';
import DropTableDialog from './DropTableDialog';
import { orderPinnedTablesFirst } from '@/lib/sidebarTablePinning';

const DEFAULT_SIDEBAR_WIDTH = 288;

export default function Sidebar() {
  useDevRenderCounter('Sidebar');
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const connections = useAppStore(s => s.connections);
  const isConnected = useAppStore(s => s.isConnected);
  const tablesByConnection = useAppStore(s => s.tablesByConnection);
  const pinnedTablesByConnection = useAppStore(s => s.pinnedTablesByConnection);
  const selectedTable = useAppStore(s => s.selectedTable);
  const setTables = useAppStore(s => s.setTables);
  const togglePinnedTable = useAppStore(s => s.togglePinnedTable);
  const openTableTab = useAppStore(s => s.openTableTab);
  const openVisualizationTab = useAppStore(s => s.openVisualizationTab);
  const addTab = useAppStore(s => s.addTab);
  const closeTab = useAppStore(s => s.closeTab);

  const activeConnection = activeSidebarConnectionId 
    ? connections.find(c => c.id === activeSidebarConnectionId) 
    : undefined;
  const {
    exportTable,
    importTable,
    confirmImport,
    closeImportDialog,
    isTransferPending,
    pendingImport,
  } = useTableTransfer(activeConnection);
  const activeConnectionId = activeConnection?.id;
  const activeConnectionConnId = activeConnection?.connId;
  const tables = activeSidebarConnectionId 
    ? (tablesByConnection[activeSidebarConnectionId] || []) 
    : [];

  const [search, setSearch] = useState('');
  const [tablesOpen, setTablesOpen] = useState(true);
  const [viewsOpen, setViewsOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState(ALL_SCHEMAS_VALUE);
  const [truncateDialogOpen, setTruncateDialogOpen] = useState(false);
  const [truncateTableName, setTruncateTableName] = useState('');
  const [dropDialogOpen, setDropDialogOpen] = useState(false);
  const [dropTableName, setDropTableName] = useState('');

  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const currentWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const rafIdRef = useRef<number | null>(null);
  const targetWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
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
      .sort(([left], [right]) => {
        if (left === 'public') return -1;
        if (right === 'public') return 1;
        return left.localeCompare(right);
      })
      .map(([value, count]) => ({
        value,
        count,
      }));
  }, [tables]);
  const showSchemaFilter = isPostgresConnection && schemaOptions.length > 0;
  const showSchemaBadge = isPostgresConnection && schemaOptions.length > 1;
  const pinnedTableNames = useMemo(
    () => (activeConnectionId ? (pinnedTablesByConnection[activeConnectionId] ?? []) : []),
    [activeConnectionId, pinnedTablesByConnection],
  );
  const pinnedTableNameSet = useMemo(
    () => new Set(pinnedTableNames),
    [pinnedTableNames],
  );
  const defaultSchemaValue = useMemo(
    () => {
      if (schemaOptions.some((schema) => schema.value === 'public')) {
        return 'public';
      }
      return schemaOptions.length === 1 ? schemaOptions[0].value : ALL_SCHEMAS_VALUE;
    },
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
  const orderedFilteredTables = useMemo(
    () => orderPinnedTablesFirst(filteredTables, pinnedTableNameSet),
    [filteredTables, pinnedTableNameSet],
  );
  const visibleObjectCount = filteredTables.length + filteredViews.length;

  const getConnectionTagClassName = (tag?: string) =>
    cn(
      'rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] leading-none whitespace-nowrap',
      tag === 'production'
        ? 'border-red-500/40 bg-red-500/15 text-red-400'
        : tag === 'development'
          ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
          : tag === 'testing'
            ? 'border-sky-500/40 bg-sky-500/15 text-sky-400'
            : 'border-primary/40 bg-primary/15 text-primary',
    );

  const renderConnectionIcon = (type: string, className: string) => {
    if (type === 'turso') {
      return <Cloud size={18} className={className} />;
    }

    if (type === 'postgres') {
      return <Server size={18} className={className} />;
    }

    return <Database size={18} className={className} />;
  };

  const handleRefresh = useCallback(async () => {
    if (!activeConnectionConnId || !activeConnectionId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await listTables(activeConnectionConnId);
      setTables(activeConnectionId, result);
    } catch (e) {
      console.error('Failed to refresh:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeConnectionConnId, activeConnectionId, isRefreshing, setTables]);

  const handleDropSuccess = useCallback((tableName: string) => {
    if (!activeConnectionId) return;

    const relatedTabs = useAppStore
      .getState()
      .tabs
      .filter((tab) => tab.connectionId === activeConnectionId && tab.tableName === tableName);

    relatedTabs.forEach((tab) => {
      closeTab(tab.id);
    });

    void handleRefresh();
  }, [activeConnectionId, closeTab, handleRefresh]);

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

  const handleTruncateTable = useCallback((tableName: string) => {
    if (!activeConnection) return;
    setTruncateTableName(tableName);
    setTruncateDialogOpen(true);
  }, [activeConnection]);

  const handleDropTable = useCallback((tableName: string) => {
    if (!activeConnection) return;
    setDropTableName(tableName);
    setDropDialogOpen(true);
  }, [activeConnection]);

  const handleTogglePinnedTable = useCallback((tableName: string) => {
    if (!activeConnectionId) return;
    togglePinnedTable(activeConnectionId, tableName);
  }, [activeConnectionId, togglePinnedTable]);

  const handleOpenVisualize = useCallback((tableName: string) => {
    if (!activeConnection) return;

    const schemaName =
      activeConnection.type === 'postgres'
        ? selectedSchema !== ALL_SCHEMAS_VALUE
          ? selectedSchema
          : null
        : 'main';

    openVisualizationTab({
      connectionId: activeConnection.id,
      schemaName,
      sourceTable: tableName,
    });
  }, [activeConnection, openVisualizationTab, selectedSchema]);

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
        'relative flex h-full flex-shrink-0 select-none flex-col border-r border-border/40 bg-background',
        !isResizing && 'transition-[width] duration-200 ease-out',
      )}
      ref={sidebarRef}
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        backgroundImage:
          'radial-gradient(circle at top, rgba(var(--glow-color), 0.1), transparent 28%), linear-gradient(180deg, rgba(var(--glow-color), 0.03), transparent 24%)',
      }}
    >
      <div className="relative z-10 border-b border-border/35 px-3 pb-3 pt-3">
        {isConnected && activeConnection?.connId ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
                  Active Connection
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground/80">
                  Connected workspace
                </div>
              </div>
              {activeConnection.tag && (
                <span className={getConnectionTagClassName(activeConnection.tag)}>
                  {activeConnection.tag}
                </span>
              )}
            </div>

            <div
              className="group relative cursor-pointer overflow-hidden rounded-md border border-border/40 bg-background/80 shadow-[var(--panel-shadow)] transition-all duration-200 hover:border-primary/25 hover:bg-background/90"
              onClick={() => setEditDialogOpen(true)}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--glow-color),0.16),transparent_34%)] opacity-70 transition-opacity duration-200 group-hover:opacity-100" />
              <div className="relative flex items-start gap-3 p-3.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-border/35 bg-background/90 shadow-sm shadow-black/10">
                  {renderConnectionIcon(
                    activeConnection.type,
                    'text-primary transition-all group-hover:neon-text',
                  )}
                </div>
                <div className="min-w-0 flex-1 pr-10">
                  <div className="truncate text-sm font-semibold leading-tight text-foreground">
                    {activeConnection.name}
                  </div>
                  {activeDatabaseName && (
                    <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-primary/80">
                      {activeDatabaseName}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/80" />
                      {activeConnection.type}
                    </span>
                  </div>
                </div>

                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-all duration-200 group-hover:opacity-100">
                  <button
                    className="rounded-md border border-transparent p-1.5 text-muted-foreground transition-colors hover:border-primary/20 hover:bg-primary/10 hover:text-primary"
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
            </div>
            <EditConnectionDialog
              connection={activeConnection}
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
            />
            {showSchemaFilter && (
              <div className="rounded-md border border-border/35 bg-background/50 p-2.5 shadow-sm shadow-black/10">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                    Schema
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60">
                    {schemaOptions.length}
                  </span>
                </div>
                <Select value={selectedSchema} onValueChange={setSelectedSchema}>
                  <SelectTrigger className="h-9 rounded-sm border-border/40 bg-background/90 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/90 focus:ring-1 focus:ring-primary/20">
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
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
                  Connections
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground/80">
                  Reconnect or add a database
                </div>
              </div>
              <button
                className="rounded-sm border border-border/35 bg-background/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary/25 hover:text-primary"
                onClick={() => useAppStore.getState().setShowConnectionDialog(true)}
              >
                + New
              </button>
            </div>
            {connections.length > 0 ? (
              <div className="space-y-2">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="group relative cursor-pointer overflow-hidden rounded-md border border-border/35 bg-background/70 p-3 transition-all duration-200 hover:border-primary/20 hover:bg-accent/30"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent('vibedb:connect', { detail: conn })
                      );
                    }}
                  >
                    <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-primary/80 via-primary/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                    <div className="flex items-start gap-3 pr-8">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border/35 bg-background/90 shadow-sm shadow-black/10 transition-colors group-hover:border-primary/20">
                        {renderConnectionIcon(
                          conn.type,
                          'text-muted-foreground transition-colors group-hover:text-primary',
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium leading-tight text-foreground">
                          {conn.name}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            {conn.type}
                          </span>
                          {conn.tag && (
                            <span className={getConnectionTagClassName(conn.tag)}>
                              {conn.tag}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-transparent p-1 text-muted-foreground/0 transition-all duration-200 hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive group-hover:text-muted-foreground"
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
              <div className="rounded-md border border-dashed border-border/40 bg-background/30 px-4 py-7 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-border/35 bg-background/80">
                  <Database size={18} className="text-muted-foreground/50" />
                </div>
                <div className="text-xs text-muted-foreground">No saved connections</div>
              </div>
            )}
          </div>
        )}
      </div>

      {isConnected && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col px-3 pb-4 pt-3">
          <div className="rounded-md border border-border/35 bg-background/50 p-2.5 shadow-sm shadow-black/10">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Workbench
              </div>
              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/60">
                {visibleObjectCount} objects
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1 justify-start rounded-sm border-border/35 bg-background/80 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] hover:border-indigo-500/25 hover:bg-indigo-500/10 hover:text-indigo-400"
                onClick={handleNewQuery}
              >
                <Plus size={14} />
                <span>Query</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1 justify-start rounded-sm border-border/35 bg-background/80 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] hover:border-emerald-500/25 hover:bg-emerald-500/10 hover:text-emerald-400"
                onClick={handleCreateTable}
              >
                <Plus size={14} />
                <span>Table</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-sm border-border/35 bg-background/80 px-2.5 hover:border-amber-500/25 hover:bg-amber-500/10 hover:text-amber-400"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw size={14} className={cn(isRefreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-border/35 bg-background/50 p-2.5 shadow-sm shadow-black/10">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
              />
              <Input
                type="text"
                placeholder={showSchemaFilter ? 'Search tables or schemas...' : 'Search tables...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-sm border-border/35 bg-background pl-9 pr-16 text-sm font-medium placeholder:text-muted-foreground/40 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              />
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-border/35 bg-background/65 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/70">
                {visibleObjectCount}
              </div>
            </div>
          </div>

          <div className="mt-3 flex-1 min-h-0 rounded-md border border-border/30 bg-background/30 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="flex h-full min-h-0 flex-col space-y-4">
              <SavedQueriesSection />

              <SidebarObjectSection
                title="Views"
                items={filteredViews}
                open={viewsOpen}
                onToggle={() => setViewsOpen(!viewsOpen)}
                onCreate={handleCreateView}
                createTitle="Create View"
                createButtonClassName="rounded-sm hover:bg-indigo-500/20 hover:text-indigo-400"
                itemIcon={Eye}
                selectedItem={selectedTable}
                showSchemaBadge={showSchemaBadge}
                listClassName="max-h-80 overflow-auto pr-1"
                onOpenData={(qualifiedName) => openTableTab(activeConnection!.id, qualifiedName, 'data')}
                onOpenStructure={(qualifiedName) => openTableTab(activeConnection!.id, qualifiedName, 'structure')}
              />

              <SidebarObjectSection
                title="Tables"
                items={orderedFilteredTables}
                open={tablesOpen}
                onToggle={() => setTablesOpen(!tablesOpen)}
                onCreate={handleCreateTable}
                createTitle="Create Table"
                createButtonClassName="rounded-sm hover:bg-emerald-500/20 hover:text-emerald-400"
                itemIcon={LayoutTemplate}
                selectedItem={selectedTable}
                showSchemaBadge={showSchemaBadge}
                isItemPinned={(qualifiedName) => pinnedTableNameSet.has(qualifiedName)}
                listClassName="flex-1 min-h-0 overflow-auto pr-1"
                containerClassName="flex min-h-0 flex-1 flex-col"
                onOpenData={(qualifiedName) => openTableTab(activeConnection!.id, qualifiedName, 'data')}
                onOpenStructure={(qualifiedName) => openTableTab(activeConnection!.id, qualifiedName, 'structure')}
                renderMenuItems={(qualifiedName) => (
                  <>
                    <ContextMenuItem onClick={() => handleOpenVisualize(qualifiedName)}>
                      Open Table Visualize
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuSub>
                      <ContextMenuSubTrigger disabled={isTransferPending}>
                        Export...
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-44">
                        <ContextMenuItem onClick={() => void exportTable(qualifiedName, 'csv')}>
                          Export as CSV
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => void exportTable(qualifiedName, 'json')}>
                          Export as JSON
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => void exportTable(qualifiedName, 'sql')}>
                          Export as SQL
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger disabled={isTransferPending}>
                        Import...
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-44">
                        <ContextMenuItem onClick={() => void importTable(qualifiedName, 'csv')}>
                          Import CSV
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => void importTable(qualifiedName, 'json')}>
                          Import JSON
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handleTogglePinnedTable(qualifiedName)}>
                      {pinnedTableNameSet.has(qualifiedName) ? 'Unpin Table' : 'Pin Table'}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => handleEditTable(qualifiedName)}>
                      Edit Table
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => handleTruncateTable(qualifiedName)}
                      className="text-destructive hover:text-destructive focus:text-destructive data-[highlighted]:text-destructive"
                    >
                      Truncate Table
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => handleDropTable(qualifiedName)}
                      className="text-destructive hover:text-destructive focus:text-destructive data-[highlighted]:text-destructive"
                    >
                      Drop Table
                    </ContextMenuItem>
                  </>
                )}
              />

              {filteredTables.length === 0 && filteredViews.length === 0 && !search && (
                <div className="mt-4 rounded-md border border-dashed border-border/40 bg-background/35 px-4 py-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md border border-border/35 bg-background/80">
                    <Inbox size={20} className="text-muted-foreground/55" />
                  </div>
                  <div className="mb-1 text-sm font-medium text-foreground">
                    {selectedSchema === ALL_SCHEMAS_VALUE
                      ? 'No tables found'
                      : `No objects in ${selectedSchema}`}
                  </div>
                  <div className="mx-auto max-w-[180px] text-xs leading-relaxed text-muted-foreground">
                    {selectedSchema === ALL_SCHEMAS_VALUE
                      ? 'Create a table to get started with VibeDB'
                      : 'Choose another schema or create an object in this schema'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resizer handle */}
      <div
        className={cn(
          'absolute bottom-0 right-0 top-0 z-20 w-1 cursor-col-resize hover:bg-primary active:bg-primary',
          !isResizing && 'transition-colors',
          isResizing && 'bg-primary glow-shadow',
        )}
        onMouseDown={startResizing}
      />

      {/* Truncate Table Dialog */}
      {pendingImport && (
        <ImportConfirmDialog
          open={true}
          tableName={pendingImport.tableName}
          fileName={pendingImport.fileName}
          autoGeneratedColumns={pendingImport.autoGeneratedColumns}
          pending={isTransferPending}
          onOpenChange={closeImportDialog}
          onConfirm={(excludeAutoGeneratedColumns) =>
            void confirmImport(excludeAutoGeneratedColumns)
          }
        />
      )}

      {activeConnection && (
        <TruncateTableDialog
          open={truncateDialogOpen}
          onOpenChange={setTruncateDialogOpen}
          tableName={truncateTableName}
          connectionId={activeConnection.id}
          engineType={activeConnection.type}
          onSuccess={() => {
            // Refresh tables after truncation to update row counts
            void handleRefresh();
          }}
        />
      )}

      {/* Drop Table Dialog */}
      {activeConnection && (
        <DropTableDialog
          open={dropDialogOpen}
          onOpenChange={setDropDialogOpen}
          tableName={dropTableName}
          connectionId={activeConnection.id}
          onSuccess={handleDropSuccess}
        />
      )}
    </div>
  );
}
