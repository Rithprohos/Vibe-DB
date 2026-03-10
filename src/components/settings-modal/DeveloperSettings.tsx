import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlaskConical, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { executeTransaction, getTableStructure } from '@/lib/db';
import { buildSampleDataTransaction, getInsertableColumns } from '@/lib/sampleData';
import { useAppStore } from '@/store/useAppStore';
import { rowCountOptions } from './constants';

export function DeveloperSettings() {
  const developerToolsEnabled = useAppStore((state) => state.developerToolsEnabled);
  const activeSidebarConnectionId = useAppStore((state) => state.activeSidebarConnectionId);
  const connections = useAppStore((state) => state.connections);
  const tablesByConnection = useAppStore((state) => state.tablesByConnection);
  const showAlert = useAppStore((state) => state.showAlert);

  const activeConnection = useMemo(
    () =>
      connections.find((connection) => connection.id === activeSidebarConnectionId) ?? null,
    [connections, activeSidebarConnectionId],
  );
  const connectionTables = useMemo(
    () => (activeSidebarConnectionId ? tablesByConnection[activeSidebarConnectionId] ?? [] : []),
    [activeSidebarConnectionId, tablesByConnection],
  );

  const [selectedTable, setSelectedTable] = useState('');
  const [rowCount, setRowCount] = useState('1000');
  const [customRowCount, setCustomRowCount] = useState('');
  const [confirmInsert, setConfirmInsert] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [runningInsert, setRunningInsert] = useState(false);
  const [tableStructure, setTableStructure] = useState<Awaited<ReturnType<typeof getTableStructure>> | null>(null);
  const [structureError, setStructureError] = useState('');

  useEffect(() => {
    setSelectedTable((current) => {
      if (!connectionTables.some((table) => table.name === current)) {
        return connectionTables[0]?.name ?? '';
      }
      return current;
    });
  }, [connectionTables]);

  useEffect(() => {
    let cancelled = false;

    const loadStructure = async () => {
      if (!selectedTable || !activeConnection?.connId) {
        setTableStructure(null);
        setStructureError('');
        return;
      }

      setLoadingStructure(true);
      setStructureError('');

      try {
        const nextStructure = await getTableStructure(selectedTable, activeConnection.connId);
        if (!cancelled) {
          setTableStructure(nextStructure);
        }
      } catch (error) {
        console.error('Failed to load table structure:', error);
        if (!cancelled) {
          setTableStructure(null);
          setStructureError('Failed to inspect the selected table.');
        }
      } finally {
        if (!cancelled) {
          setLoadingStructure(false);
        }
      }
    };

    void loadStructure();

    return () => {
      cancelled = true;
    };
  }, [selectedTable, activeConnection?.connId]);

  const insertableColumns = useMemo(() => getInsertableColumns(tableStructure?.columns ?? []), [tableStructure]);
  const resolvedRowCount = useMemo(() => {
    const source = rowCount === 'custom' ? customRowCount : rowCount;
    const parsed = Number.parseInt(source, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [rowCount, customRowCount]);

  const handleGenerate = useCallback(async () => {
    if (!developerToolsEnabled || !activeConnection?.connId || !selectedTable) {
      return;
    }
    if (!confirmInsert || resolvedRowCount <= 0 || insertableColumns.length === 0) {
      return;
    }

    setRunningInsert(true);
    try {
      const queries = buildSampleDataTransaction(selectedTable, tableStructure?.columns ?? [], resolvedRowCount);
      const result = await executeTransaction(queries, activeConnection.connId);
      showAlert({
        title: 'Sample data generated',
        message: result.message || `Inserted ${resolvedRowCount} rows into ${selectedTable}.`,
        type: 'success',
      });
      setConfirmInsert(false);
    } catch (error) {
      console.error('Failed to generate sample data:', error);
      showAlert({
        title: 'Sample data generation failed',
        message: error instanceof Error ? error.message : 'The insert transaction did not complete.',
        type: 'error',
      });
    } finally {
      setRunningInsert(false);
    }
  }, [
    developerToolsEnabled,
    activeConnection?.connId,
    selectedTable,
    confirmInsert,
    resolvedRowCount,
    insertableColumns.length,
    tableStructure,
    showAlert,
  ]);

  const canGenerate =
    developerToolsEnabled &&
    !!activeConnection?.connId &&
    !!selectedTable &&
    resolvedRowCount > 0 &&
    insertableColumns.length > 0 &&
    confirmInsert &&
    !loadingStructure &&
    !runningInsert;

  if (!developerToolsEnabled) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="mt-0.5 text-warning" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Developer tools are disabled
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Enable Developer Tools from General settings before using sample data generation in
                production builds.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 text-sm font-semibold text-foreground">Sample Data Generator</h3>
        <div className="space-y-4 rounded-lg border border-border bg-secondary/30 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sample-connection">Connection</Label>
              <div
                id="sample-connection"
                className="flex h-9 items-center rounded-md border border-input bg-background/50 px-3 text-sm text-foreground"
              >
                {activeConnection?.name ?? 'No active connection'}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sample-table">Target Table</Label>
              <Select
                value={selectedTable}
                onValueChange={setSelectedTable}
                disabled={connectionTables.length === 0}
              >
                <SelectTrigger id="sample-table">
                  <SelectValue placeholder="Select a table" />
                </SelectTrigger>
                <SelectContent>
                  {connectionTables.map((table) => (
                    <SelectItem key={table.name} value={table.name}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
            <div className="space-y-2">
              <Label htmlFor="sample-row-count">Rows to insert</Label>
              <Select value={rowCount} onValueChange={setRowCount}>
                <SelectTrigger id="sample-row-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rowCountOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {Number(option).toLocaleString()} rows
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sample-custom-count">Custom rows</Label>
              <Input
                id="sample-custom-count"
                type="number"
                min={1}
                step={1}
                value={customRowCount}
                onChange={(event) => setCustomRowCount(event.target.value)}
                placeholder="500"
                disabled={rowCount !== 'custom'}
              />
            </div>
          </div>

          <div className="space-y-1 rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground">
            <div>Insert mode: batched multi-row inserts inside a single transaction.</div>
            <div>Insertable columns: {loadingStructure ? 'Loading...' : insertableColumns.length}</div>
            <div>Estimated batches: {resolvedRowCount > 0 ? Math.ceil(resolvedRowCount / 200) : 0}</div>
            {structureError ? <div className="text-destructive">{structureError}</div> : null}
          </div>

          <label className="flex items-start gap-3 rounded-md border border-warning/20 bg-warning/10 p-3">
            <Checkbox
              checked={confirmInsert}
              onCheckedChange={(checked) => setConfirmInsert(checked === true)}
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              I understand this writes synthetic rows into the selected table on the active
              database connection.
            </span>
          </label>

          <Button onClick={() => void handleGenerate()} disabled={!canGenerate} className="w-full sm:w-auto">
            {runningInsert ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <FlaskConical size={14} className="mr-2" />
            )}
            Generate Sample Data
          </Button>
        </div>
      </div>
    </div>
  );
}
