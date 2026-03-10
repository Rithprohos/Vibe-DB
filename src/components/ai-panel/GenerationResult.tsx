import { AlertCircle, ArrowUpCircle, Copy, RotateCcw } from 'lucide-react';

import type { GenerationState } from './types';

interface GenerationResultProps {
  generation: GenerationState;
  onRetry: () => void;
  onInsert: () => void;
  onCopy: () => void;
}

export function GenerationResult({
  generation,
  onRetry,
  onInsert,
  onCopy,
}: GenerationResultProps) {
  if (generation.type === 'error') {
    return (
      <div className="mt-2 bg-destructive/10 border border-destructive/30 rounded p-2.5 flex flex-col gap-2">
        <div className="text-xs text-destructive font-sans flex items-center gap-1">
          <AlertCircle size={10} />
          <span>Generation failed</span>
        </div>
        <p className="text-sm text-destructive/80 font-sans leading-relaxed">
          {generation.error}
        </p>
        <button
          onClick={onRetry}
          className="w-full bg-destructive/20 border border-destructive/30 text-destructive py-2 rounded-md cursor-pointer hover:bg-destructive/30 transition-colors flex items-center justify-center gap-1.5 text-sm"
        >
          <RotateCcw size={12} />
          Retry
        </button>
      </div>
    );
  }

  if (generation.type === 'success' && generation.sql) {
    return (
      <div className="mt-2 border border-accent-secondary/25 bg-secondary/70 p-2.5 text-accent-secondary flex flex-col gap-2 rounded-md">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 font-sans flex justify-between items-center">
          <span>✦ generated</span>
        </div>
        <pre className="m-0 whitespace-pre-wrap text-accent-secondary text-sm leading-relaxed">
          {generation.sql}
        </pre>
        <div className="mt-1 flex items-center justify-end gap-1.5 border-t border-border/40 pt-2">
          <button
            onClick={onCopy}
            className="h-7 px-2.5 bg-background/40 border border-border/50 text-muted-foreground cursor-pointer hover:bg-background/60 hover:text-foreground transition-colors flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wide rounded-sm"
          >
            <Copy size={12} />
            Copy SQL
          </button>
          <button
            onClick={onInsert}
            className="h-7 px-2.5 bg-accent/35 border border-accent-secondary/30 text-accent-secondary cursor-pointer hover:bg-accent-secondary/20 transition-colors flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wide rounded-sm"
          >
            <ArrowUpCircle size={12} />
            Insert
          </button>
        </div>
      </div>
    );
  }

  return null;
}
