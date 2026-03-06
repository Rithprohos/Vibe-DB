import { shortcuts } from './constants';

export function KeybindingsSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-sm font-semibold text-foreground">Keyboard Shortcuts</h3>
        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.action}
              className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5"
            >
              <span className="text-sm text-muted-foreground">{shortcut.action}</span>
              <div className="flex gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={`${shortcut.action}-${key}`}
                    className="rounded border border-border bg-background px-2 py-0.5 text-[10px] font-mono text-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
