import { useCallback, useRef, useEffect } from 'react';
import { useAppStore, type AlertType } from '../store/useAppStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertStyles: Record<AlertType, { icon: React.ReactNode; colorClass: string; borderClass: string }> = {
  success: {
    icon: <CheckCircle className="text-primary" size={20} />,
    colorClass: 'text-primary',
    borderClass: 'border-primary/30',
  },
  error: {
    icon: <AlertCircle className="text-destructive" size={20} />,
    colorClass: 'text-destructive',
    borderClass: 'border-destructive/30',
  },
  warning: {
    icon: <AlertTriangle className="text-warning" size={20} />,
    colorClass: 'text-warning',
    borderClass: 'border-warning/30',
  },
  info: {
    icon: <Info className="text-info" size={20} />,
    colorClass: 'text-info',
    borderClass: 'border-info/30',
  },
};

export default function AlertModal() {
  const alertOptions = useAppStore(s => s.alertOptions);
  const hideAlert = useAppStore(s => s.hideAlert);

  const onConfirmRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (alertOptions?.onConfirm) {
      onConfirmRef.current = alertOptions.onConfirm;
    } else {
      onConfirmRef.current = undefined;
    }
  }, [alertOptions?.onConfirm]);

  const handleConfirm = useCallback(() => {
    onConfirmRef.current?.();
    hideAlert();
  }, [hideAlert]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      hideAlert();
    }
  }, [hideAlert]);

  if (!alertOptions) return null;

  const { title, message, type = 'info', confirmText = 'OK' } = alertOptions;
  const style = alertStyles[type];

  return (
    <Dialog open={true} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border shadow-xl shadow-black/5 dark:shadow-2xl dark:shadow-black/40 p-0 overflow-hidden">
        <div className={cn("absolute top-0 left-0 w-full h-1", style.borderClass.replace('border', 'bg'))} />
        
        <div className="p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/50", style.borderClass, "border")}>
                {style.icon}
              </div>
              <DialogTitle className="text-base font-semibold text-foreground">
                {title}
              </DialogTitle>
            </div>
          </DialogHeader>

          {message && (
            <DialogDescription className="text-sm text-muted-foreground mb-6">
              {message}
            </DialogDescription>
          )}
        </div>

        <DialogFooter className="bg-secondary/30 p-4 border-t border-border">
          <Button
            onClick={handleConfirm}
            className={cn(
              "px-6 font-medium",
              type === 'error' && "bg-destructive hover:bg-destructive/90",
              type === 'success' && "shadow-glow"
            )}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}