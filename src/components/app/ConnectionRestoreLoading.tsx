import { Cloud, Database, LoaderCircle, Server } from 'lucide-react';
import type { ConnectionProgressState } from '../../hooks/useAppConnectionManager';

function getConnectionProgressStepLabel(step: ConnectionProgressState['step']): string {
  switch (step) {
    case 'restoring':
      return 'Restoring previous session...';
    case 'loading-token':
      return 'Loading secure credentials...';
    case 'connecting':
      return 'Connecting to database...';
    case 'loading-schema':
      return 'Loading tables and metadata...';
    default:
      return 'Connecting...';
  }
}

interface ConnectionRestoreLoadingProps {
  startupCheckPending: boolean;
  progress: ConnectionProgressState | null;
}

export default function ConnectionRestoreLoading({
  startupCheckPending,
  progress,
}: ConnectionRestoreLoadingProps) {
  const title = progress
    ? progress.source === 'restore'
      ? `Restoring ${progress.connectionName}`
      : `Connecting to ${progress.connectionName}`
    : 'Restoring previous session';
  const subtitle = progress
    ? getConnectionProgressStepLabel(progress.step)
    : 'Checking saved connection...';
  const isTurso = progress?.connectionType === 'turso';
  const isPostgres = progress?.connectionType === 'postgres';

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8">
      <div className="w-full max-w-md rounded-md border border-border/70 bg-secondary/20 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-background text-primary">
            {isTurso ? <Cloud size={16} /> : isPostgres ? <Server size={16} /> : <Database size={16} />}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
          <LoaderCircle size={16} className="ml-auto animate-spin text-primary" />
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-sm border border-border bg-background">
          <div className="h-full w-1/2 animate-pulse bg-primary/70" />
        </div>
        {startupCheckPending && !progress && (
          <div className="mt-3 text-[11px] text-muted-foreground">Preparing workspace...</div>
        )}
      </div>
    </div>
  );
}
