import { useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { homeDir, documentDir } from '@tauri-apps/api/path';
import { useAppStore, type Connection, MAX_ACTIVE_CONNECTIONS } from '../store/useAppStore';
import { clearStoredConnectionAuthToken } from '../lib/connectionTokenStore';
import { createDatabase } from '../lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Database, FolderOpen, Plus, ArrowRight, X, Clock, Pencil, Globe, Key, Cloud } from 'lucide-react';
import EditConnectionDialog from './EditConnectionDialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ConnectionDialog() {
  const showConnectionDialog = useAppStore(s => s.showConnectionDialog);
  const setShowConnectionDialog = useAppStore(s => s.setShowConnectionDialog);
  const connections = useAppStore(s => s.connections);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const removeConnection = useAppStore(s => s.removeConnection);
  const activeConnection = connections.find(c => c.id === activeSidebarConnectionId);
  const activeConnectionsCount = connections.filter(c => c.connId).length;

  const [type, setType] = useState<'sqlite' | 'turso'>('sqlite');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [host, setHost] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [error, setError] = useState('');
  const [tag, setTag] = useState<'local' | 'testing' | 'development' | 'production'>();
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);

  // Filter out the active connection from recent list
  const recentConnections = connections.filter(
    (c) => c.id !== activeConnection?.id
  );

  const handleBrowse = async () => {
    try {
      // Use document or home directory as a warm start for Finder
      let defaultPath: string | undefined;
      try {
        defaultPath = await documentDir();
      } catch {
        try {
          defaultPath = await homeDir();
        } catch {
          // Fallback to default behavior
        }
      }

      const selected = await open({
        multiple: false,
        defaultPath,
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
    if (type === 'sqlite' && !path.trim()) {
      setError('Please provide a database path');
      return;
    }
    if (type === 'turso' && (!host.trim() && !path.trim())) {
      setError('Please provide either a database URL or a local file path');
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
      name: name || (type === 'sqlite' ? path.split('/').pop() : host.split('/').pop()) || 'Database',
      path: path.trim() || undefined,
      host: host.trim() || undefined,
      hasAuthToken: type === 'turso' ? Boolean(authToken.trim()) : undefined,
      authToken: authToken.trim() || undefined,
      type,
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

  const handleRemoveConnection = async (conn: Connection) => {
    try {
      await clearStoredConnectionAuthToken(conn.id);
    } catch (e) {
      console.error(`Failed to clear secure token for ${conn.id}:`, e);
    } finally {
      removeConnection(conn.id);
    }
  };

  return (
    <>
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[1000px] max-h-[85vh] bg-card border-border/80 shadow-2xl shadow-black/20 p-0 overflow-hidden flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent-secondary to-primary" />
        
        <div className="p-6 pb-2 flex-shrink-0">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center space-x-2 text-xl font-bold tracking-tight">
              <Database className="text-primary" />
              <span>{type === 'sqlite' ? 'SQLite' : 'Turso'} Connection</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1 text-xs">
              {type === 'sqlite' 
                ? 'Open an existing database or create a new one to connect.'
                : 'Connect to your Turso database or use a local libSQL file.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-6 pt-0">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start">
            <section className="rounded-md border border-border/70 bg-background/50 p-4">
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
                      className="flex items-center gap-3 p-2.5 rounded-sm bg-background border border-border/60 cursor-pointer hover:border-primary/40 hover:bg-secondary/50 transition-all group"
                      onClick={() => handleSwitchTo(conn)}
                    >
                      <div className="w-8 h-8 rounded-sm bg-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                        {conn.type === 'turso' ? (
                          <Cloud size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        ) : (
                          <Database size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-foreground truncate">{conn.name}</div>
                          <span className={cn(
                            "px-1 py-0 rounded-[3px] text-[7px] font-bold uppercase tracking-tight",
                            conn.type === 'turso' ? "bg-cyan-500/10 text-cyan-400" : "bg-muted text-muted-foreground"
                          )}>
                            {conn.type}
                          </span>
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
                        <div className="text-[10px] text-muted-foreground truncate font-mono mt-0.5 opacity-70">
                          {conn.type === 'turso' ? (conn.host || conn.path) : conn.path}
                        </div>
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
                          void handleRemoveConnection(conn);
                        }}
                        title="Remove"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-sm border border-dashed border-border/70 bg-background/60 p-6 text-center">
                  <Database size={22} className="mx-auto mb-2 text-muted-foreground/80" />
                  <p className="text-sm text-foreground">No saved connections yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create one on the right to start building your list.
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-md border border-border/70 bg-background/50 p-4">
              <div className="mb-4">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  New Connection
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Choose a database engine and provide details.
                </p>
              </div>

              <div className="mb-6">
                <Tabs value={type} onValueChange={(v) => setType(v as 'sqlite' | 'turso')}>
                  <TabsList className="grid w-full grid-cols-2 bg-background/80 border border-border/60">
                    <TabsTrigger value="sqlite" className="text-[10px] uppercase tracking-wider font-bold h-8">
                      <Database size={12} className="mr-2" />
                      SQLite
                    </TabsTrigger>
                    <TabsTrigger value="turso" className="text-[10px] uppercase tracking-wider font-bold h-8">
                      <Cloud size={12} className="mr-2" />
                      Turso
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid gap-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Connection Name
                  </Label>
                  <Input
                    id="name"
                    placeholder={type === 'sqlite' ? "My SQLite DB" : "My Turso DB"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-background border-border focus-visible:ring-primary h-11 transition-all focus:bg-background"
                  />
                </div>

                {type === 'turso' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="host" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Database URL
                      </Label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <Globe size={14} />
                        </div>
                        <Input
                          id="host"
                          placeholder="libsql://your-db.turso.io"
                          value={host}
                          onChange={(e) => {
                            setHost(e.target.value);
                            setError('');
                          }}
                          className="pl-9 bg-background border-border font-mono text-xs focus-visible:ring-primary h-11 transition-all focus:bg-background"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="authToken" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Auth Token
                      </Label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <Key size={14} />
                        </div>
                        <Input
                          id="authToken"
                          type="password"
                          placeholder="your-auth-token"
                          value={authToken}
                          onChange={(e) => {
                            setAuthToken(e.target.value);
                            setError('');
                          }}
                          className="pl-9 bg-background border-border font-mono text-xs focus-visible:ring-primary h-11 transition-all focus:bg-background"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="path" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {type === 'sqlite' ? 'Database File' : 'Local Path (Optional)'}
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      id="path"
                      placeholder={type === 'sqlite' ? "/path/to/database.db" : "/optional/local/path.db"}
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
                    {type === 'sqlite' && (
                      <Button
                        variant="outline"
                        onClick={handleCreateNew}
                        className="px-3 border-primary/30 text-primary hover:bg-primary/10 h-11 transition-colors group"
                        title="Create New Database"
                      >
                        <Plus size={18} className="group-hover:neon-text" />
                      </Button>
                    )}
                  </div>
                  {error && (
                    <p className="text-xs text-destructive font-medium mt-2 p-2 bg-destructive/10 rounded-sm border border-destructive/20 animate-fade-in">
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
                        className={`px-3 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all border ${
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
        </ScrollArea>

        <DialogFooter className="bg-secondary/50 p-4 border-t border-border flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:items-center flex-shrink-0">
          <Button
            variant="ghost"
            onClick={() => setShowConnectionDialog(false)}
            className="hover:bg-secondary text-muted-foreground w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={(!path.trim() && !host.trim()) || !tag}
            className="px-8 font-semibold tracking-wide w-full sm:w-auto"
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
