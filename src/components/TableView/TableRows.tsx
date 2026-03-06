import { memo, useMemo } from 'react';
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

  return (
    <td
      key={cellId}
      className={cn(
        'border-r border-border/60 p-0 text-xs relative overflow-hidden',
        isRowNum && 'bg-muted/10 font-mono text-muted-foreground/50',
        isEditing && 'ring-1 ring-inset ring-primary bg-primary/5 z-10',
        hasPendingEdit && !isEditing && 'bg-amber-500/10'
      )}
      style={{ borderBottom: '1px solid var(--border)' }}
      onMouseDown={() => {
        if (!isScrolling && hasActiveEditingCell && !isRowNum && !isEditing) {
          onBeginEdit(rowIndex, colName, displayValue);
        }
      }}
      onDoubleClick={() => {
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
            'px-2 py-1.5 h-full w-full min-h-[32px] font-mono overflow-hidden text-ellipsis whitespace-nowrap',
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
