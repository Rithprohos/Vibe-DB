import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { dropTable } from '../lib/db';
import { getGuidedMutationPolicy } from '../lib/queryGuard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DropTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  connectionId: string;
  onSuccess?: (tableName: string) => void;
}

export default function DropTableDialog({
  open,
  onOpenChange,
  tableName,
  connectionId,
  onSuccess,
}: DropTableDialogProps) {
  const [isDropping, setIsDropping] = useState(false);
  const [error, setError] = useState('');

  const connection = useAppStore(s => s.connections.find(c => c.id === connectionId));
  const showToast = useAppStore(s => s.showToast);
  const connId = connection?.connId;
  const dropPolicy = getGuidedMutationPolicy(connection?.tag, 'drop-table');

  useEffect(() => {
    if (!open) {
      setError('');
      setIsDropping(false);
    }
  }, [open]);

  const handleClose = () => {
    if (isDropping) return;
    onOpenChange(false);
  };

  const handleDrop = async () => {
    if (!connId) {
      setError('No active connection');
      return;
    }

    setIsDropping(true);
    setError('');

    try {
      await dropTable(tableName, connId);
      onOpenChange(false);
      onSuccess?.(tableName);
      showToast({
        type: 'success',
        message: `Dropped table ${tableName}`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to drop table';
      setError(message);
      showToast({
        type: 'error',
        message: 'Drop table failed',
      });
    } finally {
      setIsDropping(false);
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
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-destructive via-red-500 to-destructive" />

        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-destructive/10 flex items-center justify-center border border-destructive/20">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight">
              {dropPolicy.title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {dropPolicy.description} Are you sure you want to drop <code className="px-1.5 py-0.5 rounded bg-secondary text-xs font-mono">{tableName}</code>?
            This will permanently delete the table and <strong className="text-destructive">all its data</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning note */}
          <div className="flex gap-2 text-xs text-red-500/90 bg-red-500/10 border border-red-500/20 rounded-sm p-3">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">{dropPolicy.warning}</p>
              <p className="text-red-500/70">
                This action cannot be rolled back. Make sure you have a backup if needed.
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
            disabled={isDropping}
            className="hover:bg-secondary text-muted-foreground h-9 text-xs font-bold uppercase tracking-wider rounded-sm"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDrop}
            disabled={isDropping}
            className="h-9 text-xs font-bold uppercase tracking-wider rounded-sm gap-2"
          >
            <Trash2 size={14} />
            {isDropping ? 'Dropping...' : 'Drop Table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
