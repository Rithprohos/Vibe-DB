import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { buildCreateTableSQL, executeQuery, listTables } from '../lib/db';
import { validateColumnName, validateTableName } from '../lib/tableName';
import { highlightSQL } from '../lib/highlightSQL';
import {
  getDataTypesForEngine,
  getEngineTypeLabel,
  DEFAULT_OPTIONS,
  DEFAULT_TABLE_NAME,
  createEmptyColumn,
  createDefaultIdColumn,
  type ColumnDef,
} from '../lib/createTableConstants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  GripVertical,
  Sparkles,
  AlertCircle,
  TableIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tabId: string;
}

export default function CreateTable({ tabId }: Props) {
  const fieldErrorClass = 'border-destructive/70 focus-visible:ring-destructive focus-visible:border-destructive';
  // ── Store selectors (granular per Rule #1) ──
  const tabs = useAppStore(s => s.tabs);
  const connections = useAppStore(s => s.connections);
  const setTables = useAppStore(s => s.setTables);
  const updateTab = useAppStore(s => s.updateTab);
  const openTableTab = useAppStore(s => s.openTableTab);
  const closeTab = useAppStore(s => s.closeTab);

  // ── Derived state (memoized per Rule #3) ──
  const tab = useMemo(() => tabs.find(t => t.id === tabId), [tabs, tabId]);
  const activeConnection = useMemo(
    () => connections.find(c => c.id === tab?.connectionId),
    [connections, tab?.connectionId],
  );
  // Primitive for effect deps (Rule #2)
  const connId = activeConnection?.connId;
  const engineType = activeConnection?.type ?? 'sqlite';
  const engineDataTypes = useMemo(
    () => getDataTypesForEngine(engineType),
    [engineType],
  );
  const engineTypeLabel = useMemo(
    () => getEngineTypeLabel(engineType),
    [engineType],
  );

  // ── Local state ──
  const [tableName, setTableName] = useState(DEFAULT_TABLE_NAME);
  const [columns, setColumns] = useState<ColumnDef[]>([createDefaultIdColumn()]);
  const [ifNotExists, setIfNotExists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sql, setSql] = useState('');
  const sqlPreviewRequestIdRef = useRef(0);

  // ── Derived values ──
  const pkCount = useMemo(
    () => columns.filter(c => c.primaryKey).length,
    [columns],
  );
  const validColumnCount = useMemo(
    () => columns.filter(c => c.name.trim()).length,
    [columns],
  );
  const liveTableNameError = useMemo(() => {
    if (!tableName.trim()) return null;
    return validateTableName(tableName);
  }, [tableName]);
  const liveColumnNameErrors = useMemo(() => {
    const errorMap: Record<string, string> = {};
    columns.forEach((col) => {
      if (!col.name.trim()) return;
      const maybeError = validateColumnName(col.name);
      if (maybeError) {
        errorMap[col.id] = maybeError;
      }
    });
    return errorMap;
  }, [columns]);

  // ── Stabilized callbacks (Rule #4) ──
  const updateColumn = useCallback(
    (id: string, updates: Partial<ColumnDef>) => {
      setColumns(prev =>
        prev.map(col => {
          if (col.id !== id) return col;
          const updated = { ...col, ...updates };
          // AUTOINCREMENT requires INTEGER PRIMARY KEY
          if (updates.autoIncrement && updated.autoIncrement) {
            updated.primaryKey = true;
            updated.type = 'INTEGER';
          }
          // If unsetting PK, also unset autoincrement
          if ('primaryKey' in updates && !updates.primaryKey) {
            updated.autoIncrement = false;
          }
          return updated;
        }),
      );
      setError('');
    },
    [],
  );

  const addColumn = useCallback(() => {
    setColumns(prev => [...prev, createEmptyColumn()]);
  }, []);

  const removeColumn = useCallback((id: string) => {
    setColumns(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(col => col.id !== id);
    });
  }, []);

  const handleTogglePreview = useCallback(() => {
    setShowPreview(prev => !prev);
  }, []);

  const handleCancel = useCallback(() => {
    closeTab(tabId);
  }, [closeTab, tabId]);

  useEffect(() => {
    const hasTableName = tableName.trim().length > 0;
    const hasNamedColumn = columns.some(col => col.name.trim().length > 0);
    if (!hasTableName || !hasNamedColumn) {
      setSql('');
      return;
    }

    const requestId = ++sqlPreviewRequestIdRef.current;
    void (async () => {
      try {
        if (validateTableName(tableName)) {
          if (requestId !== sqlPreviewRequestIdRef.current) return;
          setSql('');
          return;
        }
        const invalidColumn = columns.find(
          (col) => col.name.trim().length > 0 && validateColumnName(col.name),
        );
        if (invalidColumn) {
          if (requestId !== sqlPreviewRequestIdRef.current) return;
          setSql('');
          return;
        }
        const generatedSql = await buildCreateTableSQL(tableName, columns, ifNotExists);
        if (requestId !== sqlPreviewRequestIdRef.current) return;
        setSql(generatedSql);
      } catch {
        if (requestId !== sqlPreviewRequestIdRef.current) return;
        setSql('');
      }
    })();
  }, [tableName, columns, ifNotExists]);

  const handleSave = useCallback(async () => {
    if (!connId) {
      setError('No active database connection');
      return;
    }

    const tableNameError = validateTableName(tableName);
    if (tableNameError) {
      setError(tableNameError);
      return;
    }
    const invalidColumn = columns.find(
      (col) => col.name.trim().length > 0 && validateColumnName(col.name),
    );
    if (invalidColumn) {
      const colError = validateColumnName(invalidColumn.name);
      setError(colError ?? "Invalid column name");
      return;
    }

    setSaving(true);
    setError('');
    let sqlToRun = '';

    try {
      sqlToRun = await buildCreateTableSQL(tableName, columns, ifNotExists);
      await executeQuery(sqlToRun, connId);
      // Refresh the tables list
      const tables = await listTables(connId);
      if (activeConnection) {
        setTables(activeConnection.id, tables);
      }

      // Update tab title and navigate to the new table
      updateTab(tabId, { title: `✓ ${tableName}` });
      closeTab(tabId);
      if (activeConnection) {
        openTableTab(activeConnection.id, tableName.trim(), 'data');
      }
    } catch (e: any) {
      const errMsg = e?.toString() || 'Unknown error';
      setError(errMsg);
    } finally {
      setSaving(false);
    }
  }, [
    connId,
    tableName,
    columns,
    ifNotExists,
    setTables,
    activeConnection,
    updateTab,
    tabId,
    closeTab,
    openTableTab,
  ]);

  // ── Preview empty state message ──
  const previewHint = useMemo(() => {
    if (!tableName.trim() && validColumnCount === 0) {
      return 'Enter a table name and at least one column to see the generated SQL.';
    }
    if (!tableName.trim()) {
      return 'Enter a table name to see the generated SQL.';
    }
    return 'Add at least one column with a name to see the generated SQL.';
  }, [tableName, validColumnCount]);

  return (
    <div className="flex-1 overflow-hidden bg-background relative w-full h-full flex flex-col">
      {/* ── Header Section ── */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm px-6 py-4 flex-shrink-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
              <TableIcon size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Create New Table
              </h2>
              <p className="text-xs text-muted-foreground">
                Define your table schema below
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Table Name
              </label>
              <Input
                type="text"
                placeholder="e.g. users, products, orders..."
                value={tableName}
                onChange={e => {
                  setTableName(e.target.value);
                  setError('');
                }}
                className={cn(
                  "bg-background border-border placeholder:text-muted-foreground/40 text-sm font-medium focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-9",
                  liveTableNameError && fieldErrorClass,
                )}
                autoFocus
              />
              {liveTableNameError && (
                <p className="mt-1 text-[11px] text-destructive">{liveTableNameError}</p>
              )}
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Checkbox
                id="if-not-exists"
                checked={ifNotExists}
                onCheckedChange={v => setIfNotExists(!!v)}
              />
              <label
                htmlFor="if-not-exists"
                className="text-xs text-muted-foreground cursor-pointer select-none"
              >
                IF NOT EXISTS
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-sm bg-destructive/10 border border-destructive/20 text-destructive text-sm font-mono max-w-6xl">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* ── Columns Table ── */}
      <ScrollArea className="flex-1 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          {/* Toolbar */}
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
                onClick={handleTogglePreview}
                className="border-border/50 bg-background/50 hover:bg-accent/50 text-xs gap-1.5"
              >
                <Sparkles size={13} />
                {showPreview ? 'Hide' : 'Preview'} SQL
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addColumn}
                className="border-border/50 bg-background/50 hover:bg-accent/50 text-xs gap-1.5"
              >
                <Plus size={13} />
                Add Column
              </Button>
            </div>
          </div>

          {/* SQL Preview */}
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

          {/* Columns Grid */}
          <div className="rounded-md border border-border bg-surface/[0.3] overflow-hidden shadow-xl shadow-black/15 glass-panel">
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
                {columns.map((col, idx) => (
                  <TableRow
                    key={col.id}
                    className={cn(
                      'border-border/20 transition-colors group',
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-secondary/10',
                    )}
                  >
                    {/* Drag handle */}
                    <TableCell className="pl-3 py-2">
                      <div className="flex items-center justify-center text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
                        <GripVertical size={14} />
                      </div>
                    </TableCell>

                    {/* Column Name */}
                    <TableCell className="py-2">
                      <Input
                        type="text"
                        value={col.name}
                        onChange={e =>
                          updateColumn(col.id, { name: e.target.value })
                        }
                        placeholder="column_name"
                        className={cn(
                          "bg-transparent border-border/50 placeholder:text-muted-foreground/30 text-sm font-medium h-8 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary",
                          liveColumnNameErrors[col.id] && fieldErrorClass,
                        )}
                      />
                      {liveColumnNameErrors[col.id] && (
                        <div className="mt-1 text-[10px] text-destructive leading-tight">
                          {liveColumnNameErrors[col.id]}
                        </div>
                      )}
                    </TableCell>

                    {/* Data Type */}
                    <TableCell className="py-2">
                      <Select
                        value={col.type}
                        onValueChange={val =>
                          updateColumn(col.id, { type: val })
                        }
                      >
                        <SelectTrigger className="h-8 bg-transparent border-border/50 text-sm focus:ring-1 focus:ring-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {engineTypeLabel}
                            </SelectLabel>
                            {engineDataTypes.map(t => (
                              <SelectItem key={t.value} value={t.value}>
                                <span
                                  className={cn(
                                    'font-mono text-xs font-bold',
                                    t.color,
                                  )}
                                >
                                  {t.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* Primary Key */}
                    <TableCell className="text-center py-2">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={col.primaryKey}
                          onCheckedChange={v => {
                            if (v && pkCount >= 1 && !col.primaryKey) {
                              // Move PK to this column
                              setColumns(prev =>
                                prev.map(c => ({
                                  ...c,
                                  primaryKey: c.id === col.id,
                                  autoIncrement:
                                    c.id === col.id
                                      ? c.autoIncrement
                                      : false,
                                })),
                              );
                            } else {
                              updateColumn(col.id, { primaryKey: !!v });
                            }
                          }}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </div>
                    </TableCell>

                    {/* Auto Increment */}
                    <TableCell className="text-center py-2">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={col.autoIncrement}
                          onCheckedChange={v =>
                            updateColumn(col.id, { autoIncrement: !!v })
                          }
                          disabled={!col.primaryKey || col.type !== 'INTEGER'}
                          className={cn(
                            'data-[state=checked]:bg-warning data-[state=checked]:border-warning',
                            (!col.primaryKey || col.type !== 'INTEGER') &&
                              'opacity-30',
                          )}
                        />
                      </div>
                    </TableCell>

                    {/* Not Null */}
                    <TableCell className="text-center py-2">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={col.notNull}
                          onCheckedChange={v =>
                            updateColumn(col.id, { notNull: !!v })
                          }
                          className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                        />
                      </div>
                    </TableCell>

                    {/* Unique */}
                    <TableCell className="text-center py-2">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={col.unique}
                          onCheckedChange={v =>
                            updateColumn(col.id, { unique: !!v })
                          }
                          className="data-[state=checked]:bg-info data-[state=checked]:border-info"
                        />
                      </div>
                    </TableCell>

                    {/* Default Value */}
                    <TableCell className="py-2">
                      <div className="flex gap-1.5">
                        <Select
                          value={col.defaultOption}
                          onValueChange={val =>
                            updateColumn(col.id, {
                              defaultOption: val || 'none',
                              defaultValue: '',
                            })
                          }
                        >
                          <SelectTrigger className="h-8 bg-transparent border-border/50 text-xs focus:ring-1 focus:ring-primary flex-1">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            {DEFAULT_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className="text-xs">{opt.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {col.defaultOption === 'custom' && (
                          <Input
                            type="text"
                            value={col.defaultValue}
                            onChange={e =>
                              updateColumn(col.id, {
                                defaultValue: e.target.value,
                              })
                            }
                            placeholder="value"
                            className="bg-transparent border-border/50 placeholder:text-muted-foreground/30 text-xs h-8 w-24 focus-visible:ring-1 focus-visible:ring-primary"
                          />
                        )}
                      </div>
                    </TableCell>

                    {/* Remove */}
                    <TableCell className="py-2 pr-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColumn(col.id)}
                        disabled={columns.length <= 1}
                        className={cn(
                          'w-7 h-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity',
                          'hover:bg-destructive/10 hover:text-destructive',
                          columns.length <= 1 && '!opacity-0',
                        )}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Add Column Row */}
            <div
              className="flex items-center justify-center py-3 border-t border-border/30 cursor-pointer hover:bg-secondary/30 transition-colors group"
              onClick={addColumn}
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

          {/* Column Legend */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-[10px] text-muted-foreground/60">
            <span>
              <strong className="text-muted-foreground">PK</strong> = Primary
              Key
            </span>
            <span>
              <strong className="text-muted-foreground">AI</strong> = Auto
              Increment
            </span>
            <span>
              <strong className="text-muted-foreground">NN</strong> = Not Null
            </span>
            <span>
              <strong className="text-muted-foreground">UQ</strong> = Unique
            </span>
          </div>
        </div>
      </ScrollArea>

      {/* ── Footer Actions ── */}
      <div className="border-t border-border bg-background/80 backdrop-blur-sm px-6 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {validColumnCount} column{validColumnCount !== 1 ? 's' : ''} defined
            {tableName.trim() && (
              <span className="ml-2">
                · Table:{' '}
                <span className="text-foreground font-medium">
                  {tableName.trim()}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="border-border/50 bg-background/50 hover:bg-accent/50 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !tableName.trim() || validColumnCount === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5 shadow-glow"
            >
              {saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save size={13} />
                  Create Table
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
