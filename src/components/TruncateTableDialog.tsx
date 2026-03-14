import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { truncateTable } from '../lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface TruncateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  connectionId: string;
  engineType?: 'sqlite' | 'turso' | 'postgres';
  onSuccess?: () => void;
}

export default function TruncateTableDialog({
  open,
  onOpenChange,
  tableName,
  connectionId,
  engineType = 'sqlite',
  onSuccess,
}: TruncateTableDialogProps) {
  const [restartIdentity, setRestartIdentity] = useState(false);
  const [cascade, setCascade] = useState(false);
  const [isTruncating, setIsTruncating] = useState(false);
  const [error, setError] = useState('');

  const connection = useAppStore(s => s.connections.find(c => c.id === connectionId));
  const connId = connection?.connId;
  const isPostgres = engineType === 'postgres';

  useEffect(() => {
    if (!open) {
      setRestartIdentity(false);
      setCascade(false);
      setError('');
      setIsTruncating(false);
    }
  }, [open]);

  const handleClose = () => {
    if (isTruncating) return;
    onOpenChange(false);
  };

  const handleTruncate = async () => {
    if (!connId) {
      setError('No active connection');
      return;
    }

    setIsTruncating(true);
    setError('');

    try {
      const options = isPostgres
        ? {
            restartIdentity,
            cascade,
          }
        : undefined;

      await truncateTable(
        tableName,
        options,
        connId,
      );
      handleClose();
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to truncate table');
    } finally {
      setIsTruncating(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px] bg-card border-border/80 shadow-2xl shadow-black/20">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-destructive via-amber-500 to-destructive" />

        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-destructive/10 flex items-center justify-center border border-destructive/20">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight">
              Truncate Table
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Are you sure you want to truncate <code className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">{tableName}</code>?
            This will permanently delete <strong className="text-destructive">all rows</strong> in the table.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isPostgres && (
            <div className="space-y-3 rounded-md border border-border/50 bg-secondary/20 p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="restartIdentity"
                  checked={restartIdentity}
                  onCheckedChange={(checked) => setRestartIdentity(checked === true)}
                  className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <div className="flex flex-col gap-0.5">
                  <label
                    htmlFor="restartIdentity"
                    className="text-sm font-medium cursor-pointer select-none"
                  >
                    Restart identity
                  </label>
                  <span className="text-xs text-muted-foreground">
                    Reset auto-increment counters (RESTART IDENTITY)
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="cascade"
                  checked={cascade}
                  onCheckedChange={(checked) => setCascade(checked === true)}
                  className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <div className="flex flex-col gap-0.5">
                  <label
                    htmlFor="cascade"
                    className="text-sm font-medium cursor-pointer select-none"
                  >
                    Cascade
                  </label>
                  <span className="text-xs text-muted-foreground">
                    Also truncate tables referencing this one (CASCADE)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Warning note */}
          <div className="flex gap-2 text-xs text-amber-500/90 bg-amber-500/10 border border-amber-500/20 rounded-sm p-3">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">This action cannot be undone.</p>
              <p className="text-amber-500/70">
                {isPostgres
                  ? 'TRUNCATE is faster than DELETE but cannot be rolled back in some cases.'
                  : 'DELETE FROM will be used. Consider backing up your data first.'}
              </p>
            </div>
          </div>

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-sm p-3">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isTruncating}
            className="hover:bg-secondary text-muted-foreground h-9 text-xs font-bold uppercase tracking-wider rounded-sm"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleTruncate}
            disabled={isTruncating}
            className="h-9 text-xs font-bold uppercase tracking-wider rounded-sm gap-2"
          >
            <Trash2 size={14} />
            {isTruncating ? 'Truncating...' : 'Truncate Table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
