import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { executeQuery, getTableStructure, listTables } from '../lib/db';
import {
  useAppStore,
  type TableStructureData,
  type TableInfo,
} from '../store/useAppStore';
import { validateColumnName, validateTableName } from '../lib/tableName';
import {
  getQualifiedTableName,
  replaceQualifiedTableName,
  splitQualifiedTableName,
} from '../lib/databaseObjects';
import {
  formatTypeWithParams,
  getDataTypesForEngine,
  getEngineTypeLabel,
  normalizeTypeParams,
  validateTypeParams,
  type TypeParams,
} from '../lib/createTableConstants';
import {
  EditTableErrorBanner,
  EditTableHeader,
  EditTableOperationsPanel,
  EditTableSchemaSidebar,
} from './edit-table/Sections';
import {
  getTableTabTitle,
  quoteIdentifier,
  quoteTableName,
  validateIndexName,
} from './edit-table/shared';

interface Props {
  tableName: string;
  tabId: string;
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
  const [tableStructure, setTableStructure] = useState<TableStructureData | null>(null);
  const columns = useMemo(() => tableStructure?.columns ?? [], [tableStructure]);
  const indexes = useMemo(() => tableStructure?.indexes ?? [], [tableStructure]);
  const manageableIndexes = useMemo(
    () => indexes.filter((index) => !index.name.startsWith('sqlite_autoindex_')),
    [indexes],
  );
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [nextTableName, setNextTableName] = useState(
    splitQualifiedTableName(tableName).name,
  );
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('TEXT');
  const [newColumnTypeParams, setNewColumnTypeParams] = useState<TypeParams | undefined>(undefined);
  const [newColumnNotNull, setNewColumnNotNull] = useState(false);
  const [newColumnDefault, setNewColumnDefault] = useState('');

  const [renameColumnFrom, setRenameColumnFrom] = useState('');
  const [renameColumnTo, setRenameColumnTo] = useState('');
  const [newIndexName, setNewIndexName] = useState('');
  const [newIndexColumns, setNewIndexColumns] = useState<string[]>([]);
  const [newIndexUnique, setNewIndexUnique] = useState(false);
  const [dropIndexName, setDropIndexName] = useState('');
  const [dropIndexConfirm, setDropIndexConfirm] = useState(false);

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
    if (!nextName || nextName === splitQualifiedTableName(currentTableName).name) return null;
    return validateTableName(nextName);
  }, [nextTableName, currentTableName]);

  const newColumnNameError = useMemo(() => {
    const nextName = newColumnName.trim();
    if (!nextName) return null;
    return validateColumnName(nextName);
  }, [newColumnName]);
  const newColumnTypeParamError = useMemo(
    () => validateTypeParams(newColumnType, newColumnTypeParams),
    [newColumnType, newColumnTypeParams],
  );

  const renameColumnToError = useMemo(() => {
    const nextName = renameColumnTo.trim();
    if (!nextName || nextName === renameColumnFrom.trim()) return null;
    return validateColumnName(nextName);
  }, [renameColumnTo, renameColumnFrom]);
  const newIndexNameError = useMemo(() => {
    const trimmed = newIndexName.trim();
    if (!trimmed) return null;
    return validateIndexName(trimmed);
  }, [newIndexName]);
  const selectedCreateIndexColumns = useMemo(
    () => newIndexColumns.filter((columnName) => columns.some((column) => column.name === columnName)),
    [newIndexColumns, columns],
  );
  const createIndexColumnsError = useMemo(() => {
    if (!newIndexName.trim()) return null;
    if (selectedCreateIndexColumns.length === 0) {
      return 'Select at least one column';
    }
    return null;
  }, [newIndexName, selectedCreateIndexColumns.length]);
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

      let structureData: Awaited<ReturnType<typeof getTableStructure>> | null = null;
      let hasEnsuredColumn = false;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        structureData = await getTableStructure(targetTableName, connId);
        const cols = structureData.columns;
        hasEnsuredColumn = !ensureColumnName || cols.some((c) => c.name === ensureColumnName);
        if (hasEnsuredColumn) {
          break;
        }
        if (attempt < retries) {
          await delay(retryDelayMs);
        }
      }

      if (!isMountedRef.current) return false;
      setTableStructure(structureData);
      const cols = structureData?.columns ?? [];
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
    setNextTableName(splitQualifiedTableName(tableName).name);
  }, [tableName]);

  useEffect(() => {
    refreshStructure(currentTableName);
  }, [refreshStructure, currentTableName]);

  useEffect(() => {
    setNewIndexColumns((prev) =>
      prev.filter((columnName) => columns.some((column) => column.name === columnName)),
    );
  }, [columns]);

  useEffect(() => {
    setDropIndexName((prev) => {
      if (prev && manageableIndexes.some((index) => index.name === prev)) {
        return prev;
      }
      return manageableIndexes[0]?.name ?? '';
    });
    if (!manageableIndexes.length) {
      setDropIndexConfirm(false);
    }
  }, [manageableIndexes]);

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
      await executeQuery(query, connId, 'guided');
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

    const nextQualifiedTableName = replaceQualifiedTableName(
      currentTableName,
      trimmedNewName,
    );
    const sql = `ALTER TABLE ${quoteTableName(currentTableName)} RENAME TO ${quoteIdentifier(trimmedNewName)}`;
    const ok = await runAlter('rename-table', sql, `Renamed table to ${trimmedNewName}`);
    if (!ok) return;

    const refreshedTables = await refreshTables();
    if (
      refreshedTables &&
      !refreshedTables.some(
        (table) => getQualifiedTableName(table) === nextQualifiedTableName,
      )
    ) {
      setError('Rename could not be verified from table metadata. UI state was not updated.');
      showToast({ type: 'error', message: 'Rename verification failed' });
      return;
    }

    renameRelatedTabs(currentTableName, nextQualifiedTableName);
    setCurrentTableName(nextQualifiedTableName);
    setNextTableName(trimmedNewName);
    const refreshedStructure = await refreshStructure(nextQualifiedTableName, {
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
    if (newColumnTypeParamError) {
      setError(newColumnTypeParamError);
      showToast({ type: 'error', message: 'Invalid type parameters' });
      return;
    }

    // Build full type with parameters
    const fullType = formatTypeWithParams(newColumnType, newColumnTypeParams);

    const defaultSql = newColumnDefault.trim() ? ` DEFAULT ${newColumnDefault.trim()}` : '';
    const notNullSql = newColumnNotNull ? ' NOT NULL' : '';
    const sql =
      `ALTER TABLE ${quoteTableName(currentTableName)} ` +
      `ADD COLUMN ${quoteIdentifier(trimmedName)} ` +
      `${fullType}${notNullSql}${defaultSql}`;

    const ok = await runAlter('add-column', sql, `Added column ${trimmedName}`);
    if (!ok) return;

    setNewColumnName('');
    setNewColumnDefault('');
    setNewColumnNotNull(false);
    setNewColumnTypeParams(undefined);
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
    newColumnTypeParamError,
    newColumnTypeParams,
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
      `ALTER TABLE ${quoteTableName(currentTableName)} ` +
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

  const toggleIndexColumn = useCallback((columnName: string) => {
    setNewIndexColumns((prev) => (
      prev.includes(columnName)
        ? prev.filter((existing) => existing !== columnName)
        : [...prev, columnName]
    ));
  }, []);

  const handleCreateIndex = useCallback(async () => {
    const indexName = newIndexName.trim();
    if (!indexName) return;

    const nameError = validateIndexName(indexName);
    if (nameError) {
      setError(nameError);
      showToast({ type: 'error', message: 'Invalid index name' });
      return;
    }

    const alreadyExists = indexes.some(
      (index) => index.name.toLowerCase() === indexName.toLowerCase(),
    );
    if (alreadyExists) {
      setError(`Index "${indexName}" already exists`);
      showToast({ type: 'error', message: 'Duplicate index name' });
      return;
    }

    if (selectedCreateIndexColumns.length === 0) {
      setError('Select at least one column for the index');
      showToast({ type: 'error', message: 'No index columns selected' });
      return;
    }

    const uniqueSql = newIndexUnique ? 'UNIQUE ' : '';
    const quotedColumns = selectedCreateIndexColumns.map((columnName) => quoteIdentifier(columnName));
    const sql =
      `CREATE ${uniqueSql}INDEX ${quoteIdentifier(indexName)} ` +
      `ON ${quoteTableName(currentTableName)} (${quotedColumns.join(', ')})`;
    const ok = await runAlter('create-index', sql, `Created index ${indexName}`);
    if (!ok) return;

    setNewIndexName('');
    setNewIndexUnique(false);
    setNewIndexColumns([]);
    await refreshStructure();
  }, [
    currentTableName,
    indexes,
    newIndexName,
    newIndexUnique,
    refreshStructure,
    runAlter,
    selectedCreateIndexColumns,
    showToast,
  ]);

  const handleDropIndex = useCallback(async () => {
    const indexName = dropIndexName.trim();
    if (!indexName || !dropIndexConfirm) return;

    if (indexName.startsWith('sqlite_autoindex_')) {
      setError('System-managed SQLite auto indexes cannot be dropped.');
      showToast({ type: 'error', message: 'Cannot drop system index' });
      return;
    }

    const sql = `DROP INDEX ${quoteIdentifier(indexName)}`;
    const ok = await runAlter('drop-index', sql, `Dropped index ${indexName}`);
    if (!ok) return;

    setDropIndexConfirm(false);
    await refreshStructure();
  }, [dropIndexConfirm, dropIndexName, refreshStructure, runAlter, showToast]);

  const handleDropColumn = useCallback(async () => {
    const column = dropColumnName.trim();
    if (!column || !dropConfirm) return;
    if (!connId) return;

    setLoadingColumns(true);
    setError('');

    let existingStructure: Awaited<ReturnType<typeof getTableStructure>> | null = null;
    try {
      existingStructure = await getTableStructure(currentTableName, connId);
      setTableStructure(existingStructure);
    } catch (e: any) {
      setLoadingColumns(false);
      setError(e?.toString?.() ?? 'Failed to refresh schema before drop');
      showToast({ type: 'error', message: 'Schema refresh failed' });
      return;
    }

    const exactColumn = existingStructure?.columns.find((c) => c.name === column);
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
      `ALTER TABLE ${quoteTableName(currentTableName)} ` +
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
  const handleRefreshSchema = useCallback(() => {
    void refreshStructure(currentTableName);
  }, [currentTableName, refreshStructure]);

  return (
    <div className="h-full overflow-auto bg-background custom-scrollbar-hide">
      <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-4">
        <EditTableHeader
          currentTableName={currentTableName}
          loadingColumns={loadingColumns}
          columns={columns}
          indexes={indexes}
          connectionName={connection?.name}
          onRefresh={handleRefreshSchema}
        />

        {error && <EditTableErrorBanner error={error} />}

        <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <EditTableOperationsPanel
            loadingColumns={loadingColumns}
            isBusy={isBusy}
            columns={columns}
            manageableIndexes={manageableIndexes}
            currentTableName={currentTableName}
            engineTypeLabel={engineTypeLabel}
            engineDataTypes={engineDataTypes}
            nextTableName={nextTableName}
            onNextTableNameChange={setNextTableName}
            renameTableNameError={renameTableNameError}
            onRenameTable={() => void handleRenameTable()}
            newColumnName={newColumnName}
            onNewColumnNameChange={setNewColumnName}
            newColumnNameError={newColumnNameError}
            newColumnType={newColumnType}
            onNewColumnTypeChange={(val) => {
              setNewColumnType(val);
              setNewColumnTypeParams(undefined);
            }}
            newColumnTypeParams={newColumnTypeParams}
            onNewColumnTypeParamsChange={(params) => {
              setNewColumnTypeParams(normalizeTypeParams(newColumnType, params));
            }}
            newColumnTypeParamError={newColumnTypeParamError}
            newColumnDefault={newColumnDefault}
            onNewColumnDefaultChange={setNewColumnDefault}
            newColumnNotNull={newColumnNotNull}
            onNewColumnNotNullChange={setNewColumnNotNull}
            onAddColumn={() => void handleAddColumn()}
            renameColumnFrom={renameColumnFrom}
            onRenameColumnFromChange={setRenameColumnFrom}
            renameColumnTo={renameColumnTo}
            onRenameColumnToChange={setRenameColumnTo}
            renameColumnToError={renameColumnToError}
            onRenameColumn={() => void handleRenameColumn()}
            newIndexName={newIndexName}
            onNewIndexNameChange={setNewIndexName}
            newIndexNameError={newIndexNameError}
            newIndexUnique={newIndexUnique}
            onNewIndexUniqueChange={setNewIndexUnique}
            newIndexColumns={newIndexColumns}
            onToggleIndexColumn={toggleIndexColumn}
            selectedCreateIndexColumnsCount={selectedCreateIndexColumns.length}
            createIndexColumnsError={createIndexColumnsError}
            onCreateIndex={() => void handleCreateIndex()}
            dropIndexName={dropIndexName}
            onDropIndexNameChange={setDropIndexName}
            dropIndexConfirm={dropIndexConfirm}
            onDropIndexConfirmChange={setDropIndexConfirm}
            onDropIndex={() => void handleDropIndex()}
            dropColumnName={dropColumnName}
            onDropColumnNameChange={setDropColumnName}
            dropConfirm={dropConfirm}
            onDropConfirmChange={setDropConfirm}
            onDropColumn={() => void handleDropColumn()}
          />

          <EditTableSchemaSidebar
            loadingColumns={loadingColumns}
            columns={columns}
            indexes={indexes}
          />
        </div>
      </div>
    </div>
  );
}
