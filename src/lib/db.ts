import { invoke } from "@tauri-apps/api/core";
import type { ColumnDef } from "./createTableConstants";
import type { TableInfo, ColumnInfo, QueryResult } from "../store/useAppStore";
import { measureDevFetch } from "./dev-performance";
import {
  clearStoredAiApiKey,
  getStoredAiApiKey,
  hasStoredAiApiKey,
  saveStoredAiApiKey,
} from "./aiKeyStore";

export interface QueryFilter {
  field: string;
  operator: string;
  value: string;
  valueTo: string;
}

export interface DefaultAiProviderConfig {
  provider: string;
  baseUrl: string;
  model: string;
  hasEmbeddedApiKey: boolean;
}

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
  filters?: QueryFilter[],
): Promise<number> {
  if (filters && filters.length > 0) {
    return measureDevFetch("get_filtered_row_count", () =>
      invoke<number>("get_filtered_row_count", { tableName, connId, filters }),
    );
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
  filters?: QueryFilter[],
): Promise<QueryResult> {
  return measureDevFetch("get_table_data", () =>
    invoke<QueryResult>("get_table_data", {
      tableName,
      connId,
      limit,
      offset,
      orderBy,
      orderDir,
      filters,
    }),
  );
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

export async function buildCreateTableSQL(
  tableName: string,
  columns: ColumnDef[],
  ifNotExists: boolean,
): Promise<string> {
  return measureDevFetch("build_create_table_sql", () =>
    invoke<string>("build_create_table_sql", {
      tableName,
      columns,
      ifNotExists,
    }),
  );
}

export async function getDefaultAiProviderConfig(): Promise<DefaultAiProviderConfig> {
  return measureDevFetch("get_default_ai_provider_config", () =>
    invoke<DefaultAiProviderConfig>("get_default_ai_provider_config"),
  );
}

export async function hasCustomAiApiKey(profileId?: string): Promise<boolean> {
  return measureDevFetch("has_custom_ai_api_key", () =>
    hasStoredAiApiKey(profileId),
  );
}

export async function getCustomAiApiKey(
  profileId?: string,
): Promise<string | null> {
  return measureDevFetch("get_custom_ai_api_key", () =>
    getStoredAiApiKey(profileId),
  );
}

export async function saveCustomAiApiKey(
  apiKey: string,
  profileId?: string,
): Promise<void> {
  return measureDevFetch("save_custom_ai_api_key", () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      throw new Error("API key cannot be empty");
    }

    return saveStoredAiApiKey(trimmed, profileId);
  });
}

export async function clearCustomAiApiKey(profileId?: string): Promise<void> {
  return measureDevFetch("clear_custom_ai_api_key", () =>
    clearStoredAiApiKey(profileId),
  );
}
