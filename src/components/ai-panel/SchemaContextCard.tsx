import type { SchemaTable } from '@/lib/db';

interface SchemaContextCardProps {
  schema: SchemaTable | null;
}

export function SchemaContextCard({ schema }: SchemaContextCardProps) {
  return (
    <div className="p-3 border-b border-border/50">
      <div className="text-xs text-muted-foreground mb-1.5 tracking-wider font-sans">CURRENT TABLE</div>
      <div className="bg-secondary rounded-md p-2.5 text-sm text-muted-foreground leading-relaxed max-h-[120px] overflow-auto border border-border">
        {schema ? (
          <div>
            <div className="text-accent-secondary text-sm font-medium">{schema.name}</div>
            {schema.columns.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground/70">
                {schema.columns.length} columns
                {schema.columns.some((column) => column.isPk) && (
                  <span className="ml-2 text-accent-secondary">
                    ({schema.columns.filter((column) => column.isPk).length} PK)
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs italic">No table selected</div>
        )}
      </div>
    </div>
  );
}
