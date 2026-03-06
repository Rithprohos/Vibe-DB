import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const selectors = {
  toasts: (s: ReturnType<typeof useAppStore.getState>) => s.toasts,
  dismissToast: (s: ReturnType<typeof useAppStore.getState>) => s.dismissToast,
};

const toastStyles = {
  success: {
    icon: <CheckCircle2 size={14} />,
    className: 'border-primary/25 bg-card text-foreground shadow-xl shadow-black/10',
    iconClassName: 'text-primary',
  },
  error: {
    icon: <AlertCircle size={14} />,
    className: 'border-destructive/25 bg-card text-foreground shadow-xl shadow-black/10',
    iconClassName: 'text-destructive',
  },
  info: {
    icon: <Info size={14} />,
    className: 'border-info/25 bg-card text-foreground shadow-xl shadow-black/10',
    iconClassName: 'text-info',
  },
} as const;

export default function ToastViewport() {
  const toasts = useAppStore(selectors.toasts);
  const dismissToast = useAppStore(selectors.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, 1800)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts, dismissToast]);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => {
        const style = toastStyles[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-center gap-3 rounded-md border px-4 py-3 animate-in slide-in-from-top-2 fade-in duration-150',
              style.className
            )}
          >
            <div className={cn('shrink-0', style.iconClassName)}>{style.icon}</div>
            <div className="min-w-0 flex-1 text-sm font-medium">{toast.message}</div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => dismissToast(toast.id)}
            >
              <X size={12} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
