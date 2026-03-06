import { useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useAppStore, type Connection, MAX_ACTIVE_CONNECTIONS } from '../store/useAppStore';
import { createDatabase } from '../lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Database, FolderOpen, Plus, ArrowRight, X, Clock, Pencil } from 'lucide-react';
import EditConnectionDialog from './EditConnectionDialog';
import { cn } from '@/lib/utils';

export default function ConnectionDialog() {
  const showConnectionDialog = useAppStore(s => s.showConnectionDialog);
  const setShowConnectionDialog = useAppStore(s => s.setShowConnectionDialog);
  const connections = useAppStore(s => s.connections);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const removeConnection = useAppStore(s => s.removeConnection);
  const activeConnection = connections.find(c => c.id === activeSidebarConnectionId);
  const activeConnectionsCount = connections.filter(c => c.connId).length;

  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const [tag, setTag] = useState<'local' | 'testing' | 'development' | 'production'>();
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);

  // Filter out the active connection from recent list
  const recentConnections = connections.filter(
    (c) => c.id !== activeConnection?.id
  );

  const handleBrowse = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'SQLite Database',
            extensions: ['db', 'sqlite', 'sqlite3', 'db3'],
          },
          {
            name: 'All Files',
            extensions: ['*'],
          },
        ],
      });
      if (selected) {
        setPath(selected as string);
        if (!name) {
          const parts = (selected as string).split('/');
          setName(parts[parts.length - 1].replace(/\.[^.]+$/, ''));
        }
      }
    } catch (e) {
      console.error('File dialog error:', e);
    }
  };

  const handleCreateNew = async () => {
    try {
      const selected = await save({
        filters: [
          {
            name: 'SQLite Database',
            extensions: ['db', 'sqlite', 'sqlite3'],
          },
        ],
        defaultPath: 'new-database.db',
      });
      if (selected) {
        let filePath = selected as string;
        // Ensure .db extension
        if (!/\.\w+$/.test(filePath)) {
          filePath += '.db';
        }
        // Create the database file via Rust
        await createDatabase(filePath);
        setPath(filePath);
        if (!name) {
          const parts = filePath.split('/');
          setName(parts[parts.length - 1].replace(/\.[^.]+$/, ''));
        }
      }
    } catch (e: any) {
      setError(`Failed to create database: ${e}`);
    }
  };

  const handleConnect = () => {
    if (!path.trim()) {
      setError('Please provide a database path');
      return;
    }
    if (!tag) {
      setError('Please select an environment label');
      return;
    }

    if (activeConnectionsCount >= MAX_ACTIVE_CONNECTIONS) {
      setError(`Maximum ${MAX_ACTIVE_CONNECTIONS} active connections allowed. Close one first.`);
      return;
    }

    const conn: Connection = {
      id: `conn-${Date.now()}`,
      name: name || path.split('/').pop() || 'Database',
      path: path.trim(),
      type: 'sqlite',
      lastUsed: Date.now(),
      tag,
    };

    setShowConnectionDialog(false);
    window.dispatchEvent(
      new CustomEvent('vibedb:connect', { detail: conn })
    );
  };

  const handleSwitchTo = (conn: Connection) => {
    if (!conn.connId && activeConnectionsCount >= MAX_ACTIVE_CONNECTIONS) {
      setError(`Maximum ${MAX_ACTIVE_CONNECTIONS} active connections allowed. Close one first.`);
      return;
    }
    setShowConnectionDialog(false);
    window.dispatchEvent(
      new CustomEvent('vibedb:connect', { detail: conn })
    );
  };

  return (
    <>
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[1200px] bg-card border-border shadow-xl shadow-black/5 dark:shadow-2xl dark:shadow-black/40 p-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent-secondary to-primary" />
        
        <div className="p-6 pb-4">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center space-x-2 text-xl font-bold tracking-tight">
              <Database className="text-primary" />
              <span>SQLite Connection</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              Open an existing database or create a new one to connect.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start">
            <section className="rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Clock size={12} className="text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent & Saved
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Browse previous connections and reopen instantly.
              </p>
              {recentConnections.length > 0 ? (
                <div className="grid gap-2">
                  {recentConnections.map((conn) => (
                    <div
                      key={conn.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border/50 cursor-pointer hover:border-primary/40 hover:bg-secondary/50 transition-all group"
                      onClick={() => handleSwitchTo(conn)}
                    >
                      <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                        <Database size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-foreground truncate">{conn.name}</div>
                          {conn.tag && (
                            <span className={cn(
                              "px-1.5 py-0 rounded-[4px] text-[8px] font-bold uppercase tracking-widest border",
                              conn.tag === 'production'
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : "bg-primary/10 text-primary/80 border-primary/20"
                            )}>
                              {conn.tag}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate font-mono mt-0.5 opacity-70">{conn.path}</div>
                      </div>
                      <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all flex-shrink-0" />
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 hover:text-primary flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingConnection(conn);
                        }}
                        title="Edit"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeConnection(conn.id);
                        }}
                        title="Remove"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border/70 bg-background/60 p-6 text-center">
                  <Database size={22} className="mx-auto mb-2 text-muted-foreground/80" />
                  <p className="text-sm text-foreground">No saved connections yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create one on the right to start building your list.
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="mb-4">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  New Connection
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a fresh SQLite file or create one.
                </p>
              </div>
              <div className="grid gap-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Connection Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="My Database"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-background border-border focus-visible:ring-primary h-11 transition-all focus:bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="path" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Database File
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      id="path"
                      placeholder="/path/to/database.db"
                      value={path}
                      onChange={(e) => {
                        setPath(e.target.value);
                        setError('');
                      }}
                      className="flex-1 bg-background border-border font-mono text-xs focus-visible:ring-primary h-11 transition-all focus:bg-background"
                    />
                    <Button
                      variant="secondary"
                      onClick={handleBrowse}
                      className="px-3 border border-border bg-background hover:bg-secondary transition-colors h-11"
                      title="Browse Files"
                    >
                      <FolderOpen size={18} className="text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCreateNew}
                      className="px-3 border-primary/30 text-primary hover:bg-primary/10 h-11 transition-colors group"
                      title="Create New Database"
                    >
                      <Plus size={18} className="group-hover:neon-text" />
                    </Button>
                  </div>
                  {error && (
                    <p className="text-xs text-destructive font-medium mt-2 p-2 bg-destructive/10 rounded border border-destructive/20 animate-fade-in">
                      {error}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Environment Label <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(['local', 'testing', 'development', 'production'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setTag(t);
                          setError('');
                        }}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border ${
                          tag === t
                            ? t === 'production'
                              ? 'bg-red-500/20 border-red-500/40 text-red-400 shadow-[0_0_10px_rgba(248,113,113,0.15)]'
                              : 'bg-primary/20 border-primary text-primary glow-shadow'
                            : 'bg-background hover:bg-secondary border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {!tag && (
                    <p className="text-[11px] text-destructive">
                      Environment label is required.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>

        <DialogFooter className="bg-secondary/50 p-4 border-t border-border flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:items-center">
          <Button
            variant="ghost"
            onClick={() => setShowConnectionDialog(false)}
            className="hover:bg-secondary text-muted-foreground w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!path.trim() || !tag}
            className="shadow-glow px-8 rounded-full font-semibold tracking-wide w-full sm:w-auto"
          >
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
      <EditConnectionDialog
        connection={editingConnection}
        open={!!editingConnection}
        onOpenChange={(open) => !open && setEditingConnection(null)}
      />
    </>
  );
}
