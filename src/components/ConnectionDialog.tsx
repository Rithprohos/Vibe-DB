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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, FolderOpen, Plus, X, Clock, Pencil, Globe, Key, Cloud, Server } from 'lucide-react';
import EditConnectionDialog from './EditConnectionDialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PostgresSslMode = 'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';

interface ParsedPostgresUrl {
  host: string;
  port: number;
  username: string;
  password?: string;
  database?: string;
  sslMode?: PostgresSslMode;
}

function parsePostgresConnectionUrl(raw: string): { value?: ParsedPostgresUrl; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: 'Please provide a PostgreSQL connection URL' };
  }

  const normalized = /^postgres(ql)?:\/\//i.test(trimmed)
    ? trimmed
    : `postgresql://${trimmed}`;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return {
      error:
        'Invalid PostgreSQL URL format. Example: postgresql://user:pass@host:5432/dbname?sslmode=prefer',
    };
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    return { error: 'URL must start with postgres:// or postgresql://' };
  }

  const host = url.hostname.trim();
  const username = decodeURIComponent(url.username ?? '').trim();
  const port = url.port ? Number.parseInt(url.port, 10) : 5432;
  const database = url.pathname.replace(/^\/+/, '').trim() || undefined;
  const password = url.password ? decodeURIComponent(url.password) : undefined;

  if (!host) {
    return { error: 'PostgreSQL URL is missing host' };
  }
  if (!username) {
    return { error: 'PostgreSQL URL is missing username' };
  }
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    return { error: 'PostgreSQL URL has an invalid port (must be 1-65535)' };
  }

  const sslModeRaw = url.searchParams.get('sslmode')?.toLowerCase();
  const allowedSslModes: PostgresSslMode[] = ['disable', 'prefer', 'require', 'verify-ca', 'verify-full'];
  if (sslModeRaw && !allowedSslModes.includes(sslModeRaw as PostgresSslMode)) {
    return { error: "Invalid sslmode in URL. Use disable, prefer, require, verify-ca, or verify-full." };
  }

  return {
    value: {
      host,
      port,
      username,
      password,
      database,
      sslMode: sslModeRaw as PostgresSslMode | undefined,
    },
  };
}

function getConnectionLocation(conn: Connection): string {
  if (conn.type === 'turso') return conn.host || conn.path || '';
  if (conn.type === 'postgres') return `${conn.host || ''}:${conn.port || 5432}`;
  return conn.path || '';
}

function truncateMiddle(value: string, maxLength = 52): string {
  if (value.length <= maxLength) return value;
  const leftLength = Math.ceil((maxLength - 1) * 0.6);
  const rightLength = Math.floor((maxLength - 1) * 0.4);
  return `${value.slice(0, leftLength)}…${value.slice(-rightLength)}`;
}

export default function ConnectionDialog() {
  const showConnectionDialog = useAppStore(s => s.showConnectionDialog);
  const setShowConnectionDialog = useAppStore(s => s.setShowConnectionDialog);
  const connections = useAppStore(s => s.connections);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const removeConnection = useAppStore(s => s.removeConnection);
  const activeConnection = connections.find(c => c.id === activeSidebarConnectionId);
  const activeConnectionsCount = connections.filter(c => c.connId).length;

  const [type, setType] = useState<'sqlite' | 'turso' | 'postgres'>('sqlite');
  const [activeTab, setActiveTab] = useState<'recent' | 'new'>('new');
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [host, setHost] = useState('');
  const [authToken, setAuthToken] = useState('');
  // PostgreSQL-specific fields
  const [port, setPort] = useState('5432');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [sslMode, setSslMode] = useState<'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full'>('prefer');
  const [postgresInputMode, setPostgresInputMode] = useState<'fields' | 'url'>('fields');
  const [postgresUrl, setPostgresUrl] = useState('');
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
    let resolvedHost = host.trim();
    let resolvedPort = parseInt(port, 10) || 5432;
    let resolvedUsername = username.trim();
    let resolvedPassword = password.trim();
    let resolvedDatabase = database.trim();
    let resolvedSslMode: PostgresSslMode = sslMode;

    if (type === 'sqlite' && !path.trim()) {
      setError('Please provide a database path');
      return;
    }
    if (type === 'turso' && (!host.trim() && !path.trim())) {
      setError('Please provide either a database URL or a local file path');
      return;
    }
    if (type === 'postgres') {
      if (postgresInputMode === 'url') {
        const parsed = parsePostgresConnectionUrl(postgresUrl);
        if (parsed.error || !parsed.value) {
          setError(parsed.error || 'Invalid PostgreSQL URL');
          return;
        }
        resolvedHost = parsed.value.host;
        resolvedPort = parsed.value.port;
        resolvedUsername = parsed.value.username;
        resolvedPassword = parsed.value.password?.trim() || '';
        resolvedDatabase = parsed.value.database?.trim() || '';
        resolvedSslMode = parsed.value.sslMode || sslMode;
      }

      if (!resolvedHost || !resolvedUsername) {
        setError('Please provide host and username for PostgreSQL connection');
        return;
      }
    }
    if (!tag) {
      setError('Please select an environment label');
      return;
    }

    if (activeConnectionsCount >= MAX_ACTIVE_CONNECTIONS) {
      setError(`Maximum ${MAX_ACTIVE_CONNECTIONS} active connections allowed. Close one first.`);
      return;
    }

    const defaultNameSource = type === 'sqlite'
      ? path.split('/').pop()
      : type === 'postgres'
      ? resolvedHost
      : host.split('/').pop();

    const conn: Connection = {
      id: `conn-${Date.now()}`,
      name: name || defaultNameSource || 'Database',
      path: path.trim() || undefined,
      host: type === 'postgres' ? resolvedHost || undefined : host.trim() || undefined,
      port: type === 'postgres' ? resolvedPort : undefined,
      username: type === 'postgres' ? resolvedUsername : undefined,
      hasPassword: type === 'postgres' ? Boolean(resolvedPassword) : undefined,
      password: type === 'postgres' ? resolvedPassword || undefined : undefined,
      database: type === 'postgres' ? resolvedDatabase || undefined : undefined,
      sslMode: type === 'postgres' ? resolvedSslMode : undefined,
      hasAuthToken: type === 'turso' ? Boolean(authToken.trim()) : undefined,
      authToken: type === 'turso' ? authToken.trim() || undefined : undefined,
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
        
        <div className="p-6 pb-2 flex-shrink-0 border-b border-border/40 bg-secondary/20">
          <DialogHeader className="mb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center space-x-3 text-2xl font-black tracking-tight uppercase">
                  <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(0,229,153,0.1)]">
                    {type === 'sqlite' ? <Database className="text-primary h-6 w-6" /> : type === 'turso' ? <Cloud className="text-primary h-6 w-6" /> : <Server className="text-primary h-6 w-6" />}
                  </div>
                  <span>{type === 'sqlite' ? 'Local SQLite' : type === 'turso' ? 'Turso Cloud' : 'PostgreSQL Server'}</span>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-1 text-[11px] font-bold opacity-60 uppercase tracking-[0.2em]">
                  {type === 'sqlite'
                    ? 'Connect to a persistent local database file'
                    : type === 'turso'
                    ? 'Managed libSQL via edge cloud infrastructure'
                    : 'External relational database instance'}
                </DialogDescription>
              </div>

              {/* Mobile View Toggle */}
              <div className="lg:hidden flex p-1 bg-background/50 rounded-sm border border-border/60 self-start sm:self-center backdrop-blur-sm">
                <button
                  onClick={() => setActiveTab('recent')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase transition-all rounded-[2px]",
                    activeTab === 'recent' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Clock size={12} />
                  Saved
                </button>
                <button
                  onClick={() => setActiveTab('new')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold uppercase transition-all rounded-[2px]",
                    activeTab === 'new' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Plus size={12} />
                  New
                </button>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Sidebar / Saved Connections */}
          <aside className={cn(
            "w-full lg:w-[248px] lg:flex-none lg:shrink-0 lg:border-r border-border/40 bg-secondary/10 flex flex-col min-w-0 transition-all",
            activeTab !== 'recent' && "hidden lg:flex"
          )}>
            <div className="px-4 py-2.5 border-b border-border/40 flex items-center justify-between bg-background/20 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-3 bg-primary rounded-full" />
                <span className="text-[11px] font-black text-foreground uppercase tracking-[0.15em]">
                  Saved Library
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold text-muted-foreground bg-background/80 px-2 py-0.5 rounded-sm border border-border/40 min-w-[20px] text-center">
                {recentConnections.length}
              </span>
            </div>
            
            <ScrollArea className="flex-1 overflow-x-hidden">
              <div className="w-full min-w-0 p-2 flex flex-col items-center gap-1.5">
                {recentConnections.length > 0 ? (
                  recentConnections.map((conn) => {
                    const fullLocation = getConnectionLocation(conn);
                    const displayLocation = truncateMiddle(fullLocation);

                    return (
                      <div
                        key={conn.id}
                        className="group relative w-full lg:w-[216px] lg:max-w-[216px] min-w-0 flex flex-col gap-1 p-2 rounded-sm bg-background/40 border border-border/40 cursor-pointer hover:border-primary/50 hover:bg-secondary/40 transition-all overflow-hidden"
                        onClick={() => handleSwitchTo(conn)}
                      >
                      {/* Accent Strip */}
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-0.5 transition-all opacity-0 group-hover:opacity-100",
                        conn.tag === 'production' ? "bg-red-500" : "bg-primary"
                      )} />
                      
                      <div className="flex items-center min-w-0 pr-12">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="text-[12px] font-bold text-foreground truncate pr-1">{conn.name}</div>
                          <span className={cn(
                            "px-1 py-0.5 rounded-[2px] text-[7px] font-black uppercase tracking-widest flex-shrink-0",
                            conn.type === 'turso' ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : 
                            conn.type === 'postgres' ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : 
                            "bg-muted/50 text-muted-foreground border border-border/40"
                          )}>
                            {conn.type}
                          </span>
                        </div>
                      </div>

                      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 bg-background/60 backdrop-blur-sm pl-0.5 rounded-sm sm:opacity-20 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1 rounded-[2px] hover:bg-primary/20 hover:text-primary transition-colors"
                          onClick={(e) => { e.stopPropagation(); setEditingConnection(conn); }}
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          className="p-1 rounded-[2px] hover:bg-destructive/10 hover:text-destructive transition-colors"
                          onClick={(e) => { e.stopPropagation(); void handleRemoveConnection(conn); }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                      
                      <div
                        className="w-full min-w-0 overflow-hidden whitespace-nowrap text-[9px] text-muted-foreground font-mono opacity-60 leading-tight pr-12"
                        title={fullLocation}
                      >
                        {displayLocation}
                      </div>

                      <div className="flex items-center mt-0.5">
                        {conn.tag && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-[2px] text-[7px] font-bold uppercase tracking-widest border transition-colors",
                            conn.tag === 'production'
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-primary/5 text-primary/60 border-primary/20"
                          )}>
                            {conn.tag}
                          </span>
                        )}
                      </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 px-4 text-center">
                    <Database size={24} className="mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">No connections</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* Main Content Area */}
          <main className={cn(
            "flex-1 flex flex-col min-h-0 bg-background/50",
            activeTab !== 'new' && "hidden lg:flex"
          )}>
            <ScrollArea className="flex-1">
              <div className="p-6 lg:p-10 max-w-[600px] mx-auto w-full">
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus size={14} className="text-primary" />
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-foreground">
                      New Entry
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Configure your database engine and credentials below. All fields are validated in real-time.
                  </p>
                </div>

              <div className="mb-6">
                <Tabs value={type} onValueChange={(v) => setType(v as 'sqlite' | 'turso' | 'postgres')}>
                  <TabsList className="grid w-full grid-cols-3 h-9 p-0.5 bg-secondary/20 border border-border/60">
                    <TabsTrigger
                      value="sqlite"
                      className="h-8 rounded-[2px] border border-transparent text-[10px] uppercase tracking-wider font-bold text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                      <Database size={12} className="mr-2" />
                      SQLite
                    </TabsTrigger>
                    <TabsTrigger
                      value="turso"
                      className="h-8 rounded-[2px] border border-transparent text-[10px] uppercase tracking-wider font-bold text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                      <Cloud size={12} className="mr-2" />
                      Turso
                    </TabsTrigger>
                    <TabsTrigger
                      value="postgres"
                      className="h-8 rounded-[2px] border border-transparent text-[10px] uppercase tracking-wider font-bold text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                      <Server size={12} className="mr-2" />
                      PostgreSQL
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
                    placeholder={type === 'sqlite' ? "My SQLite DB" : type === 'turso' ? "My Turso DB" : "My PostgreSQL DB"}
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

                {type === 'postgres' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Connection Input
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setPostgresInputMode('fields');
                            setError('');
                          }}
                          className={cn(
                            'h-9 rounded-sm border text-[10px] font-bold uppercase tracking-wider transition-colors',
                            postgresInputMode === 'fields'
                              ? 'border-primary text-primary bg-primary/10'
                              : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                          )}
                        >
                          Host & Fields
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPostgresInputMode('url');
                            setError('');
                          }}
                          className={cn(
                            'h-9 rounded-sm border text-[10px] font-bold uppercase tracking-wider transition-colors',
                            postgresInputMode === 'url'
                              ? 'border-primary text-primary bg-primary/10'
                              : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                          )}
                        >
                          Full URL
                        </button>
                      </div>
                    </div>

                    {postgresInputMode === 'url' ? (
                      <div className="space-y-2">
                        <Label htmlFor="postgresUrl" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          PostgreSQL URL <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            <Globe size={14} />
                          </div>
                          <Input
                            id="postgresUrl"
                            placeholder="postgresql://user:pass@host:5432/dbname?sslmode=prefer"
                            value={postgresUrl}
                            onChange={(e) => {
                              setPostgresUrl(e.target.value);
                              setError('');
                            }}
                            className="pl-9 bg-background border-border font-mono text-xs focus-visible:ring-primary h-11 transition-all focus:bg-background"
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          URL is parsed into host, port, username, password, database, and sslmode.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="host" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Host <span className="text-destructive">*</span>
                          </Label>
                          <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              <Globe size={14} />
                            </div>
                            <Input
                              id="host"
                              placeholder="localhost or db.example.com"
                              value={host}
                              onChange={(e) => {
                                setHost(e.target.value);
                                setError('');
                              }}
                              className="pl-9 bg-background border-border font-mono text-xs focus-visible:ring-primary h-11 transition-all focus:bg-background"
                            />
                          </div>
                          {host.includes('://') && (
                            <p className="text-[10px] text-amber-400">
                              This looks like a full URL. Switch to "Full URL" input for PostgreSQL URL parsing.
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="port" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Port
                            </Label>
                            <Input
                              id="port"
                              placeholder="5432"
                              value={port}
                              onChange={(e) => setPort(e.target.value)}
                              className="bg-background border-border font-mono text-xs focus-visible:ring-primary h-11 transition-all focus:bg-background"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="database" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Database
                            </Label>
                            <Input
                              id="database"
                              placeholder="postgres"
                              value={database}
                              onChange={(e) => setDatabase(e.target.value)}
                              className="bg-background border-border font-mono text-xs focus-visible:ring-primary h-11 transition-all focus:bg-background"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="username" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Username <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="username"
                            placeholder="postgres"
                            value={username}
                            onChange={(e) => {
                              setUsername(e.target.value);
                              setError('');
                            }}
                            className="bg-background border-border font-mono text-xs focus-visible:ring-primary h-11 transition-all focus:bg-background"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Password
                          </Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-background border-border font-mono text-xs focus-visible:ring-primary h-11 transition-all focus:bg-background"
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="sslMode" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        SSL Mode
                      </Label>
                      <Select value={sslMode} onValueChange={(v) => setSslMode(v as typeof sslMode)}>
                        <SelectTrigger className="bg-background border-border h-11 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="disable">Disable</SelectItem>
                          <SelectItem value="prefer">Prefer (default)</SelectItem>
                          <SelectItem value="require">Require</SelectItem>
                          <SelectItem value="verify-ca">Verify CA</SelectItem>
                          <SelectItem value="verify-full">Verify Full</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        {sslMode === 'disable' && 'No SSL connection.'}
                        {sslMode === 'prefer' && 'Try SSL first, fallback to non-SSL.'}
                        {sslMode === 'require' && 'SSL required but skip certificate verification.'}
                        {sslMode === 'verify-ca' && 'SSL required with CA certificate verification.'}
                        {sslMode === 'verify-full' && 'SSL required with full certificate verification (hostname + CA).'}
                      </p>
                    </div>
                  </>
                )}

                {type !== 'postgres' && (
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
                )}

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
              </div>
            </ScrollArea>
          </main>
        </div>

        <DialogFooter className="bg-secondary/30 p-4 border-t border-border/60 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:items-center flex-shrink-0">
          <div className="hidden sm:block">
            {error && (
              <p className="text-[10px] text-destructive font-bold uppercase tracking-tight flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
            <Button
              variant="ghost"
              onClick={() => setShowConnectionDialog(false)}
              className="hover:bg-secondary text-muted-foreground h-9 text-xs font-bold uppercase tracking-wider rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={
                (type === 'postgres'
                  ? (postgresInputMode === 'url' ? !postgresUrl.trim() : !host.trim() || !username.trim())
                  : !path.trim() && !host.trim()) || !tag
              }
              className="px-8 h-9 text-xs font-bold uppercase tracking-wider rounded-sm glow-shadow"
            >
              Connect to Database
            </Button>
          </div>
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
