import { Database, Fingerprint, Hash, Key, Link2 } from 'lucide-react';
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';

import { splitQualifiedTableName } from '@/lib/databaseObjects';
import { cn } from '@/lib/utils';
import type { VisualizationPoint } from '@/store/useAppStore';

import { getRelationshipRowKey } from '../lib/helpers';
import type { VisualizedTable } from '../lib/types';
import { ConstraintDot } from './ConstraintDot';

interface SchemaTableCardProps {
  cardRef: (node: HTMLDivElement | null) => void;
  connectionType: string | undefined;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  position: VisualizationPoint;
  rowRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  table: VisualizedTable;
}

export function SchemaTableCard({
  cardRef,
  connectionType,
  onPointerDown,
  position,
  rowRefs,
  table,
}: SchemaTableCardProps) {
  const splitName = splitQualifiedTableName(table.qualifiedName);

  return (
    <div
      ref={cardRef}
      className="schema-table-card absolute w-[280px] select-none overflow-hidden rounded-sm border border-border/80 bg-card/95 backdrop-blur-[2px] transition-shadow duration-200"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        willChange: 'transform',
      }}
      onPointerDown={onPointerDown}
      onDragStart={(event) => event.preventDefault()}
    >
      <div className="flex items-center justify-between border-b border-border/70 bg-secondary px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Database size={13} className="text-muted-foreground" />
            <span className="truncate text-sm font-semibold text-foreground">
              {splitName.name}
            </span>
          </div>
          {table.schemaName && connectionType === 'postgres' && (
            <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
              {table.schemaName}
            </div>
          )}
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          {table.columns.length} cols
        </div>
      </div>

      <div className="divide-y divide-border/60 bg-card">
        {table.columns.map((column, columnIndex) => (
          <div
            key={`${table.qualifiedName}:${column.name}`}
            ref={(node) => {
              rowRefs.current[getRelationshipRowKey(table.qualifiedName, columnIndex)] = node;
            }}
            className={cn(
              'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 text-sm',
              column.isPrimaryKey
                ? 'bg-primary/[0.07]'
                : column.isForeignKey
                  ? 'bg-primary/[0.045]'
                  : '',
            )}
          >
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {column.isPrimaryKey ? (
                <Key size={11} className="text-primary" />
              ) : column.isForeignKey ? (
                <Link2 size={11} className="text-accent-secondary" />
              ) : null}
              <span
                className={cn(
                  'inline-flex items-center justify-center',
                  column.isNullable ? 'text-muted-foreground/70' : 'text-foreground/70',
                )}
              >
                <ConstraintDot filled={!column.isNullable} />
              </span>
              {column.isIdentity ? <Hash size={11} className="opacity-70" /> : null}
              {column.isUnique && !column.isPrimaryKey ? (
                <Fingerprint size={11} className="opacity-70" />
              ) : null}
            </div>
            <div className="min-w-0 truncate font-medium text-foreground">{column.name}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {column.typeLabel}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
