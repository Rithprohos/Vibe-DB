import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { executeQuery, getTableStructure, listTables } from '../lib/db';
import {
  useAppStore,
  type ColumnInfo,
  type Tab,
  type TableInfo,
} from '../store/useAppStore';
import { validateColumnName, validateTableName } from '../lib/tableName';
import {
  getDataTypesForEngine,
  getEngineTypeLabel,
  getSqliteTypeColor,
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
  AlertCircle,
  Loader2,
  PencilRuler,
  RefreshCw,
  Table2,
  Trash2,
  Type,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  tableName: string;
  tabId: string;
}

const FORM_FIELD_CLASS =
  'h-9 bg-background border-border placeholder:text-muted-foreground/40 text-sm ' +
  'font-medium focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary';
const FIELD_ERROR_CLASS =
  'border-destructive/70 focus-visible:ring-destructive focus-visible:border-destructive';

function quoteIdentifier(name: string): string {
  return `"${name.split('"').join('""')}"`;
}

function getTableTabTitle(type: Tab['type'], tableName: string): string {
  if (type === 'data') return `${tableName} (Data)`;
  if (type === 'structure') return `${tableName} (Structure)`;
  if (type === 'edit-table') return `${tableName} (Edit)`;
  return tableName;
}

export default function EditTable({ tableName, tabId }: Props) {
  const tabs = useAppStore(s => s.tabs);
  const connections = useAppStore(s => s.connections);
  const setTables = useAppStore(s => s.setTables);
  const updateTab = useAppStore(s => s.updateTab);
  const showToast = useAppStore(s => s.showToast);

  const tab = useMemo(() => tabs.find(t => t.id === tabId), [tabs, tabId]);
  const connection = useMemo(
    () => connections.find(c => c.id === tab?.connectionId),
    [connections, tab?.connectionId],
  );

  const connectionId = tab?.connectionId;
  const connId = connection?.connId;
  const engineType = connection?.type ?? 'sqlite';

  const [currentTableName, setCurrentTableName] = useState(tableName);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [nextTableName, setNextTableName] = useState(tableName);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('TEXT');
  const [newColumnNotNull, setNewColumnNotNull] = useState(false);
  const [newColumnDefault, setNewColumnDefault] = useState('');

  const [renameColumnFrom, setRenameColumnFrom] = useState('');
  const [renameColumnTo, setRenameColumnTo] = useState('');

  const [dropColumnName, setDropColumnName] = useState('');
  const [dropConfirm, setDropConfirm] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const delay = useCallback((ms: number) => new Promise((resolve) => {
    setTimeout(resolve, ms);
  }), []);

  const renameTableNameError = useMemo(() => {
    const nextName = nextTableName.trim();
    if (!nextName || nextName === currentTableName) return null;
    return validateTableName(nextName);
  }, [nextTableName, currentTableName]);

  const newColumnNameError = useMemo(() => {
    const nextName = newColumnName.trim();
    if (!nextName) return null;
    return validateColumnName(nextName);
  }, [newColumnName]);

  const renameColumnToError = useMemo(() => {
    const nextName = renameColumnTo.trim();
    if (!nextName || nextName === renameColumnFrom.trim()) return null;
    return validateColumnName(nextName);
  }, [renameColumnTo, renameColumnFrom]);
  const engineDataTypes = useMemo(
    () => getDataTypesForEngine(engineType),
    [engineType],
  );
  const engineTypeLabel = useMemo(
    () => getEngineTypeLabel(engineType),
    [engineType],
  );

  const refreshStructure = useCallback(async (
    targetTableName = currentTableName,
    options?: {
      setError?: boolean;
      preferredColumnName?: string;
      ensureColumnName?: string;
      retries?: number;
      retryDelayMs?: number;
    },
  ): Promise<boolean> => {
    if (!connId) return false;

    if (!isMountedRef.current) return false;
    setLoadingColumns(true);
    if (options?.setError ?? true) {
      setError('');
    }

    try {
      const retries = options?.retries ?? 0;
      const retryDelayMs = options?.retryDelayMs ?? 80;
      const ensureColumnName = options?.ensureColumnName?.trim();

      let cols: ColumnInfo[] = [];
      let hasEnsuredColumn = false;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        cols = await getTableStructure(targetTableName, connId);
        hasEnsuredColumn = !ensureColumnName || cols.some((c) => c.name === ensureColumnName);
        if (hasEnsuredColumn) {
          break;
        }
        if (attempt < retries) {
          await delay(retryDelayMs);
        }
      }

      if (!isMountedRef.current) return false;
      setColumns(cols);
      if (cols.length > 0) {
        const firstColumnName = cols[0].name;
        const preferredColumnName = options?.preferredColumnName?.trim();
        const hasPreferred = Boolean(
          preferredColumnName && cols.some((c) => c.name === preferredColumnName),
        );
        const nextSelected = hasPreferred ? preferredColumnName! : firstColumnName;

        setRenameColumnFrom((prev) =>
          hasPreferred
            ? nextSelected
            : prev && cols.some((c) => c.name === prev)
              ? prev
              : firstColumnName,
        );
        setDropColumnName((prev) =>
          hasPreferred
            ? nextSelected
            : prev && cols.some((c) => c.name === prev)
              ? prev
              : firstColumnName,
        );
      }
      if (ensureColumnName && !hasEnsuredColumn) {
        return false;
      }
      return true;
    } catch (e: any) {
      if ((options?.setError ?? true) && isMountedRef.current) {
        setError(e?.toString?.() ?? 'Failed to load table structure');
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setLoadingColumns(false);
      }
    }
  }, [connId, currentTableName, delay]);

  const refreshTables = useCallback(async (): Promise<TableInfo[] | null> => {
    if (!connId || !connectionId) return null;

    try {
      const refreshed = await listTables(connId);
      setTables(connectionId, refreshed);
      return refreshed;
    } catch (e) {
      console.error('Failed to refresh tables:', e);
      return null;
    }
  }, [connId, connectionId, setTables]);

  useEffect(() => {
    setCurrentTableName(tableName);
    setNextTableName(tableName);
  }, [tableName]);

  useEffect(() => {
    refreshStructure(currentTableName);
  }, [refreshStructure, currentTableName]);

  const renameRelatedTabs = useCallback((oldName: string, newName: string) => {
    if (!connectionId) return;

    const tabsToUpdate = useAppStore
      .getState()
      .tabs
      .filter(t => t.connectionId === connectionId && t.tableName === oldName);

    tabsToUpdate.forEach((targetTab) => {
      updateTab(targetTab.id, {
        tableName: newName,
        title: getTableTabTitle(targetTab.type, newName),
      });
    });
  }, [connectionId, updateTab]);

  const runAlter = useCallback(async (actionKey: string, query: string, successMessage: string) => {
    if (!connId) return false;

    setBusyAction(actionKey);
    setError('');

    try {
      await executeQuery(query, connId);
      showToast({ type: 'success', message: successMessage });
      return true;
    } catch (e: any) {
      setError(e?.toString?.() ?? 'ALTER TABLE operation failed');
      showToast({ type: 'error', message: 'ALTER TABLE failed' });
      return false;
    } finally {
      setBusyAction(null);
    }
  }, [connId, showToast]);

  const handleRenameTable = useCallback(async () => {
    const trimmedNewName = nextTableName.trim();
    if (!trimmedNewName || trimmedNewName === currentTableName) return;

    const nameError = validateTableName(trimmedNewName);
    if (nameError) {
      setError(nameError);
      showToast({ type: 'error', message: 'Invalid table name' });
      return;
    }

    const sql = `ALTER TABLE ${quoteIdentifier(currentTableName)} RENAME TO ${quoteIdentifier(trimmedNewName)}`;
    const ok = await runAlter('rename-table', sql, `Renamed table to ${trimmedNewName}`);
    if (!ok) return;

    const refreshedTables = await refreshTables();
    if (
      refreshedTables &&
      !refreshedTables.some((table) => table.name === trimmedNewName)
    ) {
      setError('Rename could not be verified from table metadata. UI state was not updated.');
      showToast({ type: 'error', message: 'Rename verification failed' });
      return;
    }

    renameRelatedTabs(currentTableName, trimmedNewName);
    setCurrentTableName(trimmedNewName);
    setNextTableName(trimmedNewName);
    const refreshedStructure = await refreshStructure(trimmedNewName, {
      setError: false,
    });
    if (!refreshedStructure) {
      setError('Table renamed, but schema refresh failed. Click "Refresh Schema" to sync.');
      showToast({ type: 'info', message: 'Renamed, but schema refresh failed' });
    }
  }, [
    currentTableName,
    nextTableName,
    refreshStructure,
    refreshTables,
    renameRelatedTabs,
    runAlter,
    showToast,
  ]);

  const handleAddColumn = useCallback(async () => {
    const trimmedName = newColumnName.trim();
    if (!trimmedName) return;
    const columnNameError = validateColumnName(trimmedName);
    if (columnNameError) {
      setError(columnNameError);
      showToast({ type: 'error', message: 'Invalid column name' });
      return;
    }

    const defaultSql = newColumnDefault.trim() ? ` DEFAULT ${newColumnDefault.trim()}` : '';
    const notNullSql = newColumnNotNull ? ' NOT NULL' : '';
    const sql =
      `ALTER TABLE ${quoteIdentifier(currentTableName)} ` +
      `ADD COLUMN ${quoteIdentifier(trimmedName)} ` +
      `${newColumnType.trim() || 'TEXT'}${notNullSql}${defaultSql}`;

    const ok = await runAlter('add-column', sql, `Added column ${trimmedName}`);
    if (!ok) return;

    setNewColumnName('');
    setNewColumnDefault('');
    setNewColumnNotNull(false);
    const refreshed = await refreshStructure(currentTableName, {
      preferredColumnName: trimmedName,
      ensureColumnName: trimmedName,
      retries: 4,
      retryDelayMs: 100,
    });
    if (!refreshed) {
      setError(
        'Column was added, but schema is still stale. Please click "Refresh Schema".',
      );
      showToast({ type: 'info', message: 'Schema refresh pending' });
    }
    await refreshTables();
  }, [
    currentTableName,
    newColumnDefault,
    newColumnName,
    newColumnNotNull,
    newColumnType,
    refreshStructure,
    refreshTables,
    runAlter,
    showToast,
  ]);

  const handleRenameColumn = useCallback(async () => {
    const oldColumn = renameColumnFrom.trim();
    const newColumn = renameColumnTo.trim();

    if (!oldColumn || !newColumn || oldColumn === newColumn) return;
    const newColumnError = validateColumnName(newColumn);
    if (newColumnError) {
      setError(newColumnError);
      showToast({ type: 'error', message: 'Invalid column name' });
      return;
    }

    const sql =
      `ALTER TABLE ${quoteIdentifier(currentTableName)} ` +
      `RENAME COLUMN ${quoteIdentifier(oldColumn)} TO ${quoteIdentifier(newColumn)}`;
    const ok = await runAlter(
      'rename-column',
      sql,
      `Renamed column ${oldColumn} to ${newColumn}`,
    );
    if (!ok) return;

    setRenameColumnFrom(newColumn);
    setRenameColumnTo('');
    await refreshStructure();
  }, [
    currentTableName,
    refreshStructure,
    renameColumnFrom,
    renameColumnTo,
    runAlter,
    showToast,
  ]);

  const handleDropColumn = useCallback(async () => {
    const column = dropColumnName.trim();
    if (!column || !dropConfirm) return;
    if (!connId) return;

    setLoadingColumns(true);
    setError('');

    let existingColumns: ColumnInfo[] = [];
    try {
      existingColumns = await getTableStructure(currentTableName, connId);
      setColumns(existingColumns);
    } catch (e: any) {
      setLoadingColumns(false);
      setError(e?.toString?.() ?? 'Failed to refresh schema before drop');
      showToast({ type: 'error', message: 'Schema refresh failed' });
      return;
    }

    const exactColumn = existingColumns.find((c) => c.name === column);
    if (!exactColumn) {
      setLoadingColumns(false);
      setError(
        `Column "${column}" is not in the latest schema. Refresh and try again.`,
      );
      showToast({ type: 'error', message: 'Column no longer exists' });
      return;
    }

    setLoadingColumns(false);

    const sql =
      `ALTER TABLE ${quoteIdentifier(currentTableName)} ` +
      `DROP COLUMN ${quoteIdentifier(exactColumn.name)}`;
    const ok = await runAlter('drop-column', sql, `Dropped column ${column}`);
    if (!ok) return;

    setDropConfirm(false);
    await refreshStructure();
  }, [
    connId,
    currentTableName,
    dropColumnName,
    dropConfirm,
    refreshStructure,
    runAlter,
    showToast,
  ]);

  const isBusy = useCallback((action: string) => busyAction === action, [busyAction]);

  return (
    <div className="h-full overflow-auto bg-background custom-scrollbar-hide">
      <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-4">
        <header className="rounded-xl border border-border bg-surface/30 backdrop-blur-sm">
          <div className="border-b border-border/60 px-4 py-3 md:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={
                    "flex h-8 w-8 items-center justify-center rounded-lg " +
                    "border border-primary/30 bg-primary/10"
                  }
                >
                  <PencilRuler size={15} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Edit Table</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Apply ALTER TABLE operations on{' '}
                    <span className="font-mono text-foreground">
                      {currentTableName}
                    </span>
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshStructure(currentTableName)}
                disabled={loadingColumns}
                className="border-border/60 bg-background/40 text-xs"
              >
                {loadingColumns ? (
                  <Loader2 size={12} className="mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw size={12} className="mr-1.5" />
                )}
                Refresh Schema
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 px-4 py-3 text-[11px] md:grid-cols-4 md:px-5">
            <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
              <div className="text-muted-foreground">Columns</div>
              <div className="mt-1 font-mono text-foreground">{columns.length}</div>
            </div>
            <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
              <div className="text-muted-foreground">Primary Keys</div>
              <div className="mt-1 font-mono text-foreground">
                {columns.filter(c => c.pk === 1).length}
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
              <div className="text-muted-foreground">Required</div>
              <div className="mt-1 font-mono text-foreground">
                {columns.filter(c => c.notnull === 1).length}
              </div>
            </div>
            <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2">
              <div className="text-muted-foreground">Connection</div>
              <div className="mt-1 truncate font-mono text-foreground">
                {connection?.name ?? 'Unknown'}
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div
            className={
              "flex items-start gap-2 rounded-lg border " +
              "border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
            }
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap break-words">{error}</span>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-4">
            <section className="rounded-xl border border-border bg-surface/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Table2 size={14} className="text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Rename Table
                </h3>
              </div>
              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  value={nextTableName}
                  onChange={(e) => setNextTableName(e.target.value)}
                  placeholder="New table name"
                  className={cn(FORM_FIELD_CLASS, renameTableNameError && FIELD_ERROR_CLASS)}
                />
                <Button
                  onClick={handleRenameTable}
                  disabled={
                    loadingColumns ||
                    isBusy('rename-table') ||
                    !nextTableName.trim() ||
                    nextTableName.trim() === currentTableName ||
                    Boolean(renameTableNameError)
                  }
                  className="h-9 md:min-w-[130px]"
                >
                  {isBusy('rename-table') ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : null}
                  Rename
                </Button>
              </div>
              {renameTableNameError && (
                <p className="mt-2 text-[11px] text-destructive">{renameTableNameError}</p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Type size={14} className="text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Add Column
                </h3>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Column name"
                  className={cn(FORM_FIELD_CLASS, newColumnNameError && FIELD_ERROR_CLASS)}
                />
                <Select value={newColumnType} onValueChange={setNewColumnType}>
                  <SelectTrigger className={cn(FORM_FIELD_CLASS, 'justify-start gap-2')}>
                    <span
                      className={cn(
                        'font-mono text-xs font-semibold tracking-wider',
                        getSqliteTypeColor(newColumnType),
                      )}
                    >
                      {newColumnType}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="border-border/80">
                    <SelectGroup>
                      <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {engineTypeLabel}
                      </SelectLabel>
                      {engineDataTypes.map((typeOption) => (
                        <SelectItem
                          key={typeOption.value}
                          value={typeOption.value}
                          className={cn(
                            'font-mono text-xs font-semibold tracking-wider focus:bg-background/70',
                            getSqliteTypeColor(typeOption.value),
                          )}
                        >
                          {typeOption.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Input
                  value={newColumnDefault}
                  onChange={(e) => setNewColumnDefault(e.target.value)}
                  placeholder="DEFAULT value/expression (optional)"
                  className={cn(FORM_FIELD_CLASS, 'md:col-span-2')}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={newColumnNotNull} onCheckedChange={(v) => setNewColumnNotNull(!!v)} />
                  NOT NULL
                </label>
                <Button
                  onClick={handleAddColumn}
                  disabled={
                    loadingColumns ||
                    isBusy('add-column') ||
                    !newColumnName.trim() ||
                    Boolean(newColumnNameError)
                  }
                  className="h-8"
                >
                  {isBusy('add-column') ? (
                    <Loader2 size={13} className="mr-1.5 animate-spin" />
                  ) : null}
                  Add Column
                </Button>
              </div>
              {newColumnNameError && (
                <p className="mt-2 text-[11px] text-destructive">{newColumnNameError}</p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-surface/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <PencilRuler size={14} className="text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Rename Column
                </h3>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr,1fr,auto]">
                <Select value={renameColumnFrom} onValueChange={setRenameColumnFrom}>
                  <SelectTrigger className={FORM_FIELD_CLASS}>
                    <SelectValue placeholder="Current column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem
                        key={`rename-${column.cid}-${column.name}`}
                        value={column.name}
                      >
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={renameColumnTo}
                  onChange={(e) => setRenameColumnTo(e.target.value)}
                  placeholder="New column name"
                  className={cn(FORM_FIELD_CLASS, renameColumnToError && FIELD_ERROR_CLASS)}
                />
                <Button
                  onClick={handleRenameColumn}
                  disabled={
                    loadingColumns ||
                    isBusy('rename-column') ||
                    !renameColumnFrom.trim() ||
                    !renameColumnTo.trim() ||
                    Boolean(renameColumnToError)
                  }
                  className="h-9"
                >
                  {isBusy('rename-column') ? (
                    <Loader2 size={13} className="mr-1.5 animate-spin" />
                  ) : null}
                  Rename
                </Button>
              </div>
              {renameColumnToError && (
                <p className="mt-2 text-[11px] text-destructive">{renameColumnToError}</p>
              )}
            </section>

            <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Trash2 size={14} className="text-destructive" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-destructive/90">
                  Drop Column
                </h3>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr,auto,auto] md:items-center">
                <Select value={dropColumnName} onValueChange={setDropColumnName}>
                  <SelectTrigger className={FORM_FIELD_CLASS}>
                    <SelectValue placeholder="Choose column to drop" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem
                        key={`drop-${column.cid}-${column.name}`}
                        value={column.name}
                      >
                        {column.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label
                  className={
                    "inline-flex items-center gap-2 rounded-md border " +
                    "border-border/70 bg-background/30 px-3 py-2 text-xs text-muted-foreground"
                  }
                >
                  <Checkbox
                    checked={dropConfirm}
                    onCheckedChange={(v) => setDropConfirm(!!v)}
                  />
                  Confirm
                </label>
                <Button
                  variant="destructive"
                  onClick={handleDropColumn}
                  disabled={
                    loadingColumns ||
                    isBusy('drop-column') ||
                    !dropColumnName.trim() ||
                    !dropConfirm
                  }
                  className="h-9"
                >
                  {isBusy('drop-column') ? (
                    <Loader2 size={13} className="mr-1.5 animate-spin" />
                  ) : null}
                  Drop
                </Button>
              </div>
            </section>
          </div>

          <aside className="rounded-xl border border-border bg-surface/30 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Schema
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Live structure after each operation
                </p>
              </div>
              <span
                className={
                  "rounded-md border border-border/60 bg-background/50 " +
                  "px-2 py-1 text-[10px] font-mono text-muted-foreground"
                }
              >
                {columns.length} cols
              </span>
            </div>

            <div className="max-h-[70vh] overflow-auto custom-scrollbar-hide">
              {loadingColumns ? (
                <div className="flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground">
                  <Loader2 size={13} className="animate-spin" />
                  Loading table structure...
                </div>
              ) : columns.length === 0 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground">
                  No columns found for this table.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-secondary/70 backdrop-blur-sm">
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider">Name</th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Type</th>
                      <th className="px-3 py-2 text-center font-semibold uppercase tracking-wider">NN</th>
                      <th className="px-3 py-2 text-center font-semibold uppercase tracking-wider">PK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((column, index) => (
                      <tr
                        key={`${column.cid}-${column.name}`}
                        className={cn(
                          'border-b border-border/40',
                          index % 2 === 0 ? 'bg-transparent' : 'bg-secondary/20',
                        )}
                      >
                        <td className="px-4 py-2 font-medium text-foreground">{column.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {column.col_type || '—'}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {column.notnull ? 'Y' : 'N'}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {column.pk ? 'Y' : 'N'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
