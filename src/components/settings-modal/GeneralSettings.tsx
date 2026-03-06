import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { MAX_ACTIVE_CONNECTIONS, MAX_RESULT_ROWS, useAppStore } from '@/store/useAppStore';

export function GeneralSettings() {
  const connections = useAppStore((state) => state.connections);
  const developerToolsEnabled = useAppStore((state) => state.developerToolsEnabled);
  const setDeveloperToolsEnabled = useAppStore((state) => state.setDeveloperToolsEnabled);
  const activeCount = useMemo(
    () => connections.filter((connection) => connection.connId).length,
    [connections],
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-sm font-semibold text-foreground">Connection Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3">
            <div>
              <div className="text-sm font-medium">Max Active Connections</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Limit concurrent database connections
              </div>
            </div>
            <div className="text-sm font-mono text-primary">{MAX_ACTIVE_CONNECTIONS}</div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3">
            <div>
              <div className="text-sm font-medium">Saved Connections</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Total connections in history
              </div>
            </div>
            <div className="text-sm font-mono text-primary">{connections.length}</div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3">
            <div>
              <div className="text-sm font-medium">Currently Active</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Active connections now</div>
            </div>
            <div className="text-sm font-mono text-primary">{activeCount}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold text-foreground">Query Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3">
            <div>
              <div className="text-sm font-medium">Max Result Rows</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Rows returned per query (auto-truncate)
              </div>
            </div>
            <div className="text-sm font-mono text-primary">{MAX_RESULT_ROWS}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold text-foreground">Advanced Utilities</h3>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-secondary/50 p-3">
          <div>
            <div className="text-sm font-medium">Enable Developer Tools</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Shows production-safe utilities like sample data generation behind an explicit opt-in.
            </div>
          </div>
          <Checkbox
            checked={developerToolsEnabled}
            onCheckedChange={(checked) => setDeveloperToolsEnabled(checked === true)}
            aria-label="Enable developer tools"
          />
        </div>
      </div>
    </div>
  );
}
