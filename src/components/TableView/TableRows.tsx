import { memo, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatCellValue } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { ColumnInfo } from '@/store/useAppStore';
import { CellInput } from './CellInput';
import type { EditingCellState } from './types';

interface VirtualCellProps {
  cellId: string;
  colName: string;
  rowIndex: number;
  cellValue: unknown;
  pendingValue: unknown;
  hasPendingEdit: boolean;
  isEditing: boolean;
  isRowNum: boolean;
  isDateCol: boolean;
  hasActiveEditingCell: boolean;
  editValue: string;
  saving: boolean;
  isScrolling: boolean;
  onBeginEdit: (rowIndex: number, colName: string, value: unknown) => void;
  onSaveCell: (rowIndex: number, colName: string, value: string) => void;
  onCancelEdit: () => void;
  onEditValueChange: (value: string) => void;
}

const VirtualCell = memo(function VirtualCell({
  cellId,
  colName,
  rowIndex,
  cellValue,
  pendingValue,
  hasPendingEdit,
  isEditing,
  isRowNum,
  isDateCol,
  hasActiveEditingCell,
  editValue,
  saving,
  isScrolling,
  onBeginEdit,
  onSaveCell,
  onCancelEdit,
  onEditValueChange,
}: VirtualCellProps) {
  const displayValue = pendingValue ?? cellValue;
  const formattedCell = useMemo(() => {
    if (isScrolling) {
      if (displayValue === null || displayValue === undefined) {
        return {
          text: 'NULL',
          className: 'text-muted-foreground/50 italic font-mono text-xs',
        };
      }
      return {
        text: String(displayValue),
        className: 'text-foreground/90 font-mono text-[13px]',
      };
    }
    return formatCellValue(displayValue);
  }, [displayValue, isScrolling]);

  const preventGridSelection = (event: ReactMouseEvent<HTMLTableCellElement>) => {
    if (isEditing) return;
    event.preventDefault();
  };

  return (
    <td
      key={cellId}
      className={cn(
        'border-r border-border/60 p-0 text-xs relative overflow-hidden select-none',
        isRowNum && 'bg-muted/10 font-mono text-muted-foreground/50',
        isEditing && 'ring-1 ring-inset ring-primary bg-primary/5 z-10',
        hasPendingEdit && !isEditing && 'bg-amber-500/10'
      )}
      style={{ borderBottom: '1px solid var(--border)' }}
      onMouseDown={(event) => {
        preventGridSelection(event);
        if (!isScrolling && hasActiveEditingCell && !isRowNum && !isEditing) {
          onBeginEdit(rowIndex, colName, displayValue);
        }
      }}
      onDoubleClick={(event) => {
        preventGridSelection(event);
        if (!isScrolling) {
          onBeginEdit(rowIndex, colName, displayValue);
        }
      }}
    >
      {isEditing ? (
        <CellInput
          key={`${rowIndex}:${colName}`}
          initialValue={editValue}
          onValueChange={onEditValueChange}
          onSave={(val) => onSaveCell(rowIndex, colName, val)}
          onCancel={onCancelEdit}
          disabled={saving}
          inputType={isDateCol ? 'date' : 'text'}
        />
      ) : (
        <div
          className={cn(
            'px-2 py-1.5 h-full w-full min-h-[32px] font-mono overflow-hidden text-ellipsis whitespace-nowrap select-none',
            formattedCell.className
          )}
        >
          {formattedCell.text}
        </div>
      )}
    </td>
  );
});

interface VirtualRowProps {
  rowIndex: number;
  rowData: Record<string, unknown>;
  gridCols: string[];
  isSelected: boolean;
  editingCell: EditingCellState | null;
  editValue: string;
  saving: boolean;
  columnInfoByName: Record<string, ColumnInfo>;
  isScrolling: boolean;
  getPendingCellValue: (rowIndex: number, colName: string) => unknown;
  isCellPending: (rowIndex: number, colName: string) => boolean;
  onBeginEdit: (rowIndex: number, colName: string, value: unknown) => void;
  onSaveCell: (rowIndex: number, colName: string, value: string) => void;
  onCancelEdit: () => void;
  onEditValueChange: (value: string) => void;
  onInspectRow: (rowIndex: number) => void;
}

export const VirtualRow = memo(function VirtualRow({
  rowIndex,
  rowData,
  gridCols,
  isSelected,
  editingCell,
  editValue,
  saving,
  columnInfoByName,
  isScrolling,
  getPendingCellValue,
  isCellPending,
  onBeginEdit,
  onSaveCell,
  onCancelEdit,
  onEditValueChange,
  onInspectRow,
}: VirtualRowProps) {
  return (
    <tr
      className={cn(
        'group',
        rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/30',
        isSelected && 'bg-primary/8 ring-1 ring-inset ring-primary/25',
        !isScrolling && !isSelected && 'hover:bg-accent/70'
      )}
      onClick={() => {
        if (!isScrolling) {
          onInspectRow(rowIndex);
        }
      }}
    >
      {gridCols.map((colName) => {
        const isEditing =
          editingCell?.rowIndex === rowIndex && editingCell?.colName === colName;
        const columnInfo = columnInfoByName[colName];
        const colType = columnInfo?.col_type.toLowerCase() || 'text';
        const isDateCol = colType.includes('date') || colType.includes('time');

        return (
          <VirtualCell
            key={`${rowIndex}:${colName}`}
            cellId={`${rowIndex}:${colName}`}
            colName={colName}
            rowIndex={rowIndex}
            cellValue={rowData[colName]}
            pendingValue={getPendingCellValue(rowIndex, colName)}
            hasPendingEdit={isCellPending(rowIndex, colName)}
            isEditing={isEditing}
            isRowNum={colName === 'rowNum'}
            isDateCol={isDateCol}
            hasActiveEditingCell={Boolean(editingCell)}
            editValue={editValue}
            saving={saving}
            isScrolling={isScrolling}
            onBeginEdit={onBeginEdit}
            onSaveCell={onSaveCell}
            onCancelEdit={onCancelEdit}
            onEditValueChange={onEditValueChange}
          />
        );
      })}
    </tr>
  );
});

interface VirtualizedTableBodyProps {
  tableData: Record<string, unknown>[];
  gridCols: string[];
  columnCount: number;
  columnInfoByName: Record<string, ColumnInfo>;
  scrollElement: HTMLDivElement | null;
  selectedRowIndex: number | null;
  editingCell: EditingCellState | null;
  editValue: string;
  saving: boolean;
  getPendingCellValue: (rowIndex: number, colName: string) => unknown;
  isCellPending: (rowIndex: number, colName: string) => boolean;
  onBeginEdit: (rowIndex: number, colName: string, value: unknown) => void;
  onSaveCell: (rowIndex: number, colName: string, value: string) => void;
  onCancelEdit: () => void;
  onEditValueChange: (value: string) => void;
  onInspectRow: (rowIndex: number) => void;
}

export const VirtualizedTableBody = memo(function VirtualizedTableBody({
  tableData,
  gridCols,
  columnCount,
  columnInfoByName,
  scrollElement,
  selectedRowIndex,
  editingCell,
  editValue,
  saving,
  getPendingCellValue,
  isCellPending,
  onBeginEdit,
  onSaveCell,
  onCancelEdit,
  onEditValueChange,
  onInspectRow,
}: VirtualizedTableBodyProps) {
  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 34,
    overscan: 6,
    isScrollingResetDelay: 120,
  });

  const isScrolling = rowVirtualizer.isScrolling;
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <>
      {paddingTop > 0 && (
        <tr>
          <td colSpan={columnCount} style={{ height: `${paddingTop}px`, padding: 0 }} />
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
            onBeginEdit={onBeginEdit}
            onSaveCell={onSaveCell}
            onCancelEdit={onCancelEdit}
            onEditValueChange={onEditValueChange}
            onInspectRow={onInspectRow}
          />
        );
      })}

      {paddingBottom > 0 && (
        <tr>
          <td colSpan={columnCount} style={{ height: `${paddingBottom}px`, padding: 0 }} />
        </tr>
      )}
    </>
  );
});
