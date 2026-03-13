import { Plus, Sparkles } from 'lucide-react';
import { highlightSQL } from '../../lib/highlightSQL';
import type {
  ColumnDef,
  SupportedEngine,
} from '../../lib/createTableConstants';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ColumnRow } from './ColumnRow';

interface ColumnsSectionProps {
  columns: ColumnDef[];
  engineType: SupportedEngine;
  engineDataTypes: ReadonlyArray<{
    value: string;
    label: string;
    color: string;
    supportsParams?: boolean;
    paramType?: 'length' | 'precision-scale' | 'precision';
  }>;
  engineTypeLabel: string;
  liveColumnNameErrors: Record<string, string>;
  showPreview: boolean;
  sql: string;
  previewHint: string;
  onTogglePreview: () => void;
  onAddColumn: () => void;
  onUpdateColumn: (id: string, updates: Partial<ColumnDef>) => void;
  onRemoveColumn: (id: string) => void;
  onMovePk: (targetId: string) => void;
}

export function ColumnsSection({
  columns,
  engineType,
  engineDataTypes,
  engineTypeLabel,
  liveColumnNameErrors,
  showPreview,
  sql,
  previewHint,
  onTogglePreview,
  onAddColumn,
  onUpdateColumn,
  onRemoveColumn,
  onMovePk,
}: ColumnsSectionProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Columns
          </span>
          <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px] font-mono border border-border text-muted-foreground">
            {columns.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onTogglePreview}
            className="border-border/50 bg-background/50 hover:bg-accent/50 text-xs gap-1.5"
          >
            <Sparkles size={13} />
            {showPreview ? 'Hide' : 'Preview'} SQL
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddColumn}
            className="border-border/50 bg-background/50 hover:bg-accent/50 text-xs gap-1.5"
          >
            <Plus size={13} />
            Add Column
          </Button>
        </div>
      </div>

      {showPreview && (
        <div className="mb-4 rounded-md border border-border bg-surface/[0.3] overflow-hidden glass-panel animate-in fade-in-0 duration-200">
          <div className="px-4 py-2 bg-secondary/40 border-b border-border/50">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Generated SQL
            </span>
          </div>
          {sql ? (
            <pre className="p-4 text-[13px] font-mono leading-relaxed overflow-x-auto custom-scrollbar-hide whitespace-pre select-text">
              <code>{highlightSQL(sql)}</code>
            </pre>
          ) : (
            <div className="p-4 text-xs text-muted-foreground/60 italic">
              {previewHint}
            </div>
          )}
        </div>
      )}

      <div className="rounded-md border border-border bg-surface/[0.3] overflow-hidden glass-panel panel-shadow">
        <Table className="w-full text-left">
          <TableHeader className="bg-secondary/40 sticky top-0 backdrop-blur-md border-b border-border/50">
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-[40px] py-3 pl-3" />
              <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-foreground min-w-[180px]">
                Column Name
              </TableHead>
              <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-foreground min-w-[140px]">
                Data Type
              </TableHead>
              <TableHead className="w-[60px] font-semibold uppercase tracking-wider text-[10px] text-foreground text-center">
                PK
              </TableHead>
              <TableHead className="w-[60px] font-semibold uppercase tracking-wider text-[10px] text-foreground text-center">
                AI
              </TableHead>
              <TableHead className="w-[60px] font-semibold uppercase tracking-wider text-[10px] text-foreground text-center">
                NN
              </TableHead>
              <TableHead className="w-[60px] font-semibold uppercase tracking-wider text-[10px] text-foreground text-center">
                UQ
              </TableHead>
              <TableHead className="font-semibold uppercase tracking-wider text-[10px] text-foreground min-w-[160px]">
                Default
              </TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {columns.map((column, index) => (
              <ColumnRow
                key={column.id}
                col={column}
                index={index}
                engineType={engineType}
                engineDataTypes={engineDataTypes}
                engineTypeLabel={engineTypeLabel}
                hasError={liveColumnNameErrors[column.id]}
                canRemove={columns.length > 1}
                onUpdate={onUpdateColumn}
                onRemove={onRemoveColumn}
                onMovePk={onMovePk}
              />
            ))}
          </TableBody>
        </Table>

        <div
          className="flex items-center justify-center py-3 border-t border-border/30 cursor-pointer hover:bg-secondary/30 transition-colors group"
          onClick={onAddColumn}
        >
          <Plus
            size={14}
            className="text-muted-foreground/50 group-hover:text-primary transition-colors mr-1.5"
          />
          <span className="text-xs text-muted-foreground/50 group-hover:text-primary transition-colors font-medium">
            Add Column
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-[10px] text-muted-foreground/60">
        <span>
          <strong className="text-muted-foreground">PK</strong> = Primary Key
        </span>
        <span>
          <strong className="text-muted-foreground">AI</strong> = Auto Increment
        </span>
        <span>
          <strong className="text-muted-foreground">NN</strong> = Not Null
        </span>
        <span>
          <strong className="text-muted-foreground">UQ</strong> = Unique
        </span>
      </div>
    </>
  );
}
