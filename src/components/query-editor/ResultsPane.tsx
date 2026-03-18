import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertCircle, CheckCircle2, ChevronsLeftRightEllipsis, Play, Rows3, WrapText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatCellValue } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { QueryResult } from '@/store/useAppStore';

import type { SelectedCell } from './types';

const VIRTUALIZATION_ROW_THRESHOLD = 100;
const DEFAULT_COLUMN_WIDTH = 240;
const MIN_COLUMN_WIDTH = 140;

interface FormattedCell {
  text: string;
  className: string;
  isNumeric: boolean;
}

interface TableCellProps {
  text: string;
  className: string;
  isNumeric: boolean;
  width: number;
  rowIdx: number;
  cellIdx: number;
  isActive: boolean;
  wrapCells: boolean;
  onSelect: (rowIdx: number, cellIdx: number) => void;
}

const TableCell = memo(function TableCell({
  text,
  className,
  isNumeric,
  width,
  rowIdx,
  cellIdx,
  isActive,
  wrapCells,
  onSelect,
}: TableCellProps) {
  return (
    <td
      className={cn(
        'overflow-hidden border-b border-r border-border/50 px-4 py-2.5 align-top last:border-r-0',
        isActive && 'bg-primary/10 outline outline-1 outline-primary/40 -outline-offset-1'
      )}
      style={{ width, minWidth: width, maxWidth: width }}
    >
      <button
        type="button"
        onClick={() => onSelect(rowIdx, cellIdx)}
        className={cn(
          'block w-full overflow-hidden rounded-sm py-0.5 outline-none transition-opacity hover:opacity-100 focus-visible:ring-1 focus-visible:ring-primary/40',
          isNumeric ? 'text-right' : 'text-left'
        )}
        title={text}
      >
        <span
          className={cn(
            'block w-full overflow-hidden',
            wrapCells ? 'whitespace-pre-wrap break-words leading-5' : 'text-ellipsis whitespace-nowrap',
            className
          )}
        >
          {text}
        </span>
      </button>
    </td>
  );
});

interface TableRowProps {
  row: FormattedCell[];
  columnWidths: number[];
  rowIdx: number;
  selectedColumnIndex: number | null;
  wrapCells: boolean;
  onSelectCell: (rowIdx: number, cellIdx: number) => void;
  measureRef?: (node: HTMLElement | null) => void;
}

const TableRow = memo(function TableRow({
  row,
  columnWidths,
  rowIdx,
  selectedColumnIndex,
  wrapCells,
  onSelectCell,
  measureRef,
}: TableRowProps) {
  return (
    <tr
      data-index={rowIdx}
      ref={measureRef}
      className={cn(
        rowIdx % 2 === 0 ? 'bg-background' : 'bg-secondary/12',
        'hover:bg-secondary/30'
      )}
    >
      {row.map((cell, cellIdx) => (
        <TableCell
          key={cellIdx}
          text={cell.text}
          className={cell.className}
          isNumeric={cell.isNumeric}
          width={columnWidths[cellIdx] ?? DEFAULT_COLUMN_WIDTH}
          rowIdx={rowIdx}
          cellIdx={cellIdx}
          isActive={selectedColumnIndex === cellIdx}
          wrapCells={wrapCells}
          onSelect={onSelectCell}
        />
      ))}
    </tr>
  );
});

interface QueryResultsPaneProps {
  result: QueryResult | null;
  error: string;
  duration: number;
  selectedCell: SelectedCell | null;
  wrapCells: boolean;
  onSelectCell: (rowIdx: number, cellIdx: number) => void;
  onToggleWrapCells: () => void;
}

export const QueryResultsPane = memo(function QueryResultsPane({
  result,
  error,
  duration,
  selectedCell,
  wrapCells,
  onSelectCell,
  onToggleWrapCells,
}: QueryResultsPaneProps) {
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const resizeStateRef = useRef<{ columnIndex: number; startX: number; startWidth: number } | null>(null);
  const [resizingColumnIndex, setResizingColumnIndex] = useState<number | null>(null);
  const columnKey = result?.columns.join('\u0000') ?? '';

  const selectedCellDetails = useMemo(() => {
    if (!result || !selectedCell) return null;

    const columnName = result.columns[selectedCell.columnIndex];
    const row = result.rows[selectedCell.rowIndex];
    if (!columnName || !row) return null;

    const rawValue = row[selectedCell.columnIndex];
    const { text, className } = formatCellValue(rawValue, { prettyJson: true });

    return {
      columnName,
      rowNumber: selectedCell.rowIndex + 1,
      rawValue,
      text,
      className,
    };
  }, [result, selectedCell]);

  const hasRows = Boolean(result && result.columns.length > 0);
  const rowCount = result?.rows.length ?? 0;
  const columnCount = result?.columns.length ?? 0;
  const shouldVirtualizeRows = rowCount > VIRTUALIZATION_ROW_THRESHOLD;
  const estimateSize = useCallback(() => (wrapCells ? 72 : 44), [wrapCells]);

  const formattedRows = useMemo<FormattedCell[][]>(
    () =>
      result?.rows.map((row) =>
        row.map((cell) => {
          const formatted = formatCellValue(cell);
          return {
            text: formatted.text,
            className: formatted.className,
            isNumeric: typeof cell === 'number',
          };
        }),
      ) ?? [],
    [result],
  );

  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualizeRows ? rowCount : 0,
    getScrollElement: () => resultsScrollRef.current,
    estimateSize,
    overscan: 10,
  });

  const virtualizerRef = useRef(rowVirtualizer);
  virtualizerRef.current = rowVirtualizer;

  const measureElement = useCallback((node: HTMLElement | null) => {
    if (wrapCells && node) {
      virtualizerRef.current.measureElement(node);
    }
  }, [wrapCells]);

  useEffect(() => {
    setColumnWidths(result?.columns.map(() => DEFAULT_COLUMN_WIDTH) ?? []);
  }, [columnKey]);

  useEffect(() => {
    if (wrapCells && shouldVirtualizeRows) {
      rowVirtualizer.measure();
    }
  }, [columnWidths, rowVirtualizer, shouldVirtualizeRows, wrapCells]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;

      const nextWidth = Math.max(MIN_COLUMN_WIDTH, resizeState.startWidth + event.clientX - resizeState.startX);

      setColumnWidths((currentWidths) => {
        if (currentWidths[resizeState.columnIndex] === nextWidth) {
          return currentWidths;
        }

        const nextWidths = [...currentWidths];
        nextWidths[resizeState.columnIndex] = nextWidth;
        return nextWidths;
      });
    };

    const stopResizing = () => {
      resizeStateRef.current = null;
      setResizingColumnIndex(null);
      document.body.classList.remove('select-none', 'cursor-col-resize');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);
    window.addEventListener('pointercancel', stopResizing);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
      window.removeEventListener('pointercancel', stopResizing);
      document.body.classList.remove('select-none', 'cursor-col-resize');
    };
  }, []);

  const handleResizeStart = useCallback((columnIndex: number, event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const currentWidth = columnWidths[columnIndex] ?? DEFAULT_COLUMN_WIDTH;
    resizeStateRef.current = {
      columnIndex,
      startX: event.clientX,
      startWidth: currentWidth,
    };
    setResizingColumnIndex(columnIndex);
    document.body.classList.add('select-none', 'cursor-col-resize');
  }, [columnWidths]);

  const virtualRows = shouldVirtualizeRows ? rowVirtualizer.getVirtualItems() : [];
  const virtualPaddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const virtualPaddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;
  const visibleRowIndexes = shouldVirtualizeRows
    ? virtualRows.map((virtualRow) => virtualRow.index)
    : formattedRows.map((_, index) => index);
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background relative z-0">
      {error ? (
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center space-x-2 text-destructive mb-4">
            <AlertCircle size={18} />
            <span className="font-bold text-sm tracking-tight">Database Error</span>
          </div>
          <div className="p-5 bg-destructive/10 border border-destructive/20 text-destructive text-[13px] font-mono rounded-xl shadow-inner flex-1 overflow-auto whitespace-pre-wrap leading-relaxed custom-scrollbar">
            {error}
          </div>
        </div>
      ) : result ? (
        <div className="flex flex-col h-full w-full min-h-0">
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-secondary/10 flex-shrink-0">
            <div className="flex items-center gap-3 text-primary min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <CheckCircle2 size={16} />
                <span className="font-semibold text-sm">Success</span>
              </div>
              <span className="text-muted-foreground text-[13px] font-medium tracking-wide border-l border-border pl-3 truncate">
                {result.message}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium text-muted-foreground tracking-[0.18em] uppercase px-2">
                <span>{rowCount} rows</span>
                <span className="text-border">/</span>
                <span>{columnCount} cols</span>
              </div>
              {duration > 0 && (
                <span className="text-[11px] font-mono text-muted-foreground tracking-widest bg-background border border-border px-2 py-0.5 rounded-full">
                  {duration < 1000 ? `${Math.round(duration)}ms` : `${(duration / 1000).toFixed(2)}s`}
                </span>
              )}
            </div>
          </div>

          {hasRows ? (
            <div className="flex flex-1 min-h-0 min-w-0">
              <div className="flex min-w-0 flex-1 flex-col border-r border-border/70">
                <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-secondary/20 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    <Rows3 size={13} />
                    <span>Results Grid</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onToggleWrapCells}
                    className={cn(
                      'h-7 gap-2 px-2 text-xs text-muted-foreground hover:text-foreground',
                      wrapCells && 'bg-secondary text-foreground'
                    )}
                  >
                    <WrapText size={13} />
                    {wrapCells ? 'Wrapped' : 'Truncate'}
                  </Button>
                </div>

                <div ref={resultsScrollRef} className="flex-1 min-h-0 min-w-0 overflow-auto bg-background">
                  <table
                    className="border-separate border-spacing-0 text-left"
                    style={{ width: tableWidth > 0 ? `${tableWidth}px` : undefined }}
                  >
                    <thead className="sticky top-0 z-20 bg-background shadow-[0_1px_0_0_var(--border-primary)]">
                      <tr className="border-b border-border">
                        {result.columns.map((col, idx) => (
                          <th
                            key={idx}
                            className={cn(
                              'relative h-11 overflow-hidden border-b border-r border-border bg-background px-4 pr-6 text-left text-[12px] font-semibold tracking-[0.04em] text-foreground last:border-r-0'
                            )}
                            style={{
                              width: columnWidths[idx] ?? DEFAULT_COLUMN_WIDTH,
                              minWidth: columnWidths[idx] ?? DEFAULT_COLUMN_WIDTH,
                              maxWidth: columnWidths[idx] ?? DEFAULT_COLUMN_WIDTH,
                            }}
                          >
                            <span className="block overflow-hidden text-ellipsis whitespace-nowrap leading-5">
                              {col}
                            </span>
                            <div
                              role="separator"
                              aria-label={`Resize ${col} column`}
                              aria-orientation="vertical"
                              onPointerDown={(event) => handleResizeStart(idx, event)}
                              className={cn(
                                'absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none transition-colors',
                                resizingColumnIndex === idx ? 'bg-primary/70' : 'hover:bg-primary/40'
                              )}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {virtualPaddingTop > 0 && (
                        <tr>
                          <td colSpan={columnCount} style={{ height: `${virtualPaddingTop}px`, padding: 0 }} />
                        </tr>
                      )}

                      {visibleRowIndexes.map((rowIdx) => {
                        const isRowSelected = selectedCell?.rowIndex === rowIdx;
                        return (
                          <TableRow
                            key={rowIdx}
                            row={formattedRows[rowIdx]}
                            columnWidths={columnWidths}
                            rowIdx={rowIdx}
                            selectedColumnIndex={isRowSelected ? selectedCell.columnIndex : null}
                            wrapCells={wrapCells}
                            onSelectCell={onSelectCell}
                            measureRef={shouldVirtualizeRows ? measureElement : undefined}
                          />
                        );
                      })}

                      {virtualPaddingBottom > 0 && (
                        <tr>
                          <td colSpan={columnCount} style={{ height: `${virtualPaddingBottom}px`, padding: 0 }} />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside className="hidden w-[320px] shrink-0 flex-col bg-secondary/10 xl:flex">
                <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  <ChevronsLeftRightEllipsis size={13} />
                  <span>Cell Inspector</span>
                </div>
                {selectedCellDetails ? (
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="border-b border-border/70 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Row {selectedCellDetails.rowNumber}</div>
                      <div className="mt-1 truncate font-semibold text-foreground">{selectedCellDetails.columnName}</div>
                    </div>
                    <div className="flex-1 overflow-auto p-4">
                      <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Value</div>
                      <pre className={cn('whitespace-pre-wrap break-words rounded-xl border border-border/70 bg-background/80 p-4 text-[12px] leading-6 shadow-inner', selectedCellDetails.className)}>
                        {selectedCellDetails.text}
                      </pre>
                      <div className="mt-4 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Type</div>
                      <div className="mt-2 text-sm text-foreground">
                        {selectedCellDetails.rawValue === null || selectedCellDetails.rawValue === undefined
                          ? 'NULL'
                          : Array.isArray(selectedCellDetails.rawValue)
                            ? 'Array'
                            : typeof selectedCellDetails.rawValue}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    Select a cell to inspect long values without expanding the grid width.
                  </div>
                )}
              </aside>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <span className="text-sm font-medium opacity-70 border border-border/50 p-4 rounded-xl bg-secondary/20 shadow-inner max-w-sm text-center">
                {result.message}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-grid-pattern">
          <div className="w-20 h-20 rounded-2xl bg-secondary shadow-inner flex items-center justify-center mb-6">
            <Play size={32} className="opacity-30 translate-x-1" />
          </div>
          <span className="text-sm font-medium tracking-wide">Enter a query above and press <span className="font-mono bg-background border px-1.5 py-0.5 rounded ml-1 text-xs">Run</span></span>
        </div>
      )}
    </div>
  );
});
