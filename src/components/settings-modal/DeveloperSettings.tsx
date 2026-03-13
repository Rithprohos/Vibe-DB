import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { getTableStructure, insertRows } from '@/lib/db';
import {
  buildSampleDataRowBatch,
  getInsertableColumns,
  SAMPLE_DATA_ROWS_PER_BATCH,
} from '@/lib/sampleData';
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
  const [cancelRequested, setCancelRequested] = useState(false);
  const [progressRowsInserted, setProgressRowsInserted] = useState(0);
  const [progressTotalRows, setProgressTotalRows] = useState(0);
  const [progressCompletedBatches, setProgressCompletedBatches] = useState(0);
  const [progressTotalBatches, setProgressTotalBatches] = useState(0);
  const [tableStructure, setTableStructure] = useState<Awaited<ReturnType<typeof getTableStructure>> | null>(null);
  const [structureError, setStructureError] = useState('');
  const cancelRequestedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(
    () => () => {
      isMountedRef.current = false;
      cancelRequestedRef.current = true;
    },
    [],
  );

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
    setCancelRequested(false);
    setProgressRowsInserted(0);
    setProgressTotalRows(resolvedRowCount);
    setProgressCompletedBatches(0);
    setProgressTotalBatches(Math.ceil(resolvedRowCount / SAMPLE_DATA_ROWS_PER_BATCH));
    cancelRequestedRef.current = false;

    try {
      const columns = tableStructure?.columns ?? [];
      let insertedRows = 0;

      for (
        let start = 0;
        start < resolvedRowCount && !cancelRequestedRef.current;
        start += SAMPLE_DATA_ROWS_PER_BATCH
      ) {
        const batchSize = Math.min(SAMPLE_DATA_ROWS_PER_BATCH, resolvedRowCount - start);
        const rows = buildSampleDataRowBatch(columns, start + 1, batchSize);
        const result = await insertRows(selectedTable, rows, activeConnection.connId);
        insertedRows += result.rows_affected ?? batchSize;

        if (!isMountedRef.current) {
          return;
        }

        setProgressRowsInserted(Math.min(insertedRows, resolvedRowCount));
        setProgressCompletedBatches((current) => current + 1);
      }

      if (cancelRequestedRef.current) {
        showAlert({
          title: 'Sample data generation cancelled',
          message: `Inserted ${insertedRows.toLocaleString()} rows into ${selectedTable} before cancellation.`,
          type: 'warning',
        });
      } else {
        showAlert({
          title: 'Sample data generated',
          message: `Inserted ${insertedRows.toLocaleString()} rows into ${selectedTable}.`,
          type: 'success',
        });
        setConfirmInsert(false);
      }
    } catch (error) {
      console.error('Failed to generate sample data:', error);
      showAlert({
        title: 'Sample data generation failed',
        message: error instanceof Error ? error.message : 'The insert transaction did not complete.',
        type: 'error',
      });
    } finally {
      if (isMountedRef.current) {
        setRunningInsert(false);
        setCancelRequested(false);
      }
      cancelRequestedRef.current = false;
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
  const handleCancelGenerate = useCallback(() => {
    if (!runningInsert || cancelRequestedRef.current) return;
    cancelRequestedRef.current = true;
    setCancelRequested(true);
  }, [runningInsert]);

  const canGenerate =
    developerToolsEnabled &&
    !!activeConnection?.connId &&
    !!selectedTable &&
    resolvedRowCount > 0 &&
    insertableColumns.length > 0 &&
    confirmInsert &&
    !loadingStructure &&
    !runningInsert;
  const progressPercent = useMemo(() => {
    if (progressTotalRows === 0) return 0;
    return Math.min(100, Math.round((progressRowsInserted / progressTotalRows) * 100));
  }, [progressRowsInserted, progressTotalRows]);

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
                disabled={runningInsert || connectionTables.length === 0}
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
              <Select value={rowCount} onValueChange={setRowCount} disabled={runningInsert}>
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
                disabled={runningInsert || rowCount !== 'custom'}
              />
            </div>
          </div>

          <div className="space-y-1 rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground">
            <div>Insert mode: batched multi-row inserts, one backend transaction per batch.</div>
            <div>Insertable columns: {loadingStructure ? 'Loading...' : insertableColumns.length}</div>
            <div>
              Estimated batches: {resolvedRowCount > 0 ? Math.ceil(resolvedRowCount / SAMPLE_DATA_ROWS_PER_BATCH) : 0}
            </div>
            {structureError ? <div className="text-destructive">{structureError}</div> : null}
          </div>

          {(runningInsert || progressRowsInserted > 0) ? (
            <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground/90">
                  {runningInsert ? 'Generating sample data...' : 'Last generation progress'}
                </span>
                <span className="font-mono text-foreground/80">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-sm bg-secondary/80">
                <div
                  className="h-full bg-primary transition-[width] duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  Rows: {progressRowsInserted.toLocaleString()} / {progressTotalRows.toLocaleString()}
                </span>
                <span>
                  Batches: {progressCompletedBatches} / {progressTotalBatches}
                </span>
              </div>
              {runningInsert && cancelRequested ? (
                <div className="text-[11px] text-warning">
                  Cancel requested. VibeDB will stop after the current batch completes.
                </div>
              ) : null}
            </div>
          ) : null}

          <label className="flex items-start gap-3 rounded-md border border-warning/20 bg-warning/10 p-3">
            <Checkbox
              checked={confirmInsert}
              onCheckedChange={(checked) => setConfirmInsert(checked === true)}
              disabled={runningInsert}
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              I understand this writes synthetic rows into the selected table on the active
              database connection.
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleGenerate()} disabled={!canGenerate} className="w-full sm:w-auto">
              {runningInsert ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <FlaskConical size={14} className="mr-2" />
              )}
              {runningInsert ? 'Generating...' : 'Generate Sample Data'}
            </Button>
            {runningInsert ? (
              <Button
                variant="destructive"
                onClick={handleCancelGenerate}
                disabled={cancelRequested}
                className="w-full sm:w-auto"
              >
                {cancelRequested ? 'Cancelling...' : 'Cancel Generation'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
