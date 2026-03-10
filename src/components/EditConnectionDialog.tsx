import { useState, useEffect } from 'react';
import { useAppStore, type Connection } from '../store/useAppStore';
import {
  clearStoredConnectionAuthToken,
  saveStoredConnectionAuthToken,
} from '../lib/connectionTokenStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil } from 'lucide-react';

interface EditConnectionDialogProps {
  connection: Connection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditConnectionDialog({ connection, open, onOpenChange }: EditConnectionDialogProps) {
  const updateConnection = useAppStore(s => s.updateConnection);

  const [name, setName] = useState('');
  const [tag, setTag] = useState<'local' | 'testing' | 'development' | 'production'>();
  const [host, setHost] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [tokenTouched, setTokenTouched] = useState(false);
  const [path, setPath] = useState('');
  const [port, setPort] = useState('5432');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [sslMode, setSslMode] = useState<'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full'>('prefer');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (connection && open) {
      setName(connection.name);
      setTag(connection.tag);
      setHost(connection.host || '');
      setAuthToken('');
      setTokenTouched(false);
      setPath(connection.path || '');
      setPort(connection.port?.toString() || '5432');
      setUsername(connection.username || '');
      setPassword('');
      setDatabase(connection.database || '');
      setSslMode(connection.sslMode || 'prefer');
      setError('');
      setIsSaving(false);
    }
  }, [connection, open]);

  const handleSave = async () => {
    if (!connection) return;
    if (!name.trim()) return;
    if (isSaving) return;
    if (!tag) {
      setError('Please select an environment label');
      return;
    }

    setIsSaving(true);

    const trimmedHost = host.trim();
    const trimmedPath = path.trim();

    let hasAuthToken = Boolean(connection.hasAuthToken);
    const isRemoteTurso = connection.type === 'turso' && Boolean(trimmedHost);

    try {
      if (connection.type === 'turso') {
        if (!isRemoteTurso) {
          await clearStoredConnectionAuthToken(connection.id);
          hasAuthToken = false;
        } else if (tokenTouched) {
          const nextToken = authToken.trim();
          if (nextToken) {
            await saveStoredConnectionAuthToken(connection.id, nextToken);
            hasAuthToken = true;
          } else {
            await clearStoredConnectionAuthToken(connection.id);
            hasAuthToken = false;
          }
        }
      }

      updateConnection(connection.id, {
        name: name.trim(),
        tag,
        host: connection.type !== 'sqlite' ? (trimmedHost || undefined) : undefined,
        authToken: undefined,
        hasAuthToken: connection.type === 'turso' ? hasAuthToken : undefined,
        path: trimmedPath || undefined,
        port: connection.type === 'postgres' ? (parseInt(port, 10) || 5432) : undefined,
        username: connection.type === 'postgres' ? (username.trim() || undefined) : undefined,
        password: connection.type === 'postgres' && password.trim() ? password.trim() : undefined,
        hasPassword: connection.type === 'postgres' ? Boolean(password.trim() || connection.hasPassword) : undefined,
        database: connection.type === 'postgres' ? (database.trim() || undefined) : undefined,
        sslMode: connection.type === 'postgres' ? sslMode : undefined,
      });

      onOpenChange(false);
    } catch (e: any) {
      setError(`Failed to update secure token: ${e}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!connection) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border shadow-xl shadow-black/5 dark:shadow-2xl dark:shadow-black/40 p-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-secondary via-primary to-accent-secondary" />

        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center space-x-2 text-lg font-bold tracking-tight">
              <Pencil size={18} className="text-primary" />
              <span>Edit Connection</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              Update connection name and environment label.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Connection Name
              </Label>
              <Input
                id="edit-name"
                placeholder="My Database"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background border-border focus-visible:ring-primary h-10 transition-all"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleSave();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Environment Label
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
              {error && (
                <p className="text-[11px] text-destructive">{error}</p>
              )}
            </div>

            {connection.type === 'turso' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-host" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Database URL
                  </Label>
                  <Input
                    id="edit-host"
                    placeholder="libsql://your-db.turso.io"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="bg-background border-border focus-visible:ring-primary h-10 transition-all font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-token" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Auth Token
                  </Label>
                  <Input
                    id="edit-token"
                    type="password"
                    placeholder={
                      connection.hasAuthToken
                        ? 'Saved token present (enter to replace)'
                        : 'your-auth-token'
                    }
                    value={authToken}
                    onChange={(e) => {
                      setAuthToken(e.target.value);
                      setTokenTouched(true);
                    }}
                    className="bg-background border-border focus-visible:ring-primary h-10 transition-all font-mono text-xs"
                  />
                  {connection.hasAuthToken && !tokenTouched && (
                    <p className="text-[11px] text-muted-foreground">
                      Leave unchanged to keep the existing saved token.
                    </p>
                  )}
                </div>
              </>
            )}

            {connection.type === 'postgres' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-host" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Host
                  </Label>
                  <Input
                    id="edit-host"
                    placeholder="localhost"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="bg-background border-border focus-visible:ring-primary h-10 transition-all font-mono text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-port" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Port
                    </Label>
                    <Input
                      id="edit-port"
                      placeholder="5432"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className="bg-background border-border focus-visible:ring-primary h-10 transition-all font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-database" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Database
                    </Label>
                    <Input
                      id="edit-database"
                      placeholder="postgres"
                      value={database}
                      onChange={(e) => setDatabase(e.target.value)}
                      className="bg-background border-border focus-visible:ring-primary h-10 transition-all font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-username" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Username
                  </Label>
                  <Input
                    id="edit-username"
                    placeholder="postgres"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-background border-border focus-visible:ring-primary h-10 transition-all font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Password
                  </Label>
                  <Input
                    id="edit-password"
                    type="password"
                    placeholder={
                      connection.hasPassword
                        ? 'Saved password present (enter to replace)'
                        : 'your-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-background border-border focus-visible:ring-primary h-10 transition-all font-mono text-xs"
                  />
                  {connection.hasPassword && !password && (
                    <p className="text-[11px] text-muted-foreground">
                      Leave unchanged to keep the existing saved password.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-sslmode" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    SSL Mode
                  </Label>
                  <Select value={sslMode} onValueChange={(v) => setSslMode(v as typeof sslMode)}>
                    <SelectTrigger className="bg-background border-border h-10 text-xs">
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
                </div>
              </>
            )}

            {connection.type !== 'postgres' && (
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {connection.type === 'turso' ? 'Local Path (Secondary)' : 'Database Path'}
              </Label>
              {connection.type === 'sqlite' ? (
                <div className="text-[11px] text-muted-foreground font-mono p-2 bg-secondary/50 rounded-md border border-border/50 truncate">
                  {connection.path}
                </div>
              ) : (
                <Input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/optional/local/path.db"
                  className="bg-background border-border focus-visible:ring-primary h-10 transition-all font-mono text-xs"
                />
              )}
            </div>
            )}
          </div>
        </div>

        <DialogFooter className="bg-secondary/50 p-4 border-t border-border flex sm:justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="hover:bg-secondary text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!name.trim() || !tag || isSaving}
            className="shadow-glow px-8 rounded-full font-semibold tracking-wide"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
