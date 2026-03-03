import { invoke } from "@tauri-apps/api/core";
import type { TableInfo, ColumnInfo, QueryResult } from "../store/useAppStore";

export async function connectDatabase(path: string, name: string): Promise<string> {
  return invoke<string>("connect_database", { path, name });
}

export async function disconnectDatabase(connId: string): Promise<void> {
  return invoke<void>("disconnect_database", { connId });
}

export async function setActiveConnection(connId: string): Promise<void> {
  return invoke<void>("set_active_connection", { connId });
}

export async function listTables(connId?: string): Promise<TableInfo[]> {
  return invoke<TableInfo[]>("list_tables", { connId });
}

export async function getTableStructure(
  tableName: string,
  connId?: string,
): Promise<ColumnInfo[]> {
  return invoke<ColumnInfo[]>("get_table_structure", { tableName, connId });
}

export async function executeQuery(
  query: string,
  connId?: string,
): Promise<QueryResult> {
  return invoke<QueryResult>("execute_query", { query, connId });
}

export async function getTableRowCount(
  tableName: string,
  connId?: string,
): Promise<number> {
  return invoke<number>("get_table_row_count", { tableName, connId });
}

export async function getTableData(
  tableName: string,
  connId?: string,
  limit = 200,
  offset = 0,
  orderBy?: string,
  orderDir: "ASC" | "DESC" = "ASC",
): Promise<QueryResult> {
  let query = `SELECT * FROM "${tableName}"`;
  if (orderBy) {
    query += ` ORDER BY "${orderBy}" ${orderDir}`;
  }
  query += ` LIMIT ${limit} OFFSET ${offset}`;
  return executeQuery(query, connId);
}

export async function createDatabase(dbPath: string): Promise<string> {
  return invoke<string>("create_database", { dbPath });
}