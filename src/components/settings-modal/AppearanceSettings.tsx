import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { themeOptions } from './constants';

export function AppearanceSettings() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-sm font-semibold text-foreground">Theme</h3>
        <div className="space-y-2">
          {themeOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setTheme(option.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
                theme === option.id
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-border bg-secondary/30 hover:border-primary/20 hover:bg-secondary/50',
              )}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                style={{
                  backgroundColor: option.color,
                  borderColor: theme === option.id ? 'var(--accent-primary)' : 'var(--border)',
                }}
              >
                <span className={cn(option.iconClass ?? 'text-primary')}>{option.icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{option.name}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
              {theme === option.id ? <div className="h-2 w-2 rounded-full bg-primary" /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
