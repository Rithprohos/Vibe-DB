import { useMemo, useState } from "react";
import { executeTransaction } from "@/lib/db";
import type { ColumnInfo } from "@/store/useAppStore";
import { escapeSqlString, formatSqlValue, quoteIdentifier } from "@/lib/sql-helpers";

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

const normalizeValue = (value: unknown): string => String(value ?? "");

const buildWhereClause = (row: Record<string, unknown>, pks: ColumnInfo[]): string =>
  pks
    .map((pk) => {
      const val = row[pk.name];
      if (val === null || val === undefined) return `${quoteIdentifier(pk.name)} IS NULL`;
      if (typeof val === "number") return `${quoteIdentifier(pk.name)} = ${val}`;
      return `${quoteIdentifier(pk.name)} = '${escapeSqlString(String(val))}'`;
    })
    .join(" AND ");

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
    const columnInfo = structure.find((c) => c.name === colName);

    try {
      formatSqlValue(valueToSave, columnInfo);
      stageCellEdit(rowIndex, colName, valueToSave);
      setError("");
      setEditingCell(null);
    } catch (e: any) {
      setError(e.toString());
    }
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
    const originalValue = row[activeEdit.colName];
    const normalizedOriginal = normalizeValue(originalValue);

    if (normalizedOriginal === activeEdit.value) {
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
        newValue: activeEdit.value,
      },
    };
  };

  const handleCommitPendingEdits = async (
    activeEdit?: ActiveEditPayload,
    additionalQueries: string[] = [],
  ): Promise<boolean> => {
    if (!activeConnection?.connId) return false;

    const workingEdits = buildWorkingEdits(activeEdit);
    if (Object.keys(workingEdits).length === 0 && additionalQueries.length === 0) {
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

      const updateQueries: string[] = [];
      const pks = structure.filter((c) => c.pk);
      if (groupedByRow.size > 0 && pks.length === 0) {
        throw new Error(
          "Table has no primary key. Multi-cell editing requires a primary key.",
        );
      }

      for (const [rowIndex, edits] of groupedByRow.entries()) {
        const row = tableData[rowIndex];
        if (!row) {
          throw new Error("Unable to resolve row for pending edit");
        }

        const setClause = edits
          .map((edit) => {
            const columnInfo = structure.find((c) => c.name === edit.colName);
            const formattedValue = formatSqlValue(edit.newValue, columnInfo);
            return `${quoteIdentifier(edit.colName)} = ${formattedValue}`;
          })
          .join(", ");

        const whereClause = buildWhereClause(row, pks);
        updateQueries.push(
          `UPDATE ${quoteIdentifier(tableName)} SET ${setClause} WHERE ${whereClause};`,
        );
      }

      const allQueries = [...additionalQueries, ...updateQueries];
      await executeTransaction(allQueries, activeConnection.connId);
      setPendingEdits({});
      setEditingCell(null);
      setEditValue("");
      await fetchData();
      return true;
    } catch (e: any) {
      setError(e.toString());
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
