import { AlertCircle, ArrowUpCircle, RotateCcw } from 'lucide-react';

import type { GenerationState } from './types';

interface GenerationResultProps {
  generation: GenerationState;
  onRetry: () => void;
  onInsert: () => void;
}

export function GenerationResult({
  generation,
  onRetry,
  onInsert,
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
      <div className="mt-2 bg-secondary border border-accent-secondary/30 rounded p-2.5 text-accent-secondary flex flex-col gap-2">
        <div className="text-xs text-muted-foreground/50 font-sans flex justify-between items-center">
          <span>✦ generated</span>
        </div>
        <pre className="m-0 whitespace-pre-wrap text-accent-secondary text-sm">
          {generation.sql}
        </pre>
        <button
          onClick={onInsert}
          className="mt-1 w-full bg-accent/50 border border-accent-secondary/30 text-accent-secondary py-2 rounded-md cursor-pointer hover:bg-accent-secondary/20 transition-colors flex items-center justify-center gap-1.5 text-sm"
        >
          insert into editor
          <ArrowUpCircle size={12} />
        </button>
      </div>
    );
  }

  return null;
}
