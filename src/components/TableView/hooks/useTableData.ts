import { useState, useCallback, useMemo, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  getTableData,
  getTableRowCount,
  getTableStructure,
  type QueryFilter,
} from "@/lib/db";
import type { QueryResult, ColumnInfo } from "@/store/useAppStore";

export const useTableData = (tableName: string, tabId: string) => {
  const tab = useAppStore((s) => s.tabs.find((t) => t.id === tabId));
  const activeConnection = useAppStore((s) =>
    s.connections.find((c) => c.id === tab?.connectionId),
  );

  const [data, setData] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(200);
  const [totalRows, setTotalRows] = useState(0);
  const [structure, setStructure] = useState<ColumnInfo[]>([]);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("ASC");
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

  const gridCols = useMemo(() => {
    if (data && data.columns.length > 0) return data.columns;
    return structure.map((s) => s.name);
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

  return {
    data,
    loading,
    page,
    setPage,
    pageSize,
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
