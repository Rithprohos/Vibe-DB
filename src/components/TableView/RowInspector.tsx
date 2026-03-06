import { Copy, Eye, X as XIcon } from 'lucide-react';
import { formatCellValue } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ColumnInfo } from '@/store/useAppStore';

interface RowInspectorProps {
  isOpen: boolean;
  gridCols: string[];
  selectedRowData: Record<string, unknown> | null;
  columnInfoByName: Record<string, ColumnInfo>;
  onToggle: () => void;
  onCopyField: (columnName: string, value: unknown) => void | Promise<void>;
}

export function RowInspector({
  isOpen,
  gridCols,
  selectedRowData,
  columnInfoByName,
  onToggle,
  onCopyField,
}: RowInspectorProps) {
  return (
    <aside
      className="border-l border-border bg-card/95 backdrop-blur-sm shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out"
      style={{ width: isOpen ? 320 : 0, opacity: isOpen ? 1 : 0 }}
    >
      {isOpen && (
        <div className="flex h-full w-80 flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/80">
                Row Inspector
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
              <XIcon size={14} />
            </Button>
          </div>

          {selectedRowData ? (
            <div className="flex-1 overflow-auto px-3 py-3">
              <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
                Click another row in the grid to inspect it without leaving the table.
              </div>
              <div className="space-y-3">
                {gridCols.map((colName) => {
                  const columnInfo = columnInfoByName[colName];
                  const formattedValue = formatCellValue(selectedRowData[colName]);

                  return (
                    <div
                      key={colName}
                      className="rounded-xl border border-border/60 bg-background/80 shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-foreground">
                            {colName}
                          </div>
                          <div className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">
                            {columnInfo?.col_type ?? 'text'}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => void onCopyField(colName, selectedRowData[colName])}
                          title={`Copy ${colName}`}
                        >
                          <Copy size={12} />
                        </Button>
                      </div>
                      <div className="px-3 py-3">
                        <pre
                          className={cn(
                            'whitespace-pre-wrap break-words text-[12px] leading-5',
                            formattedValue.className
                          )}
                        >
                          {formattedValue.text}
                        </pre>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 rounded-full border border-border/60 bg-secondary/30 p-3">
                <Eye size={20} className="text-muted-foreground" />
              </div>
              <div className="text-sm font-medium text-foreground">No row selected</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Open the inspector and click a row in the grid to inspect full values.
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
