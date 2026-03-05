import { invoke } from "@tauri-apps/api/core";
import type { TableInfo, ColumnInfo, QueryResult } from "../store/useAppStore";
import { measureDevFetch } from "./dev-performance";

export async function connectDatabase(
  path: string,
  name: string,
): Promise<string> {
  return measureDevFetch("connect_database", () =>
    invoke<string>("connect_database", { path, name }),
  );
}

export async function disconnectDatabase(connId: string): Promise<void> {
  return measureDevFetch("disconnect_database", () =>
    invoke<void>("disconnect_database", { connId }),
  );
}

export async function setActiveConnection(connId: string): Promise<void> {
  return measureDevFetch("set_active_connection", () =>
    invoke<void>("set_active_connection", { connId }),
  );
}

export async function listTables(connId?: string): Promise<TableInfo[]> {
  return measureDevFetch("list_tables", () =>
    invoke<TableInfo[]>("list_tables", { connId }),
  );
}

export async function getTableStructure(
  tableName: string,
  connId?: string,
): Promise<ColumnInfo[]> {
  return measureDevFetch("get_table_structure", () =>
    invoke<ColumnInfo[]>("get_table_structure", { tableName, connId }),
  );
}

export async function executeQuery(
  query: string,
  connId?: string,
): Promise<QueryResult> {
  const queryType = query.trim().split(/\s+/)[0]?.toUpperCase() || "UNKNOWN";
  return measureDevFetch(`execute_query:${queryType}`, () =>
    invoke<QueryResult>("execute_query", { query, connId }),
  );
}

export async function executeTransaction(
  queries: string[],
  connId?: string,
): Promise<QueryResult> {
  return measureDevFetch("execute_transaction", () =>
    invoke<QueryResult>("execute_transaction", { queries, connId }),
  );
}

export async function getTableRowCount(
  tableName: string,
  connId?: string,
  whereClause?: string,
): Promise<number> {
  if (whereClause) {
    const query = `SELECT COUNT(*) as count FROM "${tableName}" WHERE ${whereClause}`;
    const result = await executeQuery(query, connId);
    if (result.rows.length > 0) {
      return Number(result.rows[0][0]) || 0;
    }
    return 0;
  }
  return measureDevFetch("get_table_row_count", () =>
    invoke<number>("get_table_row_count", { tableName, connId }),
  );
}

export async function getTableData(
  tableName: string,
  connId?: string,
  limit = 200,
  offset = 0,
  orderBy?: string,
  orderDir: "ASC" | "DESC" = "ASC",
  whereClause?: string,
): Promise<QueryResult> {
  let query = `SELECT * FROM "${tableName}"`;
  if (whereClause) {
    query += ` WHERE ${whereClause}`;
  }
  if (orderBy) {
    query += ` ORDER BY "${orderBy}" ${orderDir}`;
  }
  query += ` LIMIT ${limit} OFFSET ${offset}`;
  return executeQuery(query, connId);
}

export async function createDatabase(dbPath: string): Promise<string> {
  return measureDevFetch("create_database", () =>
    invoke<string>("create_database", { dbPath }),
  );
}

export async function getDatabaseVersion(connId?: string): Promise<string> {
  return measureDevFetch("get_database_version", () =>
    invoke<string>("get_database_version", { connId }),
  );
}
