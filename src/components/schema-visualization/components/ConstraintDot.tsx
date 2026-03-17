import { cn } from '@/lib/utils';

export function ConstraintDot({ filled }: { filled: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rotate-45 border border-current',
        filled ? 'bg-current' : 'bg-transparent',
      )}
      aria-hidden="true"
    />
  );
}
