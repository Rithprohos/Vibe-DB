import { memo, useMemo, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CheckedState } from '@radix-ui/react-checkbox';
import { formatCellValue } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { ColumnInfo } from '@/store/useAppStore';
import { CellInput } from './CellInput';
import type { EditingCellState } from './types';
import { Checkbox } from '@/components/ui/checkbox';
import { isEnumColumn } from '@/lib/sql/columnTypes';

interface VirtualCellProps {
  colName: string;
  rowIndex: number;
  cellValue: unknown;
  pendingValue: unknown;
  hasPendingEdit: boolean;
  isEditing: boolean;
  isRowNum: boolean;
  isDateCol: boolean;
  enumOptions: string[];
  allowNull: boolean;
  isRowChecked: boolean;
  hasActiveEditingCell: boolean;
  editValue?: string;
  saving: boolean;
  onBeginEdit: (rowIndex: number, colName: string, value: unknown) => void;
  onSaveCell: (rowIndex: number, colName: string, value: string) => void;
  onCancelEdit: () => void;
  onEditValueChange: (value: string) => void;
}

const CHECKED_CELL_BG = 'rgba(var(--glow-color), 0.14)';

const VirtualCell = memo(function VirtualCell({
  colName,
  rowIndex,
  cellValue,
  pendingValue,
  hasPendingEdit,
  isEditing,
  isRowNum,
  isDateCol,
  enumOptions,
  allowNull,
  isRowChecked,
  hasActiveEditingCell,
  editValue,
  saving,
  onBeginEdit,
  onSaveCell,
  onCancelEdit,
  onEditValueChange,
}: VirtualCellProps) {
  const displayValue = pendingValue ?? cellValue;
  const formattedCell = useMemo(() => formatCellValue(displayValue), [displayValue]);
  const cellBgColor = isRowChecked ? CHECKED_CELL_BG : undefined;

  const preventGridSelection = (event: ReactMouseEvent<HTMLTableCellElement>) => {
    if (isEditing) return;
    event.preventDefault();
  };

  return (
    <td
      className={cn(
        'border-r border-border/60 p-0 text-xs relative overflow-hidden select-none',
        isRowNum && 'bg-muted/10 font-mono text-muted-foreground/50',
        isRowNum && isRowChecked && 'text-foreground/90',
        isEditing && 'ring-1 ring-inset ring-primary bg-primary/5 z-10',
        hasPendingEdit && !isEditing && 'bg-amber-500/10'
      )}
      style={{
        borderBottom: '1px solid var(--border)',
        backgroundColor: cellBgColor,
      }}
      onMouseDown={(event) => {
        preventGridSelection(event);
        if (hasActiveEditingCell && !isRowNum && !isEditing) {
          onBeginEdit(rowIndex, colName, displayValue);
        }
      }}
      onDoubleClick={(event) => {
        preventGridSelection(event);
        onBeginEdit(rowIndex, colName, displayValue);
      }}
    >
      {isEditing ? (
        <CellInput
          key={`${rowIndex}:${colName}`}
          initialValue={editValue ?? ''}
          onValueChange={onEditValueChange}
          onSave={(val) => onSaveCell(rowIndex, colName, val)}
          onCancel={onCancelEdit}
          disabled={saving}
          inputType={isDateCol ? 'date' : enumOptions.length > 0 ? 'enum' : 'text'}
          enumOptions={enumOptions}
          allowNull={allowNull}
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
  isChecked: boolean;
  editingColName: string | null;
  activeEditValue: string;
  hasActiveEditingCell: boolean;
  saving: boolean;
  columnRenderMetaByName: Record<string, ColumnRenderMeta>;
  getPendingCellValue: (rowIndex: number, colName: string) => unknown;
  isCellPending: (rowIndex: number, colName: string) => boolean;
  onBeginEdit: (rowIndex: number, colName: string, value: unknown) => void;
  onSaveCell: (rowIndex: number, colName: string, value: string) => void;
  onCancelEdit: () => void;
  onEditValueChange: (value: string) => void;
  onSelectRow: (rowIndex: number) => void;
  onToggleRowChecked: (rowIndex: number, nextChecked: boolean) => void;
}

interface ColumnRenderMeta {
  isDateCol: boolean;
  enumOptions: string[];
  allowNull: boolean;
  isRowNum: boolean;
}

export const VirtualRow = memo(function VirtualRow({
  rowIndex,
  rowData,
  gridCols,
  isSelected,
  isChecked,
  editingColName,
  activeEditValue,
  hasActiveEditingCell,
  saving,
  columnRenderMetaByName,
  getPendingCellValue,
  isCellPending,
  onBeginEdit,
  onSaveCell,
  onCancelEdit,
  onEditValueChange,
  onSelectRow,
  onToggleRowChecked,
}: VirtualRowProps) {
  const handleCheckboxChange = useCallback((nextState: CheckedState) => {
    onToggleRowChecked(rowIndex, nextState === true);
  }, [onToggleRowChecked, rowIndex]);
  const rowOutline = isChecked ? 'inset 0 0 0 1px rgba(var(--glow-color), 0.45)' : undefined;

  return (
    <tr
      className={cn(
        'group',
        rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/30',
        isSelected && !isChecked && 'ring-1 ring-inset ring-primary/45',
        !isSelected && !isChecked && 'hover:bg-accent/70',
        isChecked && !isSelected && 'hover:bg-transparent'
      )}
      style={{ boxShadow: rowOutline }}
      onClick={() => onSelectRow(rowIndex)}
    >
      <td
        className="border-r border-border/60 p-0 text-xs overflow-hidden select-none bg-muted/10"
        style={{
          borderBottom: '1px solid var(--border)',
          backgroundColor: isChecked ? CHECKED_CELL_BG : undefined,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-full min-h-[32px] px-2 py-1.5 flex items-center justify-center">
          <Checkbox
            checked={isChecked}
            onCheckedChange={handleCheckboxChange}
            aria-label={`Select row ${rowIndex + 1}`}
          />
        </div>
      </td>
      {gridCols.map((colName) => {
        const isEditing = editingColName === colName;
        const renderMeta = columnRenderMetaByName[colName];

        return (
          <VirtualCell
            key={`${rowIndex}:${colName}`}
            colName={colName}
            rowIndex={rowIndex}
            cellValue={rowData[colName]}
            pendingValue={getPendingCellValue(rowIndex, colName)}
            hasPendingEdit={isCellPending(rowIndex, colName)}
            isEditing={isEditing}
            isRowNum={renderMeta?.isRowNum ?? false}
            isDateCol={renderMeta?.isDateCol ?? false}
            enumOptions={renderMeta?.enumOptions ?? []}
            allowNull={renderMeta?.allowNull ?? true}
            isRowChecked={isChecked}
            hasActiveEditingCell={hasActiveEditingCell}
            editValue={isEditing ? activeEditValue : undefined}
            saving={saving}
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
  checkedRowIndices: Set<number>;
  editingCell: EditingCellState | null;
  editValue: string;
  saving: boolean;
  getPendingCellValue: (rowIndex: number, colName: string) => unknown;
  isCellPending: (rowIndex: number, colName: string) => boolean;
  onBeginEdit: (rowIndex: number, colName: string, value: unknown) => void;
  onSaveCell: (rowIndex: number, colName: string, value: string) => void;
  onCancelEdit: () => void;
  onEditValueChange: (value: string) => void;
  onSelectRow: (rowIndex: number) => void;
  onToggleRowChecked: (rowIndex: number, nextChecked: boolean) => void;
}

const paddingStyle = { height: 0, padding: 0 };

export const VirtualizedTableBody = memo(function VirtualizedTableBody({
  tableData,
  gridCols,
  columnCount,
  columnInfoByName,
  scrollElement,
  selectedRowIndex,
  checkedRowIndices,
  editingCell,
  editValue,
  saving,
  getPendingCellValue,
  isCellPending,
  onBeginEdit,
  onSaveCell,
  onCancelEdit,
  onEditValueChange,
  onSelectRow,
  onToggleRowChecked,
}: VirtualizedTableBodyProps) {
  const hasActiveEditingCell = editingCell !== null;
  const keyColumns = useMemo(() => {
    const pkColumns = gridCols.filter((colName) => columnInfoByName[colName]?.pk);
    if (pkColumns.length > 0) return pkColumns;
    if (gridCols.includes('rowNum')) return ['rowNum'];
    return [];
  }, [columnInfoByName, gridCols]);
  const columnRenderMetaByName = useMemo<Record<string, ColumnRenderMeta>>(() => {
    const meta: Record<string, ColumnRenderMeta> = {};
    gridCols.forEach((colName) => {
      const columnInfo = columnInfoByName[colName];
      const colType = columnInfo?.col_type.toLowerCase() || 'text';
      meta[colName] = {
        isDateCol: colType.includes('date') || colType.includes('time'),
        enumOptions: isEnumColumn(columnInfo) ? columnInfo?.enum_values ?? [] : [],
        allowNull: !columnInfo?.notnull,
        isRowNum: colName === 'rowNum',
      };
    });
    return meta;
  }, [columnInfoByName, gridCols]);
  const rowKeys = useMemo(() => tableData.map((row, index) => {
    if (!row || typeof row !== 'object') return index;

    if (keyColumns.length > 0) {
      let key = '';
      for (const colName of keyColumns) {
        const val = row[colName];
        key += `${colName}:${val == null ? 'null' : String(val)}|`;
      }
      if (key) return key;
    }

    const rowNum = row.rowNum;
    if (rowNum != null) return `rowNum:${String(rowNum)}`;
    return index;
  }), [keyColumns, tableData]);

  const getScrollElement = useCallback(() => scrollElement, [scrollElement]);
  const estimateSize = useCallback(() => 34, []);
  const getItemKey = useCallback((index: number) => rowKeys[index] ?? index, [rowKeys]);
  const overscan = gridCols.length > 20 ? 2 : 3;

  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement,
    estimateSize,
    overscan,
    getItemKey,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  const topPaddingStyle = useMemo(() =>
    paddingTop > 0 ? { ...paddingStyle, height: paddingTop } : null,
    [paddingTop]
  );
  const bottomPaddingStyle = useMemo(() =>
    paddingBottom > 0 ? { ...paddingStyle, height: paddingBottom } : null,
    [paddingBottom]
  );

  return (
    <>
      {topPaddingStyle && (
        <tr>
          <td colSpan={columnCount} style={topPaddingStyle} />
        </tr>
      )}

      {virtualRows.map((virtualRow) => (
        <VirtualRow
          key={virtualRow.key}
          rowIndex={virtualRow.index}
          rowData={tableData[virtualRow.index]}
          gridCols={gridCols}
          isSelected={selectedRowIndex === virtualRow.index}
          isChecked={checkedRowIndices.has(virtualRow.index)}
          editingColName={
            editingCell?.rowIndex === virtualRow.index ? editingCell.colName : null
          }
          activeEditValue={
            editingCell?.rowIndex === virtualRow.index ? editValue : ''
          }
          hasActiveEditingCell={hasActiveEditingCell}
          saving={saving}
          columnRenderMetaByName={columnRenderMetaByName}
          getPendingCellValue={getPendingCellValue}
          isCellPending={isCellPending}
          onBeginEdit={onBeginEdit}
          onSaveCell={onSaveCell}
          onCancelEdit={onCancelEdit}
          onEditValueChange={onEditValueChange}
          onSelectRow={onSelectRow}
          onToggleRowChecked={onToggleRowChecked}
        />
      ))}

      {bottomPaddingStyle && (
        <tr>
          <td colSpan={columnCount} style={bottomPaddingStyle} />
        </tr>
      )}
    </>
  );
});
