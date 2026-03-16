import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Eye, Pencil, X as XIcon } from 'lucide-react';
import { formatCellValue } from '@/lib/formatters';
import { isJsonColumn } from '@/lib/sql/columnTypes';
import {
  normalizeJsonInput,
  parseStructuredColumnValue,
} from '@/lib/sql/values';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatColumnTypeDisplay } from '@/lib/typeDisplay';
import type { ColumnInfo } from '@/store/useAppStore';
import { isEnumColumn } from '@/lib/sql/columnTypes';
import { EnumValueSelect } from './EnumValueSelect';

interface RowInspectorProps {
  isOpen: boolean;
  gridCols: string[];
  selectedRowIndex: number | null;
  selectedRowData: Record<string, unknown> | null;
  columnInfoByName: Record<string, ColumnInfo>;
  getPendingCellValue: (rowIndex: number, colName: string) => unknown;
  isCellPending: (rowIndex: number, colName: string) => boolean;
  saving: boolean;
  onSaveField: (
    rowIndex: number,
    columnName: string,
    value: string,
  ) => void | Promise<void>;
  onToggle: () => void;
  onCopyField: (columnName: string, value: unknown) => void | Promise<void>;
}

export function RowInspector({
  isOpen,
  gridCols,
  selectedRowIndex,
  selectedRowData,
  columnInfoByName,
  getPendingCellValue,
  isCellPending,
  saving,
  onSaveField,
  onToggle,
  onCopyField,
}: RowInspectorProps) {
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [editorError, setEditorError] = useState('');

  useEffect(() => {
    setEditingColumn(null);
    setDraftValue('');
    setEditorError('');
  }, [selectedRowIndex]);

  const handleCancelEdit = useCallback(() => {
    setEditingColumn(null);
    setDraftValue('');
    setEditorError('');
  }, []);

  const editingColumnInfo = useMemo(
    () => (editingColumn ? columnInfoByName[editingColumn] : undefined),
    [columnInfoByName, editingColumn],
  );
  const isJsonEditor = Boolean(
    editingColumnInfo && isJsonColumn(editingColumnInfo.col_type),
  );
  const isEnumEditor = Boolean(
    editingColumnInfo && isEnumColumn(editingColumnInfo),
  );
  const enumOptions = editingColumnInfo?.enum_values ?? [];
  const liveJsonError = useMemo(() => {
    if (!isJsonEditor) return '';
    const trimmed = draftValue.trim();
    if (trimmed === '' || trimmed === 'NULL') return '';
    try {
      JSON.parse(normalizeJsonInput(draftValue));
      return '';
    } catch {
      return 'Invalid JSON syntax';
    }
  }, [draftValue, isJsonEditor]);

  const handleFormatJson = useCallback(() => {
    if (!isJsonEditor) return;
    const trimmed = draftValue.trim();
    if (trimmed === '' || trimmed === 'NULL') return;
    try {
      const formatted = JSON.stringify(JSON.parse(normalizeJsonInput(draftValue)), null, 2);
      setDraftValue(formatted);
      setEditorError('');
    } catch {
      setEditorError('Please fix JSON syntax before formatting.');
    }
  }, [draftValue, isJsonEditor]);

  const handleMinifyJson = useCallback(() => {
    if (!isJsonEditor) return;
    const trimmed = draftValue.trim();
    if (trimmed === '' || trimmed === 'NULL') return;
    try {
      const minified = JSON.stringify(JSON.parse(normalizeJsonInput(draftValue)));
      setDraftValue(minified);
      setEditorError('');
    } catch {
      setEditorError('Please fix JSON syntax before minifying.');
    }
  }, [draftValue, isJsonEditor]);

  const handleSaveEdit = useCallback(async () => {
    if (editingColumn === null || selectedRowIndex === null) return;

    const columnInfo = columnInfoByName[editingColumn];
    let valueToSave = draftValue;

    if (columnInfo && isJsonColumn(columnInfo.col_type)) {
      const trimmed = draftValue.trim();
      if (trimmed !== '' && trimmed !== 'NULL') {
        try {
          valueToSave = normalizeJsonInput(draftValue);
          JSON.parse(valueToSave);
        } catch {
          setEditorError('Please fix JSON syntax before saving.');
          return;
        }
      }
    }

    try {
      parseStructuredColumnValue(valueToSave, columnInfo);
      setEditorError('');
    } catch (error: unknown) {
      setEditorError(error instanceof Error ? error.message : String(error));
      return;
    }

    await onSaveField(selectedRowIndex, editingColumn, valueToSave);
    setEditingColumn(null);
    setDraftValue('');
  }, [
    columnInfoByName,
    draftValue,
    editingColumn,
    onSaveField,
    selectedRowIndex,
  ]);

  return (
    <aside
      className={cn(
        "absolute right-0 top-0 h-full border-l border-border bg-card overflow-hidden transition-transform duration-200 ease-out z-30",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
      style={{ width: 320 }}
    >
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
            <div className="mb-3 rounded-sm border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
              Click another row in the grid to inspect it without leaving the table.
            </div>
            <div className="space-y-3">
              {gridCols.map((colName) => {
                const columnInfo = columnInfoByName[colName];
                const pendingValue =
                  selectedRowIndex !== null
                    ? getPendingCellValue(selectedRowIndex, colName)
                    : null;
                const currentValue = pendingValue ?? selectedRowData[colName];
                const hasPending =
                  selectedRowIndex !== null && isCellPending(selectedRowIndex, colName);
                const formattedValue = formatCellValue(currentValue, {
                  prettyJson: true,
                });
                const isEditing = editingColumn === colName;
                const isEditable = colName !== 'rowNum';

                return (
                  <div
                    key={colName}
                    className={cn(
                      'rounded-md border bg-background/80 shadow-sm',
                      hasPending ? 'border-amber-500/50' : 'border-border/60',
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-foreground">
                          {colName}
                        </div>
                        <div className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">
                          {formatColumnTypeDisplay(columnInfo?.col_type ?? 'text')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isEditable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditorError('');
                              setEditingColumn(colName);
                              setDraftValue(formattedValue.text === 'NULL' ? '' : formattedValue.text);
                            }}
                            title={`Edit ${colName}`}
                            disabled={saving}
                          >
                            <Pencil size={12} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => void onCopyField(colName, currentValue)}
                          title={`Copy ${colName}`}
                        >
                          <Copy size={12} />
                        </Button>
                      </div>
                    </div>
                    <div className="px-3 py-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          {isJsonEditor && (
                            <div className="flex items-center justify-between gap-2 rounded-sm border border-border/60 bg-secondary/20 px-2 py-1">
                              <div
                                className={cn(
                                  'text-[10px] font-mono uppercase tracking-[0.15em]',
                                  liveJsonError ? 'text-destructive' : 'text-emerald-400',
                                )}
                              >
                                {liveJsonError ? 'JSON Invalid' : 'JSON Valid'}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] font-mono"
                                  onClick={handleFormatJson}
                                  disabled={saving}
                                >
                                  Format
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] font-mono"
                                  onClick={handleMinifyJson}
                                  disabled={saving}
                                >
                                  Minify
                                </Button>
                              </div>
                            </div>
                          )}
                          {isEnumEditor ? (
                            <div className="rounded-sm border border-border/60 bg-background">
                              <EnumValueSelect
                                value={draftValue}
                                options={enumOptions}
                                allowNull={!editingColumnInfo?.notnull}
                                autoFocus
                                className="h-9 px-2 py-1.5 text-[12px]"
                                onChange={(value) => {
                                  setDraftValue(value);
                                  if (editorError) setEditorError('');
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Escape') {
                                    event.preventDefault();
                                    handleCancelEdit();
                                  }
                                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                                    event.preventDefault();
                                    void handleSaveEdit();
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <textarea
                              value={draftValue}
                              onChange={(event) => {
                                setDraftValue(event.target.value);
                                if (editorError) setEditorError('');
                              }}
                              className="min-h-[112px] w-full resize-y border border-border/60 bg-background px-2 py-1.5 text-[12px] leading-5 font-mono text-foreground outline-none focus:border-primary"
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                                  event.preventDefault();
                                  void handleSaveEdit();
                                  return;
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  handleCancelEdit();
                                }
                              }}
                              placeholder="NULL"
                              autoFocus
                            />
                          )}
                          {(editorError || liveJsonError) && (
                            <div className="text-[11px] text-destructive">
                              {editorError || liveJsonError}
                            </div>
                          )}
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={handleCancelEdit}
                              disabled={saving}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => void handleSaveEdit()}
                              disabled={saving || Boolean(liveJsonError)}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <pre
                          className={cn(
                            'whitespace-pre-wrap break-words text-[12px] leading-5',
                            formattedValue.className
                          )}
                        >
                          {formattedValue.text}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 rounded-sm border border-border/60 bg-secondary/30 p-3">
              <Eye size={20} className="text-muted-foreground" />
            </div>
            <div className="text-sm font-medium text-foreground">No row selected</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Open the inspector and click a row in the grid to inspect full values.
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
