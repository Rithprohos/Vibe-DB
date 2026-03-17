import { Camera, Database, Loader2, Minus, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface SchemaVisualizationToolbarProps {
  capturingScreenshot: boolean;
  captureDisabled: boolean;
  connectionType: string | undefined;
  onCapture: () => void;
  onResetView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  relationshipCount: number;
  schemaName: string | null | undefined;
  scopeLabel: string;
  tableCount: number;
  zoom: number;
}

export function SchemaVisualizationToolbar({
  capturingScreenshot,
  captureDisabled,
  connectionType,
  onCapture,
  onResetView,
  onZoomIn,
  onZoomOut,
  relationshipCount,
  schemaName,
  scopeLabel,
  tableCount,
  zoom,
}: SchemaVisualizationToolbarProps) {
  return (
    <div className="flex select-none items-center justify-between border-b border-border/60 bg-secondary/20 px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Database size={14} className="text-primary" />
          <span className="truncate">{scopeLabel}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          <span>{tableCount} tables</span>
          <span className="text-border">/</span>
          <span>{relationshipCount} links</span>
          <span className="text-border">/</span>
          <span>{zoom.toFixed(2)}x zoom</span>
          {connectionType === 'postgres' && (
            <>
              <span className="text-border">/</span>
              <span>{schemaName?.trim() || 'all schemas'}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-border/60 bg-background/60 px-2 text-xs"
          onClick={onCapture}
          disabled={captureDisabled}
        >
          {capturingScreenshot ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Camera size={12} />
          )}
          Capture
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-border/60 bg-background/60 px-2 text-xs"
          onClick={onZoomOut}
        >
          <Minus size={12} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-border/60 bg-background/60 px-2 text-xs"
          onClick={onZoomIn}
        >
          <Plus size={12} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-border/60 bg-background/60 px-2 text-xs"
          onClick={onResetView}
        >
          <RotateCcw size={12} />
          Reset View
        </Button>
      </div>
    </div>
  );
}
