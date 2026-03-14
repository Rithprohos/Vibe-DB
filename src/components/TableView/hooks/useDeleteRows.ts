import { useState, useCallback, useMemo } from "react";
import { deleteRows, type RowIdentifierInput } from "@/lib/db";
import { getGuidedMutationPolicy } from "@/lib/queryGuard";
import { useAppStore, type Connection } from "@/store/useAppStore";

interface UseDeleteRowsOptions {
  tableName: string;
  tableData: Record<string, unknown>[];
  activeConnection: Pick<Connection, "connId" | "tag"> | null | undefined;
  checkedRowIndices: Set<number>;
  onClearChecked: () => void;
  onRefresh: (deletedRows: number) => Promise<void> | void;
}

export const useDeleteRows = ({
  tableName,
  tableData,
  activeConnection,
  checkedRowIndices,
  onClearChecked,
  onRefresh,
}: UseDeleteRowsOptions) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState("");
  const connId = activeConnection?.connId;
  const showToast = useAppStore((state) => state.showToast);

  const selectedRows = useMemo(() => {
    const rows: Record<string, unknown>[] = [];
    checkedRowIndices.forEach((index) => {
      const row = tableData[index];
      if (row) rows.push(row);
    });
    return rows;
  }, [checkedRowIndices, tableData]);

  const selectedCount = selectedRows.length;
  const hasSelection = selectedCount > 0;
  const deletePolicy = useMemo(
    () => getGuidedMutationPolicy(activeConnection?.tag, "delete-rows"),
    [activeConnection?.tag],
  );

  const performDelete = useCallback(async (): Promise<boolean> => {
    if (!connId || selectedRows.length === 0) return false;

    setIsDeleting(true);
    setError("");

    try {
      // Send row data to backend - SQL is built in Rust
      const rowInputs: RowIdentifierInput[] = selectedRows.map((row) => ({
        rowData: row,
      }));

      const result = await deleteRows(tableName, rowInputs, connId);
      onClearChecked();
      await Promise.resolve(onRefresh(result.rows_affected));
      if (result.rows_affected > 0) {
        showToast({
          type: "success",
          message: `Deleted ${result.rows_affected.toLocaleString()} row(s)`,
        });
      } else {
        showToast({
          type: "info",
          message: "No matching rows were deleted",
        });
      }
      return true;
    } catch (errorValue: unknown) {
      const message =
        errorValue instanceof Error ? errorValue.message : String(errorValue);
      setError(message);
      showToast({
        type: "error",
        message: "Delete failed",
      });
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [connId, onClearChecked, onRefresh, selectedRows, showToast, tableName]);

  const handleDeleteClick = useCallback(() => {
    if (!hasSelection) return;

    if (deletePolicy.requiresConfirmation) {
      setShowConfirmDialog(true);
      return;
    }

    void performDelete();
  }, [deletePolicy.requiresConfirmation, hasSelection, performDelete]);

  const handleConfirmDelete = useCallback(() => {
    setShowConfirmDialog(false);
    void performDelete();
  }, [performDelete]);

  const handleCancelDelete = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  return {
    isDeleting,
    showConfirmDialog,
    selectedCount,
    hasSelection,
    deletePolicy,
    error,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
    setError,
  };
};
