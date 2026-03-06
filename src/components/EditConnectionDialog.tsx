import { useState, useEffect } from 'react';
import { useAppStore, type Connection } from '../store/useAppStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [error, setError] = useState('');

  useEffect(() => {
    if (connection && open) {
      setName(connection.name);
      setTag(connection.tag);
      setError('');
    }
  }, [connection, open]);

  const handleSave = () => {
    if (!connection) return;
    if (!name.trim()) return;
    if (!tag) {
      setError('Please select an environment label');
      return;
    }

    updateConnection(connection.id, {
      name: name.trim(),
      tag,
    });

    onOpenChange(false);
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
                  if (e.key === 'Enter') handleSave();
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

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Database Path
              </Label>
              <div className="text-[11px] text-muted-foreground font-mono p-2 bg-secondary/50 rounded-md border border-border/50 truncate">
                {connection.path}
              </div>
            </div>
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
            onClick={handleSave}
            disabled={!name.trim() || !tag}
            className="shadow-glow px-8 rounded-full font-semibold tracking-wide"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
