import { useMemo, useState } from "react";
import { updateRows, type RowUpdateInput } from "@/lib/db";
import { isJsonColumn } from "@/lib/sql/columnTypes";
import {
  normalizeJsonInput,
  parseStructuredColumnValue,
} from "@/lib/sql/values";
import type { ColumnInfo } from "@/store/useAppStore";
import { stringifyCellValue } from "@/lib/formatters";

interface EditingCell {
  rowIndex: number;
  colName: string;
}

interface PendingCellEdit {
  rowIndex: number;
  colName: string;
  oldValue: unknown;
  newValue: string;
}

interface ActiveEditPayload {
  rowIndex: number;
  colName: string;
  value: string;
}

type PendingCellEdits = Record<string, PendingCellEdit>;

const getCellKey = (rowIndex: number, colName: string): string =>
  `${rowIndex}:${colName}`;

const normalizeValue = (value: unknown): string =>
  value == null ? "" : stringifyCellValue(value);

const normalizeEditedValueForColumn = (
  value: string,
  columnInfo?: ColumnInfo,
): string => {
  if (!columnInfo || !isJsonColumn(columnInfo.col_type)) {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed === "NULL") return "NULL";

  try {
    return JSON.stringify(JSON.parse(normalizeJsonInput(value)));
  } catch {
    return value;
  }
};


export const useCellEditing = (
  tableName: string,
  structure: ColumnInfo[],
  activeConnection: { connId?: string } | null | undefined,
  tableData: Record<string, unknown>[],
  fetchData: () => Promise<void>,
) => {
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingEdits, setPendingEdits] = useState<PendingCellEdits>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const columnInfoByName = useMemo(() => {
    const map: Record<string, ColumnInfo> = {};
    structure.forEach((column) => {
      map[column.name] = column;
    });
    return map;
  }, [structure]);

  const pendingEditCount = useMemo(
    () => Object.keys(pendingEdits).length,
    [pendingEdits],
  );
  const pendingRowCount = useMemo(
    () => new Set(Object.values(pendingEdits).map((edit) => edit.rowIndex)).size,
    [pendingEdits],
  );

  const getPendingCellValue = (rowIndex: number, colName: string): string | null => {
    const edit = pendingEdits[getCellKey(rowIndex, colName)];
    return edit ? edit.newValue : null;
  };

  const isCellPending = (rowIndex: number, colName: string): boolean =>
    Boolean(pendingEdits[getCellKey(rowIndex, colName)]);

  const stageCellEdit = (
    rowIndex: number,
    colName: string,
    valueToSave: string,
  ) => {
    const row = tableData[rowIndex];
    if (!row) return;

    const originalValue = row[colName];
    const normalizedOriginal = normalizeValue(originalValue);

    setPendingEdits((current) => {
      const key = getCellKey(rowIndex, colName);

      if (normalizedOriginal === valueToSave) {
        if (!current[key]) return current;
        const { [key]: _, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [key]: {
          rowIndex,
          colName,
          oldValue: originalValue,
          newValue: valueToSave,
        },
      };
    });
  };

  const handleSaveCell = async (
    rowIndex: number,
    colName: string,
    valueToSave: string,
  ) => {
    const columnInfo = columnInfoByName[colName];
    const normalizedValue = normalizeEditedValueForColumn(valueToSave, columnInfo);

    try {
      parseStructuredColumnValue(normalizedValue, columnInfo);
    } catch (errorValue: unknown) {
      setError(
        errorValue instanceof Error ? errorValue.message : String(errorValue),
      );
      return;
    }

    stageCellEdit(rowIndex, colName, normalizedValue);
    setError("");
    setEditingCell(null);
  };

  const discardPendingCellEdit = (rowIndex: number, colName: string) => {
    const key = getCellKey(rowIndex, colName);
    setPendingEdits((current) => {
      if (!current[key]) return current;
      const { [key]: _, ...rest } = current;
      return rest;
    });
  };

  const clearPendingEdits = () => {
    setPendingEdits({});
    setError("");
  };

  const buildWorkingEdits = (
    activeEdit?: ActiveEditPayload,
  ): PendingCellEdits => {
    if (!activeEdit) {
      return pendingEdits;
    }

    const row = tableData[activeEdit.rowIndex];
    if (!row) {
      return pendingEdits;
    }

    const key = getCellKey(activeEdit.rowIndex, activeEdit.colName);
    const columnInfo = columnInfoByName[activeEdit.colName];
    const originalValue = row[activeEdit.colName];
    const normalizedOriginal = normalizeValue(originalValue);
    const normalizedActiveValue = normalizeEditedValueForColumn(
      activeEdit.value,
      columnInfo,
    );

    if (normalizedOriginal === normalizedActiveValue) {
      if (!pendingEdits[key]) return pendingEdits;
      const { [key]: _, ...rest } = pendingEdits;
      return rest;
    }

    return {
      ...pendingEdits,
      [key]: {
        rowIndex: activeEdit.rowIndex,
        colName: activeEdit.colName,
        oldValue: originalValue,
        newValue: normalizedActiveValue,
      },
    };
  };

  const handleCommitPendingEdits = async (
    activeEdit?: ActiveEditPayload,
  ): Promise<boolean> => {
    if (!activeConnection?.connId) return false;

    const workingEdits = buildWorkingEdits(activeEdit);
    if (Object.keys(workingEdits).length === 0) {
      return false;
    }

    setSaving(true);
    setError("");

    try {
      const groupedByRow = new Map<number, PendingCellEdit[]>();
      Object.values(workingEdits).forEach((edit) => {
        const rowEdits = groupedByRow.get(edit.rowIndex) ?? [];
        rowEdits.push(edit);
        groupedByRow.set(edit.rowIndex, rowEdits);
      });

      const pks = structure.filter((c) => c.pk);
      if (groupedByRow.size > 0 && pks.length === 0) {
        throw new Error(
          "Table has no primary key. Multi-cell editing requires a primary key.",
        );
      }

      // Build RowUpdateInput for backend SQL generation
      const rowUpdates: RowUpdateInput[] = [];
      for (const [rowIndex, edits] of groupedByRow.entries()) {
        const row = tableData[rowIndex];
        if (!row) {
          throw new Error("Unable to resolve row for pending edit");
        }

        // Build row_data (changes to apply)
        const rowData: Record<string, unknown> = {};
        for (const edit of edits) {
          const columnInfo = columnInfoByName[edit.colName];
          rowData[edit.colName] = parseStructuredColumnValue(
            edit.newValue,
            columnInfo,
          );
        }

        // Build identifier (primary key values from original row)
        const identifier: Record<string, unknown> = {};
        for (const pk of pks) {
          identifier[pk.name] = row[pk.name];
        }

        rowUpdates.push({ rowData, identifier });
      }

      await updateRows(tableName, rowUpdates, activeConnection.connId);
      setEditingCell(null);
      setEditValue("");
      await fetchData();
      setPendingEdits({});
      return true;
    } catch (errorValue: unknown) {
      setError(
        errorValue instanceof Error ? errorValue.message : String(errorValue),
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    editingCell,
    setEditingCell,
    editValue,
    setEditValue,
    saving,
    error,
    setError,
    pendingEditCount,
    pendingRowCount,
    pendingEdits,
    getPendingCellValue,
    isCellPending,
    handleSaveCell,
    handleCommitPendingEdits,
    clearPendingEdits,
    discardPendingCellEdit,
  };
};
