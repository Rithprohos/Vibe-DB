import { Diamond, Fingerprint, Hash, Key } from 'lucide-react';

import { ConstraintDot } from './ConstraintDot';

export function LegendBar() {
  return (
    <div className="flex items-center gap-5 border-b border-border/60 bg-card px-4 py-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Key size={11} className="text-primary" />
        Primary key
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Hash size={11} />
        Identity
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Fingerprint size={11} />
        Unique
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Diamond size={11} />
        Nullable
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ConstraintDot filled />
        Non-nullable
      </span>
    </div>
  );
}
