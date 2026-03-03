import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { listTables } from '../lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Database, Zap, LayoutTemplate, Eye, RefreshCw, Plus, ChevronRight, ChevronDown, Inbox, Pencil, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import EditConnectionDialog from './EditConnectionDialog';

export default function Sidebar() {
  const {
    activeConnection,
    isConnected,
    tables,
    selectedTable,
    setShowConnectionDialog,
    setTables,
    openTableTab,
    addTab,
  } = useAppStore();

  const [search, setSearch] = useState('');
  const [tablesOpen, setTablesOpen] = useState(true);
  const [viewsOpen, setViewsOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);

  // Resizing logic
  const startResizing = () => setIsResizing(true);
  const stopResizing = () => setIsResizing(false);
  const resize = (e: MouseEvent) => {
    if (isResizing) {
      if (e.clientX > 200 && e.clientX < 600) {
        setSidebarWidth(e.clientX);
      }
    }
  };

  useEffect(() => {
    if (isResizing) {
      document.body.classList.add('select-none');
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      document.body.classList.remove('select-none');
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      document.body.classList.remove('select-none');
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing]);

  const filteredTables = tables.filter(
    (t) =>
      t.table_type === 'table' &&
      t.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredViews = tables.filter(
    (t) =>
      t.table_type === 'view' &&
      t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRefresh = async () => {
    if (!activeConnection?.connId) return;
    try {
      const result = await listTables(activeConnection.connId);
      setTables(result);
    } catch (e) {
      console.error('Failed to refresh:', e);
    }
  };

  const handleNewQuery = () => {
    const id = `query-${Date.now()}`;
    addTab({
      id,
      type: 'query',
      title: 'New Query',
      query: '',
    });
  };

  return (
    <div 
      className="relative flex flex-col bg-secondary border-r border-border h-full flex-shrink-0 transition-all duration-200 ease-out select-none"
      ref={sidebarRef}
      style={{ 
        width: sidebarWidth, 
        minWidth: sidebarWidth
      }}
    >
      <div className="p-3">
        {isConnected && activeConnection ? (
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
                <button
                  className="p-1.5 rounded-md hover:bg-primary/10 hover:text-primary text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowConnectionDialog(true);
                  }}
                  title="Switch Connection"
                >
                  <ArrowRightLeft size={12} />
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
          <Button 
            className="w-full justify-start space-x-2 shadow-glow" 
            onClick={() => setShowConnectionDialog(true)}
          >
            <Zap size={16} />
            <span>New Connection</span>
          </Button>
        )}
      </div>

      {isConnected && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex px-3 gap-2 pb-3 border-b border-border">
            <Button variant="outline" size="sm" className="flex-1 space-x-1 border-border/50 bg-background/50 hover:bg-accent/50" onClick={handleNewQuery}>
              <Plus size={14} />
              <span>Query</span>
            </Button>
            <Button variant="outline" size="sm" className="flex-1 space-x-1 border-border/50 bg-background/50 hover:bg-accent/50" onClick={handleRefresh}>
              <RefreshCw size={14} />
              <span>Refresh</span>
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
                  <div className="space-y-0.5">
                    {filteredTables.map((t) => (
                      <div
                        key={t.name}
                        className={cn(
                          "flex items-center space-x-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-all",
                          selectedTable === t.name 
                            ? "bg-primary/10 text-primary border border-primary/20" 
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        onClick={() => openTableTab(t.name, 'data')}
                        onDoubleClick={() => openTableTab(t.name, 'structure')}
                      >
                        <LayoutTemplate size={14} className={selectedTable === t.name ? "text-primary" : "text-muted-foreground"} />
                        <span className="truncate">{t.name}</span>
                      </div>
                    ))}
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
                    <div className="space-y-0.5">
                      {filteredViews.map((t) => (
                        <div
                          key={t.name}
                          className={cn(
                            "flex items-center space-x-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-all",
                            selectedTable === t.name 
                              ? "bg-primary/10 text-primary border border-primary/20" 
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                          onClick={() => openTableTab(t.name, 'data')}
                        >
                          <Eye size={14} className={selectedTable === t.name ? "text-primary" : "text-muted-foreground"} />
                          <span className="truncate">{t.name}</span>
                        </div>
                      ))}
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
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary active:bg-primary transition-colors z-10",
          isResizing && "bg-primary glow-shadow"
        )}
        onMouseDown={startResizing}
      />
    </div>
  );
}
