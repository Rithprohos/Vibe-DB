import { useMemo, useEffect, useCallback, useRef, useState, startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, RefreshCw, Plus, Check, X as XIcon, ChevronLeft, ChevronRight, AlertCircle, Filter, Database, Hash, Key, PanelRightOpen, PanelRightClose, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import type { CheckedState } from '@radix-ui/react-checkbox';

import { NewRowTextInput, NewRowDateInput } from './NewRowInputs';
import { useTableData } from './hooks/useTableData';
import { useFilters } from './hooks/useFilters';
import { useNewRow } from './hooks/useNewRow';
import { useCellEditing } from './hooks/useCellEditing';
import { useDeleteRows } from './hooks/useDeleteRows';
import type { TableViewProps } from './types';
import { useDevRenderCounter } from '@/lib/dev-performance';
import { VirtualizedTableBody } from './TableRows';
import { FilterPanel } from './FilterPanel';
import { RowInspector } from './RowInspector';
import { copyToClipboard } from '@/lib/copy';
import { Checkbox } from '@/components/ui/checkbox';
import { stringifyCellValue } from '@/lib/formatters';
import { formatColumnTypeDisplay } from '@/lib/typeDisplay';

const PAGE_SIZE_OPTIONS = ['50', '100', '200', '500'] as const;
const QUERY_REFRESH_DEBOUNCE_MS = 250;

export default function TableView({ tableName, tabId }: TableViewProps) {
  useDevRenderCounter('TableView', `${tableName}:${tabId}`);
  const cachedState = useMemo(
    () => useAppStore.getState().tableViewStateByTabId[tabId],
    [tabId],
  );
  const updateTableViewState = useAppStore((s) => s.updateTableViewState);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [commitFlash, setCommitFlash] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(
    () => cachedState?.isInspectorOpen ?? false,
  );
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(
    () => cachedState?.selectedRowIndex ?? null,
  );
  const [checkedRowIndices, setCheckedRowIndices] = useState<Set<number>>(() => new Set());
  const commitFlashTimerRef = useRef<number | null>(null);
  const dataRefreshTimerRef = useRef<number | null>(null);
  const metadataRefreshTimerRef = useRef<number | null>(null);

  const {
    data,
    loading,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalRows,
    totalPages,
    structure,
    sortCol,
    sortDir,
    gridCols,
    tableData,
    fetchStructure,
    fetchRowCount,
    fetchData,
    handleSort,
    activeConnection
  } = useTableData(tableName, tabId);

  const {
    showFilterPanel,
    setShowFilterPanel,
    filters,
    appliedFilters,
    activeFilterCount,
    handleAddFilter,
    handleUpdateFilter,
    handleRemoveFilter,
    handleApplyFilters,
    handleClearAllFilters
  } = useFilters(tabId, setPage);

  const skipInitialDataFetchRef = useRef(data !== null);
  const skipInitialMetadataFetchRef = useRef(
    structure !== null && totalRows !== null,
  );
  const tableContextKey = `${activeConnection?.connId ?? 'none'}:${tableName}`;
  const dataRefreshContextRef = useRef<string | null>(tableContextKey);
  const metadataRefreshContextRef = useRef<string | null>(tableContextKey);

  const clearDataRefreshTimer = useCallback(() => {
    if (dataRefreshTimerRef.current !== null) {
      window.clearTimeout(dataRefreshTimerRef.current);
      dataRefreshTimerRef.current = null;
    }
  }, []);

  const clearMetadataRefreshTimer = useCallback(() => {
    if (metadataRefreshTimerRef.current !== null) {
      window.clearTimeout(metadataRefreshTimerRef.current);
      metadataRefreshTimerRef.current = null;
    }
  }, []);

  const handleTableScrollRef = useCallback((node: HTMLDivElement | null) => {
    tableScrollRef.current = node;
    setScrollElement((current) => (current === node ? current : node));
  }, []);

  const refreshVisibleData = useCallback(
    () => {
      clearDataRefreshTimer();
      return fetchData(appliedFilters);
    },
    [appliedFilters, clearDataRefreshTimer, fetchData],
  );

  const refreshAfterDelete = useCallback(
    async (deletedRows: number) => {
      clearDataRefreshTimer();
      clearMetadataRefreshTimer();

      if (deletedRows <= 0) {
        await fetchData(appliedFilters);
        return;
      }

      const nextTotalRows = await fetchRowCount(appliedFilters);
      if (nextTotalRows === null) {
        await fetchData(appliedFilters);
        return;
      }

      const maxPage = Math.max(0, Math.ceil(nextTotalRows / pageSize) - 1);
      if (page > maxPage) {
        setPage(maxPage);
        return;
      }

      await fetchData(appliedFilters);
    },
    [
      appliedFilters,
      clearDataRefreshTimer,
      clearMetadataRefreshTimer,
      fetchData,
      fetchRowCount,
      page,
      pageSize,
      setPage,
    ],
  );

  useEffect(() => {
    if (skipInitialDataFetchRef.current) {
      skipInitialDataFetchRef.current = false;
      return;
    }

    const contextChanged = dataRefreshContextRef.current !== tableContextKey;
    dataRefreshContextRef.current = tableContextKey;

    clearDataRefreshTimer();

    if (data === null || contextChanged) {
      void fetchData(appliedFilters);
      return;
    }

    dataRefreshTimerRef.current = window.setTimeout(() => {
      dataRefreshTimerRef.current = null;
      void fetchData(appliedFilters);
    }, QUERY_REFRESH_DEBOUNCE_MS);

    return clearDataRefreshTimer;
  }, [
    appliedFilters,
    clearDataRefreshTimer,
    fetchData,
    page,
    pageSize,
    sortCol,
    sortDir,
    tableContextKey,
  ]);

  useEffect(() => {
    if (skipInitialMetadataFetchRef.current) {
      skipInitialMetadataFetchRef.current = false;
      return;
    }

    const contextChanged = metadataRefreshContextRef.current !== tableContextKey;
    metadataRefreshContextRef.current = tableContextKey;

    clearMetadataRefreshTimer();

    const runMetadataRefresh = () =>
      Promise.all([
        fetchStructure(),
        fetchRowCount(appliedFilters),
      ]);

    if (structure === null || totalRows === null || contextChanged) {
      void runMetadataRefresh();
      return;
    }

    metadataRefreshTimerRef.current = window.setTimeout(() => {
      metadataRefreshTimerRef.current = null;
      void runMetadataRefresh();
    }, QUERY_REFRESH_DEBOUNCE_MS);

    return clearMetadataRefreshTimer;
  }, [
    appliedFilters,
    clearMetadataRefreshTimer,
    fetchRowCount,
    fetchStructure,
    tableContextKey,
  ]);

  const columnInfos = useMemo(() => structure?.columns ?? [], [structure]);

  const {
    newRowData,
    setNewRowData,
    saving: savingNewRow,
    error: newRowError,
    handleAddRow,
    handleDiscardNewRow,
    handleSaveNewRow,
    setError: setNewRowError
  } = useNewRow(
    tableName,
    columnInfos,
    activeConnection,
    refreshVisibleData,
  );

  const {
    editingCell,
    setEditingCell,
    editValue,
    setEditValue,
    saving: savingCell,
    error: cellError,
    pendingEditCount,
    getPendingCellValue,
    isCellPending,
    handleSaveCell,
    handleCommitPendingEdits,
    clearPendingEdits,
    setError: setCellError
  } = useCellEditing(
    tableName,
    columnInfos,
    activeConnection,
    tableData,
    refreshVisibleData,
  );

  const saving = savingNewRow || savingCell;
  const error = newRowError || cellError;

  const selectedRowData = useMemo(
    () => (selectedRowIndex !== null ? tableData[selectedRowIndex] ?? null : null),
    [selectedRowIndex, tableData],
  );

  useEffect(() => {
    updateTableViewState(tabId, {
      isInspectorOpen,
      selectedRowIndex,
    });
  }, [tabId, isInspectorOpen, selectedRowIndex, updateTableViewState]);

  useEffect(() => {
    if (tableData.length === 0) {
      setSelectedRowIndex(null);
      return;
    }

    setSelectedRowIndex((current: number | null) => {
      if (current === null) return 0;
      return current < tableData.length ? current : tableData.length - 1;
    });
  }, [tableData]);

  const toggleInspector = useCallback(() => {
    startTransition(() => {
      setIsInspectorOpen((current) => {
        const next = !current;
        if (next && selectedRowIndex === null && tableData.length > 0) {
          setSelectedRowIndex(0);
        }
        return next;
      });
    });
  }, [selectedRowIndex, tableData.length]);

  const checkedRowCount = checkedRowIndices.size;
  const allRowsChecked = tableData.length > 0 && checkedRowCount === tableData.length;
  const someRowsChecked = checkedRowCount > 0 && !allRowsChecked;

  useEffect(() => {
    setCheckedRowIndices((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set<number>();
      prev.forEach((rowIndex) => {
        if (rowIndex >= 0 && rowIndex < tableData.length) {
          next.add(rowIndex);
        }
      });
      return next.size === prev.size ? prev : next;
    });
  }, [tableData]);

  const handleToggleRowChecked = useCallback((rowIndex: number, nextChecked: boolean) => {
    setCheckedRowIndices((prev) => {
      const alreadyChecked = prev.has(rowIndex);
      if (alreadyChecked === nextChecked) return prev;
      const next = new Set(prev);
      if (nextChecked) {
        next.add(rowIndex);
      } else {
        next.delete(rowIndex);
      }
      return next;
    });
  }, []);

  const handleToggleAllRowsChecked = useCallback((nextState: CheckedState) => {
    const shouldCheckAll = nextState === true;
    setCheckedRowIndices((prev) => {
      if (!shouldCheckAll) {
        return prev.size === 0 ? prev : new Set();
      }
      if (tableData.length === 0 || prev.size === tableData.length) return prev;
      return new Set(Array.from({ length: tableData.length }, (_, index) => index));
    });
  }, [tableData.length]);

  const handleCopyField = useCallback(async (columnName: string, value: unknown) => {
    await copyToClipboard(stringifyCellValue(value, { prettyJson: true }), {
      successMessage: `Copied ${columnName}`,
    });
  }, []);

  const columnInfoByName = useMemo(() => {
    const map: Record<string, (typeof columnInfos)[number]> = {};
    columnInfos.forEach((column) => {
      map[column.name] = column;
    });
    return map;
  }, [columnInfos]);

  const indexMetaByColumnName = useMemo(() => {
    const map: Record<string, { unique: boolean; names: string[] }> = {};
    const indexes = structure?.indexes ?? [];
    indexes.forEach((index) => {
      index.columns.forEach((columnName) => {
        const existing = map[columnName];
        if (existing) {
          existing.unique = existing.unique || index.unique;
          existing.names.push(index.name);
          return;
        }
        map[columnName] = {
          unique: index.unique,
          names: [index.name],
        };
      });
    });
    return map;
  }, [structure?.indexes]);

  const handleRefreshAll = useCallback(() => {
    clearDataRefreshTimer();
    clearMetadataRefreshTimer();
    void Promise.all([
      fetchStructure(),
      fetchRowCount(appliedFilters),
      fetchData(appliedFilters),
    ]);
  }, [
    appliedFilters,
    clearDataRefreshTimer,
    clearMetadataRefreshTimer,
    fetchData,
    fetchRowCount,
    fetchStructure,
  ]);

  const commitPendingWithFeedback = useCallback(async () => {
    const activeEdit =
      editingCell && !newRowData
        ? { rowIndex: editingCell.rowIndex, colName: editingCell.colName, value: editValue }
        : undefined;
    let didCommit = false;

    if (activeEdit || pendingEditCount > 0) {
      didCommit = await handleCommitPendingEdits(activeEdit);
    }

    if (newRowData) {
      const didInsert = await handleSaveNewRow();
      didCommit = didCommit || didInsert;
    }

    if (!didCommit) return;

    if (commitFlashTimerRef.current) {
      window.clearTimeout(commitFlashTimerRef.current);
    }
    setCommitFlash(true);
    commitFlashTimerRef.current = window.setTimeout(() => setCommitFlash(false), 700);
  }, [editValue, editingCell, handleCommitPendingEdits, handleSaveNewRow, newRowData, pendingEditCount]);

  const beginCellEdit = useCallback(
    async (rowIndex: number, colName: string, value: unknown) => {
      if (colName === 'rowNum' || saving || newRowData) return;

      if (
        editingCell &&
        (editingCell.rowIndex !== rowIndex || editingCell.colName !== colName)
      ) {
        await handleSaveCell(editingCell.rowIndex, editingCell.colName, editValue);
      }

      setEditingCell({ rowIndex, colName });
      setEditValue(value == null ? '' : stringifyCellValue(value));
    },
    [editingCell, editValue, handleSaveCell, newRowData, saving, setEditingCell, setEditValue],
  );

  const handleBeginCellEdit = useCallback((rowIndex: number, colName: string, value: unknown) => {
    void beginCellEdit(rowIndex, colName, value);
  }, [beginCellEdit]);

  const handleSaveCellForRow = useCallback((rowIndex: number, colName: string, value: string) => {
    void handleSaveCell(rowIndex, colName, value);
  }, [handleSaveCell]);

  const handleSaveFieldFromInspector = useCallback(
    async (rowIndex: number, colName: string, value: string) => {
      await handleSaveCell(rowIndex, colName, value);
    },
    [handleSaveCell],
  );

  const handleCancelCellEdit = useCallback(() => {
    setEditingCell(null);
  }, [setEditingCell]);

  const handleClearCheckedRows = useCallback(() => {
    setCheckedRowIndices(new Set());
  }, []);

  const {
    isDeleting,
    showConfirmDialog,
    selectedCount,
    hasSelection,
    deletePolicy,
    error: deleteError,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
    setError: setDeleteError,
  } = useDeleteRows({
    tableName,
    tableData,
    activeConnection,
    checkedRowIndices,
    onClearChecked: handleClearCheckedRows,
    onRefresh: refreshAfterDelete,
  });

  // Combine errors from cell editing and delete
  useEffect(() => {
    if (deleteError) {
      setCellError(deleteError);
      setDeleteError('');
    }
  }, [deleteError, setCellError, setDeleteError]);

  // Build columns for TanStack Table
  const columns = useMemo<ColumnDef<any>[]>(() => {
    const cols: ColumnDef<any>[] = [];

    cols.push({
      id: '__select__',
      header: () => (
        <div className="h-full min-h-[32px] px-2 py-1.5 flex items-center justify-center">
          <Checkbox
            checked={allRowsChecked ? true : someRowsChecked ? 'indeterminate' : false}
            onCheckedChange={handleToggleAllRowsChecked}
            disabled={tableData.length === 0}
            aria-label={allRowsChecked ? 'Deselect all rows' : 'Select all rows'}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ),
      size: 38,
      minSize: 38,
      maxSize: 38,
      enableResizing: false,
    });

    gridCols.forEach((colName) => {
      const columnInfo = columnInfoByName[colName];
      const typeLabel = formatColumnTypeDisplay(columnInfo?.col_type ?? 'text');
      const isPk = columnInfo?.pk;
      const indexMeta = indexMetaByColumnName[colName];
      const hasIndex = Boolean(indexMeta);
      const indexTooltip = hasIndex
        ? `${indexMeta.unique ? 'Unique index' : 'Index'}: ${indexMeta.names.join(', ')}`
        : undefined;
      
      cols.push({
        accessorKey: colName,
        header: () => (
          <div 
            className="flex flex-col justify-center select-none cursor-pointer group px-2 py-1.5 hover:bg-muted/50 rounded-sm transition-colors w-full h-full overflow-hidden" 
            onClick={() => handleSort(colName)}
          >
            <div className="flex items-center space-x-2 overflow-hidden">
              {isPk && <Key size={10} className="text-amber-500/80 shrink-0" />}
              {hasIndex && !isPk && (
                <span
                  title={indexTooltip}
                  className={cn(
                    'inline-flex shrink-0 items-center justify-center rounded-[3px] border px-1 py-[1px]',
                    indexMeta?.unique
                      ? 'border-primary/45 bg-primary/15 text-primary'
                      : 'border-foreground/25 bg-muted/70 text-foreground/80',
                  )}
                >
                  <Hash size={11} strokeWidth={2.2} />
                </span>
              )}
              <span className={cn(
                "text-[11px] tracking-tight truncate shrink-0",
                isPk ? "text-amber-500/90 font-black uppercase" : "font-bold text-foreground/90"
              )}>{colName}</span>
              <span className="text-[9px] font-mono tracking-tight text-primary/40 group-hover:text-primary/70 transition-colors truncate pt-0.5">
                {typeLabel}
              </span>
              <div className="flex-1" />
              {sortCol === colName && (
                <span className="text-primary text-[10px] shrink-0 opacity-80">
                  {sortDir === 'ASC' ? '▲' : '▼'}
                </span>
              )}
            </div>
          </div>
        ),
        size: 150,
      });
    });

    return cols;
  }, [allRowsChecked, columnInfoByName, gridCols, handleSort, handleToggleAllRowsChecked, indexMetaByColumnName, someRowsChecked, sortCol, sortDir, tableData.length]);

  const table = useReactTable({
    data: [],
    columns,
    state: {},
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const isResizingTable = table.getState().columnSizingInfo.isResizingColumn;

  useEffect(() => {
    if (isResizingTable) {
      document.body.classList.add('select-none', 'cursor-col-resize');
    } else {
      document.body.classList.remove('select-none', 'cursor-col-resize');
    }
    return () => {
      document.body.classList.remove('select-none', 'cursor-col-resize');
    };
  }, [isResizingTable]);

  useEffect(() => {
    return () => {
      clearDataRefreshTimer();
      clearMetadataRefreshTimer();
      if (commitFlashTimerRef.current) {
        window.clearTimeout(commitFlashTimerRef.current);
      }
    };
  }, [clearDataRefreshTimer, clearMetadataRefreshTimer]);

  // Global keyboard shortcuts for saving/discarding
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (saving) return;

      if (e.key === 'Escape') {
        if (newRowData) {
          e.preventDefault();
          handleDiscardNewRow();
        } else if (editingCell) {
          e.preventDefault();
          setEditingCell(null);
        } else if (showFilterPanel) {
          e.preventDefault();
          setShowFilterPanel(false);
        }
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        if (newRowData || editingCell || pendingEditCount > 0) {
          e.preventDefault();
          void commitPendingWithFeedback();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [newRowData, editingCell, saving, editValue, showFilterPanel, pendingEditCount, handleDiscardNewRow, handleSaveCell, commitPendingWithFeedback, setEditingCell, setShowFilterPanel]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground w-full">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary opacity-80" />
        <span className="text-sm font-medium tracking-wide">Loading data...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-secondary/30 backdrop-blur-sm sticky top-0 z-30 min-h-[52px]">
        <div className="flex items-center space-x-2">
          {!newRowData && !editingCell && pendingEditCount === 0 && (
            <Button 
              variant="default" 
              size="sm" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 h-8 font-medium"
              onClick={handleAddRow}
            >
              <Plus size={14} className="mr-1.5" />
              Add Record
            </Button>
          )}

          {(newRowData || editingCell || pendingEditCount > 0) && (
            <div className="flex items-center space-x-2 animate-in slide-in-from-left-2 duration-200">
              <Button 
                variant="default" 
                size="sm" 
                disabled={saving}
                className={cn(
                  "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 h-8 font-bold transition-all",
                  commitFlash && "animate-bounce ring-2 ring-emerald-400/60"
                )}
                onClick={() => {
                  if (newRowData || editingCell || pendingEditCount > 0) void commitPendingWithFeedback();
                }}
              >
                {saving ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Check size={14} className="mr-1.5" />}
                Commit
              </Button>
              <div className="px-2 py-1 bg-background border border-border rounded text-[10px] text-muted-foreground font-mono flex items-center space-x-1 uppercase tracking-tighter">
                <span>⌘</span>
                <span>+</span>
                <span>ENTER</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (newRowData) {
                    handleDiscardNewRow();
                  }
                  if (editingCell) {
                    setEditingCell(null);
                    setEditValue('');
                  }
                  if (pendingEditCount > 0) {
                    clearPendingEdits();
                  }
                }}
              >
                <XIcon size={14} className="mr-1.5" />
                Cancel
              </Button>
            </div>
          )}

          {hasSelection && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {isDeleting ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Trash2 size={14} className="mr-1.5" />}
              Delete {selectedCount > 0 && `(${selectedCount})`}
            </Button>
          )}

          <div className="h-4 w-px bg-border/50 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshAll}
            disabled={loading}
            className="h-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors font-medium px-2.5"
          >
            <RefreshCw size={14} className={cn("mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>

          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={cn(
              "h-8 transition-colors font-medium px-2.5",
              activeFilterCount > 0 || showFilterPanel 
                ? "text-primary bg-primary/10 hover:bg-primary/20" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Filter size={14} className="mr-1.5" />
            Filter
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] h-4 w-4 rounded-full flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleInspector}
            className={cn(
              "h-8 transition-colors font-medium px-2.5",
              isInspectorOpen
                ? "text-primary bg-primary/10 hover:bg-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            {isInspectorOpen ? <PanelRightClose size={14} className="mr-1.5" /> : <PanelRightOpen size={14} className="mr-1.5" />}
            Inspector
          </Button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-[11px] text-muted-foreground/60 font-mono tracking-wider tabular-nums uppercase">
            {activeFilterCount > 0 ? (
              <span className="text-primary font-bold">Filtered: </span>
            ) : null}
            {(totalRows ?? 0).toLocaleString()} rows total
            {checkedRowCount > 0 ? (
              <span className="ml-3 text-primary font-bold">{checkedRowCount.toLocaleString()} selected</span>
            ) : null}
          </div>

          <div className="flex items-center space-x-1.5 pr-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 rounded-md"
              disabled={page === 0 || loading}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <div className="px-2 py-0.5 bg-background border border-border/50 rounded-md text-[11px] font-mono text-muted-foreground min-w-[80px] text-center tabular-nums">
              {page + 1} / {totalPages || 1}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 disabled:opacity-30 rounded-md"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      <FilterPanel
        showFilterPanel={showFilterPanel}
        filters={filters}
        gridCols={gridCols}
        handleAddFilter={handleAddFilter}
        handleUpdateFilter={handleUpdateFilter}
        handleRemoveFilter={handleRemoveFilter}
        handleApplyFilters={handleApplyFilters}
        handleClearAllFilters={handleClearAllFilters}
      />

      {error && (
        <div className="m-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start text-destructive animate-in fade-in zoom-in-95 duration-200">
          <AlertCircle size={16} className="mr-3 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider mb-1">Database Error</p>
            <p className="text-[11px] font-mono leading-relaxed opacity-90">{error}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-destructive hover:bg-destructive/20 rounded-full"
            onClick={() => {
              newRowError ? setNewRowError('') : setCellError('');
            }}
          >
            <Plus size={14} className="rotate-45" />
          </Button>
        </div>
      )}

      {/* Main Table Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <div
          ref={handleTableScrollRef}
          className="flex-1 relative overflow-auto custom-scrollbar bg-grid-white/[0.02]"
          style={{ contain: 'strict', transform: 'translateZ(0)' }}
        >
          <div className="min-w-full inline-block align-middle">
            <table className="w-full border-separate border-spacing-0 table-fixed">
              <thead className="sticky top-0 z-20 bg-background shadow-sm">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="bg-background">
                    {headerGroup.headers.map(header => (
                      <th 
                        key={header.id}
                        className={cn(
                          "relative border-b-2 border-r border-border/60 border-b-border font-normal p-0 align-bottom bg-background",
                          header.column.id === 'rowNum' && "bg-muted/30"
                        )}
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary z-30 transition-colors",
                              header.column.getIsResizing() ? 'bg-primary shadow-glow' : 'bg-transparent'
                            )}
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-background">
              {/* Virtual New Row */}
              {newRowData && (
                <tr className="bg-amber-500/10 hover:bg-amber-500/15 transition-colors border-b border-amber-500/30">
                  <td className="border-r border-border/50 p-0 bg-muted/15" />
                  {gridCols.map((colName) => {
                    const columnInfo = columnInfoByName[colName];
                    const col = table.getColumn(colName);
                    const colType = columnInfo?.col_type.toLowerCase() || 'text';
                    const isAutoGeneratedPk = Boolean(columnInfo?.pk) && colType.includes('int');
                    const isDateCol = colType.includes('date') || colType.includes('time');
                    return (
                      <td 
                        key={colName}
                        style={{ width: col?.getSize() }}
                        className="border-r border-border/50 p-0 relative group"
                      >
                        {isAutoGeneratedPk ? (
                          <div className="h-full min-h-[32px] px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 bg-muted/20 flex items-center">
                            AUTO
                          </div>
                        ) : isDateCol ? (
                          <NewRowDateInput 
                            value={newRowData[colName] || ''} 
                            onChange={(val) => setNewRowData({ ...newRowData, [colName]: val })}
                            placeholder="YYYY-MM-DD"
                          />
                        ) : (
                          <NewRowTextInput
                            placeholder={columnInfo?.dflt_value || 'NULL'}
                            value={newRowData[colName] || ''}
                            onChange={(val) => setNewRowData({ ...newRowData, [colName]: val })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                void commitPendingWithFeedback();
                              } else if (e.key === 'Escape') {
                                handleDiscardNewRow();
                              }
                            }}
                            disabled={saving}
                            autoFocus={colName === gridCols[0]}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}

              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4 opacity-30">
                      <Database size={48} className="text-muted-foreground" />
                      <div className="space-y-1">
                        <p className="text-lg font-semibold tracking-tight">No data found</p>
                        <p className="text-sm">Try refreshing or adjusting your filters</p>
                      </div>
                      <Button variant="outline" onClick={() => fetchData(appliedFilters)} size="sm">
                        <RefreshCw size={14} className="mr-2" /> Reload Table
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <VirtualizedTableBody
                  tableData={tableData}
                  gridCols={gridCols}
                  columnCount={columns.length}
                  columnInfoByName={columnInfoByName}
                  scrollElement={scrollElement}
                  selectedRowIndex={selectedRowIndex}
                  checkedRowIndices={checkedRowIndices}
                  editingCell={editingCell}
                  editValue={editValue}
                  saving={saving}
                  getPendingCellValue={getPendingCellValue}
                  isCellPending={isCellPending}
                  onBeginEdit={handleBeginCellEdit}
                  onSaveCell={handleSaveCellForRow}
                  onCancelEdit={handleCancelCellEdit}
                  onEditValueChange={setEditValue}
                  onSelectRow={setSelectedRowIndex}
                  onToggleRowChecked={handleToggleRowChecked}
                />
              )}
              </tbody>
            </table>
          </div>
        </div>

        <RowInspector
          isOpen={isInspectorOpen}
          gridCols={gridCols}
          selectedRowIndex={selectedRowIndex}
          selectedRowData={selectedRowData}
          columnInfoByName={columnInfoByName}
          getPendingCellValue={getPendingCellValue}
          isCellPending={isCellPending}
          saving={saving}
          onSaveField={handleSaveFieldFromInspector}
          onToggle={toggleInspector}
          onCopyField={handleCopyField}
        />
      </div>

      {/* Footer Info */}
      <div className="p-1 px-3 border-t border-border bg-muted/30 flex items-center justify-between text-[10px] text-muted-foreground/50 font-mono uppercase tracking-widest">
        <div className="flex items-center space-x-3">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
            Connected
          </div>
          <div className="h-2 w-px bg-border/50" />
          <span>{tableName}</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="h-7 w-[88px] border-border/60 bg-background/70 px-2 text-[10px] uppercase tracking-widest text-foreground focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="h-2 w-px bg-border/50" />
        </div>
      </div>

      {/* Production Delete Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={handleCancelDelete}>
        <DialogContent className="max-w-md border-destructive/20">
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <AlertTriangle className="mr-2 h-5 w-5" />
              {deletePolicy.title}
            </DialogTitle>
            <DialogDescription>
              {deletePolicy.description} You are about to delete <strong>{selectedCount}</strong> row{selectedCount !== 1 ? 's' : ''} from
              the <strong>{tableName}</strong> table.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 px-3 bg-destructive/10 rounded border border-destructive/20">
            <p className="text-xs text-destructive/90 font-medium">
              {deletePolicy.warning}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete {selectedCount} Row{selectedCount !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
