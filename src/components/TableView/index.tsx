import { useMemo, useEffect, useCallback, useRef, useState, startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Loader2, RefreshCw, Plus, Check, X as XIcon, ChevronLeft, ChevronRight, AlertCircle, Filter, Database, Key, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';

import { NewRowTextInput, NewRowDateInput } from './NewRowInputs';
import { useTableData } from './hooks/useTableData';
import { useFilters } from './hooks/useFilters';
import { useNewRow } from './hooks/useNewRow';
import { useCellEditing } from './hooks/useCellEditing';
import type { TableViewProps } from './types';
import { useDevRenderCounter } from '@/lib/dev-performance';
import { VirtualRow } from './TableRows';
import { FilterPanel } from './FilterPanel';
import { RowInspector } from './RowInspector';
import { copyToClipboard } from '@/lib/copy';

const PAGE_SIZE_OPTIONS = ['50', '100', '200', '500'] as const;

export default function TableView({ tableName, tabId }: TableViewProps) {
  useDevRenderCounter('TableView', `${tableName}:${tabId}`);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [commitFlash, setCommitFlash] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const commitFlashTimerRef = useRef<number | null>(null);

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
  } = useFilters(setPage);

  const refreshVisibleData = useCallback(
    () => fetchData(appliedFilters),
    [fetchData, appliedFilters],
  );

  // Trigger data fetching for rows (page/sort/filter)
  useEffect(() => {
    fetchData(appliedFilters);
  }, [fetchData, appliedFilters]);

  // Fetch structure and total count only when filter/connection/table context changes
  useEffect(() => {
    fetchStructure();
    fetchRowCount(appliedFilters);
  }, [fetchStructure, fetchRowCount, appliedFilters]);

  const {
    newRowData,
    setNewRowData,
    saving: savingNewRow,
    error: newRowError,
    handleAddRow,
    handleDiscardNewRow,
    getPendingInsertQuery,
    setError: setNewRowError
  } = useNewRow(
    tableName,
    structure,
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
    structure,
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
    if (tableData.length === 0) {
      setSelectedRowIndex(null);
      return;
    }

    setSelectedRowIndex((current) => {
      if (current === null) return 0;
      return current < tableData.length ? current : tableData.length - 1;
    });
  }, [tableData]);

  const handleInspectRow = useCallback((rowIndex: number) => {
    startTransition(() => {
      setSelectedRowIndex(rowIndex);
      setIsInspectorOpen(true);
    });
  }, []);

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

  const handleCopyField = useCallback(async (columnName: string, value: unknown) => {
    await copyToClipboard(value == null ? '' : String(value), {
      successMessage: `Copied ${columnName}`,
    });
  }, []);

  const columnInfoByName = useMemo(() => {
    const map: Record<string, (typeof structure)[number]> = {};
    structure.forEach((column) => {
      map[column.name] = column;
    });
    return map;
  }, [structure]);

  const handleRefreshAll = useCallback(() => {
    fetchStructure();
    fetchRowCount(appliedFilters);
    fetchData(appliedFilters);
  }, [fetchStructure, fetchRowCount, fetchData, appliedFilters]);

  const commitPendingWithFeedback = useCallback(async () => {
    const activeEdit =
      editingCell && !newRowData
        ? { rowIndex: editingCell.rowIndex, colName: editingCell.colName, value: editValue }
        : undefined;
    let insertQueries: string[] = [];
    if (newRowData) {
      try {
        const insertSql = getPendingInsertQuery();
        if (insertSql) {
          insertQueries = [insertSql];
        }
      } catch (e: any) {
        setNewRowError(e.toString());
        return;
      }
    }

    const didCommit = await handleCommitPendingEdits(activeEdit, insertQueries);
    if (!didCommit) return;
    if (newRowData) {
      handleDiscardNewRow();
    }
    if (commitFlashTimerRef.current) {
      window.clearTimeout(commitFlashTimerRef.current);
    }
    setCommitFlash(true);
    commitFlashTimerRef.current = window.setTimeout(() => setCommitFlash(false), 700);
  }, [editingCell, newRowData, editValue, getPendingInsertQuery, handleCommitPendingEdits, handleDiscardNewRow, setNewRowError]);

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
      setEditValue(String(value ?? ''));
    },
    [editingCell, editValue, handleSaveCell, newRowData, saving, setEditingCell, setEditValue],
  );

  const handleBeginCellEdit = useCallback((rowIndex: number, colName: string, value: unknown) => {
    void beginCellEdit(rowIndex, colName, value);
  }, [beginCellEdit]);

  const handleSaveCellForRow = useCallback((rowIndex: number, colName: string, value: string) => {
    void handleSaveCell(rowIndex, colName, value);
  }, [handleSaveCell]);

  const handleCancelCellEdit = useCallback(() => {
    setEditingCell(null);
  }, [setEditingCell]);

  // Build columns for TanStack Table
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!data) return [];
    
    const cols: ColumnDef<any>[] = [];

    gridCols.forEach((colName) => {
      const columnInfo = columnInfoByName[colName];
      let type = columnInfo?.col_type.toLowerCase() || 'text';
      if (type === 'integer') type = 'int';
      const isPk = columnInfo?.pk;
      
      cols.push({
        accessorKey: colName,
        header: () => (
          <div 
            className="flex flex-col justify-center select-none cursor-pointer group px-2 py-1.5 hover:bg-muted/50 rounded-sm transition-colors w-full h-full overflow-hidden" 
            onClick={() => handleSort(colName)}
          >
            <div className="flex items-center space-x-2 overflow-hidden">
              {isPk && <Key size={10} className="text-amber-500/80 shrink-0" />}
              <span className={cn(
                "text-[11px] tracking-tight truncate shrink-0",
                isPk ? "text-amber-500/90 font-black uppercase" : "font-bold text-foreground/90"
              )}>{colName}</span>
              <span className="text-[9px] font-mono tracking-tight text-primary/40 group-hover:text-primary/70 transition-colors lowercase truncate pt-0.5">
                {type}
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
  }, [data, columnInfoByName, gridCols, sortCol, sortDir, handleSort]);

  const table = useReactTable({
    data: [],
    columns,
    state: {},
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const isResizingTable = table.getState().columnSizingInfo.isResizingColumn;
  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => 34,
    overscan: 6,
    isScrollingResetDelay: 120,
  });
  const isScrolling = rowVirtualizer.isScrolling;

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
      if (commitFlashTimerRef.current) {
        window.clearTimeout(commitFlashTimerRef.current);
      }
    };
  }, []);

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
          {!newRowData && !editingCell && (
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
            {totalRows.toLocaleString()} rows total
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
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          ref={tableScrollRef}
          className="flex-1 relative overflow-auto custom-scrollbar bg-grid-white/[0.02]"
          style={{ contain: 'strict', willChange: 'scroll-position' }}
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
                (() => {
                  const virtualRows = rowVirtualizer.getVirtualItems();
                  const totalSize = rowVirtualizer.getTotalSize();
                  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
                  const paddingBottom =
                    virtualRows.length > 0
                      ? totalSize - virtualRows[virtualRows.length - 1].end
                      : 0;

                  return (
                    <>
                      {paddingTop > 0 && (
                        <tr>
                          <td colSpan={columns.length} style={{ height: `${paddingTop}px`, padding: 0 }} />
                        </tr>
                      )}

                      {virtualRows.map((virtualRow) => {
                        const rowData = tableData[virtualRow.index];
                        return (
                          <VirtualRow
                            key={`row-${virtualRow.index}`}
                            rowIndex={virtualRow.index}
                            rowData={rowData}
                            gridCols={gridCols}
                            isSelected={selectedRowIndex === virtualRow.index}
                            editingCell={editingCell}
                            editValue={editValue}
                            saving={saving}
                            columnInfoByName={columnInfoByName}
                            isScrolling={isScrolling}
                            getPendingCellValue={getPendingCellValue}
                            isCellPending={isCellPending}
                            onBeginEdit={handleBeginCellEdit}
                            onSaveCell={handleSaveCellForRow}
                            onCancelEdit={handleCancelCellEdit}
                            onEditValueChange={setEditValue}
                            onInspectRow={handleInspectRow}
                          />
                        );
                      })}

                      {paddingBottom > 0 && (
                        <tr>
                          <td colSpan={columns.length} style={{ height: `${paddingBottom}px`, padding: 0 }} />
                        </tr>
                      )}
                    </>
                  );
                })()
              )}
              </tbody>
            </table>
          </div>
        </div>

        <RowInspector
          isOpen={isInspectorOpen}
          gridCols={gridCols}
          selectedRowData={selectedRowData}
          columnInfoByName={columnInfoByName}
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
    </div>
  );
}
