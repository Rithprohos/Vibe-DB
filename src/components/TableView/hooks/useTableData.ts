import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  getTableData,
  getTableRowCount,
  getTableStructure,
  type QueryFilter,
} from "@/lib/db";
import type { QueryResult, TableStructureData } from "@/store/useAppStore";

export const useTableData = (tableName: string, tabId: string) => {
  const cachedState = useMemo(
    () => useAppStore.getState().tableViewStateByTabId[tabId],
    [tabId],
  );
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const activeConnection = useAppStore((s) =>
    s.connections.find((c) => c.id === tab?.connectionId),
  );
  const updateTableViewState = useAppStore((s) => s.updateTableViewState);

  const [data, setData] = useState<QueryResult | null>(() => cachedState?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(() => cachedState?.page ?? 0);
  const [pageSize, setPageSizeState] = useState(() => cachedState?.pageSize ?? 100);
  const [totalRows, setTotalRows] = useState(() => cachedState?.totalRows ?? 0);
  const [structure, setStructure] = useState<TableStructureData | null>(() => cachedState?.structure ?? null);
  const [sortCol, setSortCol] = useState<string | null>(() => cachedState?.sortCol ?? null);
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">(
    () => cachedState?.sortDir ?? "ASC",
  );
  const [hasLoadedData, setHasLoadedData] = useState(
    () => cachedState?.hasLoadedData ?? false,
  );
  const [hasLoadedRowCount, setHasLoadedRowCount] = useState(
    () => cachedState?.hasLoadedRowCount ?? false,
  );
  const [hasLoadedStructure, setHasLoadedStructure] = useState(
    () => cachedState?.hasLoadedStructure ?? false,
  );
  const structureRequestIdRef = useRef(0);
  const countRequestIdRef = useRef(0);
  const dataRequestIdRef = useRef(0);

  const fetchStructure = useCallback(async () => {
    if (!activeConnection?.connId) return;
    const requestId = ++structureRequestIdRef.current;
    try {
      const struct = await getTableStructure(
        tableName,
        activeConnection.connId,
      );
      if (requestId !== structureRequestIdRef.current) return;
      setStructure(struct);
      setHasLoadedStructure(true);
    } catch (e: any) {
      console.error(e);
    }
  }, [tableName, activeConnection?.connId]);

  const fetchRowCount = useCallback(
    async (filters?: QueryFilter[]) => {
      if (!activeConnection?.connId) return;
      const requestId = ++countRequestIdRef.current;
      try {
        const count = await getTableRowCount(tableName, activeConnection.connId, filters);
        if (requestId !== countRequestIdRef.current) return;
        setTotalRows(count);
        setHasLoadedRowCount(true);
      } catch (e: any) {
        console.error(e);
      }
    },
    [tableName, activeConnection?.connId],
  );

  const fetchData = useCallback(
    async (filters?: QueryFilter[]) => {
      if (!activeConnection?.connId) return;
      const requestId = ++dataRequestIdRef.current;
      setLoading(true);
      try {
        const result = await getTableData(
          tableName,
          activeConnection.connId,
          pageSize,
          page * pageSize,
          sortCol || undefined,
          sortDir,
          filters,
        );
        if (requestId !== dataRequestIdRef.current) return;
        setData(result);
        setHasLoadedData(true);
      } catch (e: any) {
        console.error(e);
      } finally {
        if (requestId !== dataRequestIdRef.current) return;
        setLoading(false);
      }
    },
    [tableName, activeConnection?.connId, page, pageSize, sortCol, sortDir],
  );

  const handleSort = (colName: string) => {
    if (sortCol === colName) {
      setSortDir(sortDir === "ASC" ? "DESC" : "ASC");
    } else {
      setSortCol(colName);
      setSortDir("ASC");
    }
    setPage(0);
  };

  const setPageSize = useCallback((nextPageSize: number) => {
    setPage(0);
    setPageSizeState(nextPageSize);
  }, []);

  const gridCols = useMemo(() => {
    if (data && data.columns.length > 0) return data.columns;
    return structure?.columns.map((s) => s.name) ?? [];
  }, [data, structure]);

  const tableData = useMemo(() => {
    if (!data) return [];
    return data.rows.map((row) => {
      const obj: Record<string, any> = {};
      gridCols.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }, [data, gridCols]);

  useEffect(() => {
    updateTableViewState(tabId, {
      data,
      hasLoadedData,
      totalRows,
      hasLoadedRowCount,
      structure,
      hasLoadedStructure,
      page,
      pageSize,
      sortCol,
      sortDir,
    });
  }, [
    tabId,
    data,
    hasLoadedData,
    totalRows,
    hasLoadedRowCount,
    structure,
    hasLoadedStructure,
    page,
    pageSize,
    sortCol,
    sortDir,
    updateTableViewState,
  ]);

  return {
    data,
    loading,
    hasLoadedData,
    hasLoadedRowCount,
    hasLoadedStructure,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalRows,
    totalPages: Math.ceil(totalRows / pageSize),
    structure,
    sortCol,
    setSortCol,
    sortDir,
    gridCols,
    tableData,
    fetchStructure,
    fetchRowCount,
    fetchData,
    handleSort,
    activeConnection,
  };
};
