import { useCallback, useEffect, useMemo, useState } from 'react';
import { Save, Loader2, AlertCircle, TableIcon } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  buildCreateTableSQL,
  executeQuery,
  getTableStructure,
  listTables,
} from '../lib/db';
import { validateTableName } from '../lib/tableName';
import {
  canUseAutoIncrement,
  createDefaultIdColumn,
  createEmptyCheckConstraint,
  createEmptyColumn,
  createEmptyForeignKey,
  DEFAULT_TABLE_NAME,
  getDataTypesForEngine,
  getEngineTypeLabel,
  normalizeTypeParams,
  type CheckConstraint,
  type ColumnDef,
  type ForeignKeyConstraint,
} from '../lib/createTableConstants';
import { ColumnsSection } from './create-table/ColumnsSection';
import {
  ConstraintsSection,
  type ExpandedConstraintSections,
} from './create-table/ConstraintsSection';
import { useCreateTableSqlPreview } from './create-table/useCreateTableSqlPreview';
import {
  getInvalidColumnNameError,
  getInvalidTypeParamsError,
  getLiveColumnNameErrors,
  getLiveConstraintError,
} from './create-table/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Props {
  tabId: string;
}

const DEFAULT_EXPANDED_SECTIONS: ExpandedConstraintSections = {
  foreignKeys: false,
  checkConstraints: false,
};

export default function CreateTable({ tabId }: Props) {
  const tabs = useAppStore((state) => state.tabs);
  const connections = useAppStore((state) => state.connections);
  const tablesByConnection = useAppStore((state) => state.tablesByConnection);
  const setTables = useAppStore((state) => state.setTables);
  const updateTab = useAppStore((state) => state.updateTab);
  const openTableTab = useAppStore((state) => state.openTableTab);
  const closeTab = useAppStore((state) => state.closeTab);

  const tab = useMemo(() => tabs.find((item) => item.id === tabId), [tabs, tabId]);
  const activeConnection = useMemo(
    () => connections.find((connection) => connection.id === tab?.connectionId),
    [connections, tab?.connectionId],
  );
  const connId = activeConnection?.connId;
  const engineType = activeConnection?.type ?? 'sqlite';
  const engineDataTypes = useMemo(() => getDataTypesForEngine(engineType), [engineType]);
  const engineTypeLabel = useMemo(() => getEngineTypeLabel(engineType), [engineType]);

  const [tableName, setTableName] = useState(DEFAULT_TABLE_NAME);
  const [columns, setColumns] = useState<ColumnDef[]>([createDefaultIdColumn()]);
  const [ifNotExists, setIfNotExists] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyConstraint[]>([]);
  const [checkConstraints, setCheckConstraints] = useState<CheckConstraint[]>([]);
  const [referenceColumnsByTable, setReferenceColumnsByTable] = useState<
    Record<string, string[]>
  >({});
  const [loadingReferenceColumnsByTable, setLoadingReferenceColumnsByTable] =
    useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState(DEFAULT_EXPANDED_SECTIONS);

  const referenceTableOptions = useMemo(() => {
    if (!activeConnection) {
      return [];
    }

    const seenNames = new Set<string>();
    return (tablesByConnection[activeConnection.id] ?? [])
      .filter((table) => table.table_type === 'table')
      .map((table) => table.name.trim())
      .filter((name) => {
        if (!name || seenNames.has(name)) {
          return false;
        }
        seenNames.add(name);
        return true;
      })
      .sort((left, right) => left.localeCompare(right));
  }, [activeConnection, tablesByConnection]);

  const validColumnCount = useMemo(
    () => columns.filter((column) => column.name.trim()).length,
    [columns],
  );
  const namedColumnNames = useMemo(
    () => new Set(columns.map((column) => column.name.trim()).filter(Boolean)),
    [columns],
  );
  const liveTableNameError = useMemo(() => {
    if (!tableName.trim()) {
      return null;
    }
    return validateTableName(tableName);
  }, [tableName]);
  const liveColumnNameErrors = useMemo(() => getLiveColumnNameErrors(columns), [columns]);
  const liveTypeParamsError = useMemo(() => getInvalidTypeParamsError(columns), [columns]);
  const liveConstraintError = useMemo(
    () =>
      getLiveConstraintError({
        foreignKeys,
        checkConstraints,
        namedColumnNames,
      }),
    [foreignKeys, checkConstraints, namedColumnNames],
  );

  const sql = useCreateTableSqlPreview({
    showPreview,
    tableName,
    columns,
    ifNotExists,
    engineType,
    foreignKeys,
    checkConstraints,
    liveConstraintError,
  });

  const updateColumn = useCallback(
    (id: string, updates: Partial<ColumnDef>) => {
      setColumns((previous) =>
        previous.map((column) => {
          if (column.id !== id) {
            return column;
          }
          const nextColumn = { ...column, ...updates };
          if ('type' in updates) {
            nextColumn.typeParams = normalizeTypeParams(nextColumn.type, nextColumn.typeParams);
            if (nextColumn.autoIncrement && !canUseAutoIncrement(engineType, nextColumn.type)) {
              nextColumn.autoIncrement = false;
            }
          }
          if (updates.autoIncrement && nextColumn.autoIncrement) {
            nextColumn.primaryKey = true;
            if (!canUseAutoIncrement(engineType, nextColumn.type)) {
              nextColumn.type = 'INTEGER';
              nextColumn.typeParams = undefined;
            }
          }
          if ('primaryKey' in updates && !updates.primaryKey) {
            nextColumn.autoIncrement = false;
          }
          return nextColumn;
        }),
      );
      setError('');
    },
    [engineType],
  );

  const addColumn = useCallback(() => {
    setColumns((previous) => [...previous, createEmptyColumn()]);
  }, []);

  const removeColumn = useCallback((id: string) => {
    setColumns((previous) => {
      if (previous.length <= 1) {
        return previous;
      }
      return previous.filter((column) => column.id !== id);
    });
  }, []);

  const movePk = useCallback((targetId: string) => {
    setColumns((previous) =>
      previous.map((column) => ({
        ...column,
        primaryKey: column.id === targetId,
        autoIncrement: column.id === targetId ? column.autoIncrement : false,
      })),
    );
  }, []);

  const toggleSection = useCallback((section: keyof ExpandedConstraintSections) => {
    setExpandedSections((previous) => ({ ...previous, [section]: !previous[section] }));
  }, []);

  const addForeignKey = useCallback(() => {
    setForeignKeys((previous) => [...previous, createEmptyForeignKey()]);
    setExpandedSections((previous) => ({ ...previous, foreignKeys: true }));
  }, []);

  const updateForeignKey = useCallback(
    (id: string, updates: Partial<ForeignKeyConstraint>) => {
      setForeignKeys((previous) =>
        previous.map((foreignKey) => {
          if (foreignKey.id !== id) {
            return foreignKey;
          }

          const nextForeignKey = { ...foreignKey, ...updates };
          if (
            typeof updates.referencedTable === 'string' &&
            updates.referencedTable !== foreignKey.referencedTable
          ) {
            nextForeignKey.referencedColumn = '';
          }

          const trimmedReferencedTable = nextForeignKey.referencedTable.trim();
          const trimmedReferencedColumn = nextForeignKey.referencedColumn.trim();
          const tableColumns = referenceColumnsByTable[trimmedReferencedTable];
          if (
            trimmedReferencedTable &&
            trimmedReferencedColumn &&
            tableColumns &&
            !tableColumns.includes(trimmedReferencedColumn)
          ) {
            nextForeignKey.referencedColumn = '';
          }

          return nextForeignKey;
        }),
      );
    },
    [referenceColumnsByTable],
  );

  const removeForeignKey = useCallback((id: string) => {
    setForeignKeys((previous) => previous.filter((foreignKey) => foreignKey.id !== id));
  }, []);

  const addCheckConstraint = useCallback(() => {
    setCheckConstraints((previous) => [...previous, createEmptyCheckConstraint()]);
    setExpandedSections((previous) => ({ ...previous, checkConstraints: true }));
  }, []);

  const updateCheckConstraint = useCallback((id: string, updates: Partial<CheckConstraint>) => {
    setCheckConstraints((previous) =>
      previous.map((constraint) => (constraint.id === id ? { ...constraint, ...updates } : constraint)),
    );
  }, []);

  const removeCheckConstraint = useCallback((id: string) => {
    setCheckConstraints((previous) => previous.filter((constraint) => constraint.id !== id));
  }, []);

  const handleTogglePreview = useCallback(() => {
    setShowPreview((previous) => !previous);
  }, []);

  const handleCancel = useCallback(() => {
    closeTab(tabId);
  }, [closeTab, tabId]);

  const fetchReferenceTableColumns = useCallback(
    async (referencedTable: string) => {
      const tableName = referencedTable.trim();
      if (!connId || !tableName) {
        return;
      }
      if (referenceColumnsByTable[tableName] || loadingReferenceColumnsByTable[tableName]) {
        return;
      }

      setLoadingReferenceColumnsByTable((previous) => ({ ...previous, [tableName]: true }));
      try {
        const structure = await getTableStructure(tableName, connId);
        const columnNames = Array.from(
          new Set(
            structure.columns
              .map((column) => column.name.trim())
              .filter(Boolean),
          ),
        );
        setReferenceColumnsByTable((previous) => ({ ...previous, [tableName]: columnNames }));
      } catch (unknownError) {
        console.error(`Failed to load columns for referenced table "${tableName}"`, unknownError);
        setReferenceColumnsByTable((previous) => ({ ...previous, [tableName]: [] }));
      } finally {
        setLoadingReferenceColumnsByTable((previous) => {
          const next = { ...previous };
          delete next[tableName];
          return next;
        });
      }
    },
    [connId, loadingReferenceColumnsByTable, referenceColumnsByTable],
  );

  useEffect(() => {
    setReferenceColumnsByTable({});
    setLoadingReferenceColumnsByTable({});
  }, [connId]);

  useEffect(() => {
    if (!connId || !activeConnection) {
      return;
    }

    let cancelled = false;
    void listTables(connId)
      .then((tables) => {
        if (cancelled) {
          return;
        }
        setTables(activeConnection.id, tables);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [activeConnection, connId, setTables]);

  useEffect(() => {
    const referencedTables = Array.from(
      new Set(
        foreignKeys
          .map((foreignKey) => foreignKey.referencedTable.trim())
          .filter(Boolean),
      ),
    );
    for (const referencedTable of referencedTables) {
      void fetchReferenceTableColumns(referencedTable);
    }
  }, [fetchReferenceTableColumns, foreignKeys]);

  useEffect(() => {
    setForeignKeys((previous) => {
      let didChange = false;
      const next = previous.map((foreignKey) => {
        const trimmedReferencedTable = foreignKey.referencedTable.trim();
        const trimmedReferencedColumn = foreignKey.referencedColumn.trim();
        if (!trimmedReferencedTable || !trimmedReferencedColumn) {
          return foreignKey;
        }

        const availableColumns = referenceColumnsByTable[trimmedReferencedTable];
        if (!availableColumns || availableColumns.includes(trimmedReferencedColumn)) {
          return foreignKey;
        }

        didChange = true;
        return { ...foreignKey, referencedColumn: '' };
      });

      return didChange ? next : previous;
    });
  }, [referenceColumnsByTable]);

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

    const invalidColumnNameError = getInvalidColumnNameError(columns);
    if (invalidColumnNameError) {
      setError(invalidColumnNameError);
      return;
    }

    if (liveTypeParamsError) {
      setError(liveTypeParamsError);
      return;
    }

    if (liveConstraintError) {
      setError(liveConstraintError);
      return;
    }

    setSaving(true);
    setError('');

    try {
      const sqlToRun = await buildCreateTableSQL(
        tableName,
        columns,
        ifNotExists,
        engineType,
        foreignKeys,
        checkConstraints,
      );
      await executeQuery(sqlToRun, connId);

      const tables = await listTables(connId);
      if (activeConnection) {
        setTables(activeConnection.id, tables);
      }

      updateTab(tabId, { title: `✓ ${tableName}` });
      closeTab(tabId);
      if (activeConnection) {
        openTableTab(activeConnection.id, tableName.trim(), 'data');
      }
    } catch (unknownError: any) {
      setError(unknownError?.toString() || 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [
    activeConnection,
    checkConstraints,
    closeTab,
    columns,
    connId,
    engineType,
    foreignKeys,
    ifNotExists,
    liveConstraintError,
    liveTypeParamsError,
    openTableTab,
    setTables,
    tableName,
    tabId,
    updateTab,
  ]);

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
                onChange={(event) => {
                  setTableName(event.target.value);
                  setError('');
                }}
                className={cn(
                  'bg-background border-border placeholder:text-muted-foreground/40 text-sm font-medium focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary h-9',
                  liveTableNameError &&
                    'border-destructive/70 focus-visible:ring-destructive focus-visible:border-destructive',
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
                onCheckedChange={(value) => setIfNotExists(!!value)}
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

      {error && (
        <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-sm bg-destructive/10 border border-destructive/20 text-destructive text-sm font-mono max-w-6xl">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      <ScrollArea className="flex-1 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <ColumnsSection
            columns={columns}
            engineType={engineType}
            engineDataTypes={engineDataTypes}
            engineTypeLabel={engineTypeLabel}
            liveColumnNameErrors={liveColumnNameErrors}
            showPreview={showPreview}
            sql={sql}
            previewHint={previewHint}
            onTogglePreview={handleTogglePreview}
            onAddColumn={addColumn}
            onUpdateColumn={updateColumn}
            onRemoveColumn={removeColumn}
            onMovePk={movePk}
          />

          <ConstraintsSection
            tableName={tableName}
            columns={columns}
            foreignKeys={foreignKeys}
            checkConstraints={checkConstraints}
            referenceTableOptions={referenceTableOptions}
            referenceColumnsByTable={referenceColumnsByTable}
            loadingReferenceColumnsByTable={loadingReferenceColumnsByTable}
            expandedSections={expandedSections}
            onToggleSection={toggleSection}
            onAddForeignKey={addForeignKey}
            onUpdateForeignKey={updateForeignKey}
            onRemoveForeignKey={removeForeignKey}
            onAddCheckConstraint={addCheckConstraint}
            onUpdateCheckConstraint={updateCheckConstraint}
            onRemoveCheckConstraint={removeCheckConstraint}
          />
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-background/80 backdrop-blur-sm px-6 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {validColumnCount} column{validColumnCount !== 1 ? 's' : ''} defined
            {tableName.trim() && (
              <span className="ml-2">
                · Table:{' '}
                <span className="text-foreground font-medium">{tableName.trim()}</span>
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
              disabled={
                saving ||
                !tableName.trim() ||
                validColumnCount === 0 ||
                Boolean(liveTableNameError) ||
                Object.keys(liveColumnNameErrors).length > 0 ||
                Boolean(liveTypeParamsError) ||
                Boolean(liveConstraintError)
              }
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
