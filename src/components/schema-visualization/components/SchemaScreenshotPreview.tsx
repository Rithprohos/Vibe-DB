import { Copy, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { ScreenshotPreview } from '../lib/types';

interface SchemaScreenshotPreviewProps {
  copying: boolean;
  onClear: () => void;
  onCopy: () => void | Promise<void>;
  preview: ScreenshotPreview;
}

export function SchemaScreenshotPreview({
  copying,
  onClear,
  onCopy,
  preview,
}: SchemaScreenshotPreviewProps) {
  return (
    <div
      data-screenshot-exclude="true"
      className="pointer-events-none fixed bottom-16 right-5 z-[140]"
    >
      <div className="schema-screenshot-preview-card pointer-events-auto w-[300px] overflow-hidden rounded-lg border border-border/80 bg-card text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-border/60">
        <div className="schema-screenshot-preview-header relative border-b border-border/70 bg-secondary p-2">
          <img
            src={preview.objectUrl}
            alt="Schema screenshot preview"
            className="h-[150px] w-full rounded-md border border-border/70 bg-background object-cover"
          />
        </div>
        <div className="schema-screenshot-preview-body space-y-2 p-3 text-sm text-foreground">
          <div className="text-xs font-medium text-foreground">Schema Screenshot</div>
          <div className="text-[11px] text-muted-foreground">
            This preview stays in memory only. Copy it or close it when you are done.
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-8 flex-1 text-xs" onClick={onCopy} disabled={copying}>
              {copying ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Copy size={12} />
              )}
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={onClear}
              disabled={copying}
              aria-label="Close screenshot preview"
            >
              <X size={12} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
