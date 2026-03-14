import { invoke } from "@tauri-apps/api/core";
import type { ColumnDef, ForeignKeyConstraint, CheckConstraint } from "./createTableConstants";
import type { Connection, TableInfo, TableStructureData, QueryResult } from "../store/useAppStore";
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

export interface AiProviderPingRequest {
  providerKind: "polli" | "openai";
  baseUrl: string;
  model: string;
  apiKey?: string | null;
  useDefaultConfig: boolean;
}

export interface SchemaColumn {
  name: string;
  colType: string;
  isPk: boolean;
  isNullable: boolean;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

export interface GenerateSqlRequest {
  prompt: string;
  schema: SchemaTable[];
  providerKind: "polli" | "openai";
  baseUrl: string;
  model: string;
  apiKey?: string | null;
}

export interface GenerateSqlResponse {
  sql: string;
  explanation?: string;
}

export interface RowIdentifierInput {
  rowData: Record<string, unknown>;
}

export interface RowDataInput {
  rowData: Record<string, unknown>;
}

export interface RowUpdateInput {
  rowData: Record<string, unknown>;
  identifier: Record<string, unknown>;
}

export async function insertRows(
  tableName: string,
  rows: RowDataInput[],
  connId?: string,
): Promise<QueryResult> {
  return measureDevFetch("insert_rows", () =>
    invoke<QueryResult>("insert_rows", { tableName, rows, connId }),
  );
}

export async function deleteRows(
  tableName: string,
  rows: RowIdentifierInput[],
  connId?: string,
): Promise<QueryResult> {
  return measureDevFetch("delete_rows", () =>
    invoke<QueryResult>("delete_rows", { tableName, rows, connId }),
  );
}

export async function updateRows(
  tableName: string,
  rows: RowUpdateInput[],
  connId?: string,
): Promise<QueryResult> {
  return measureDevFetch("update_rows", () =>
    invoke<QueryResult>("update_rows", { tableName, rows, connId }),
  );
}

export async function connectDatabase(conn: Connection): Promise<string> {
  const engineType =
    conn.type === "turso" ? "Turso" : conn.type === "postgres" ? "Postgres" : "Sqlite";

  const config = {
    id: conn.id,
    name: conn.name,
    engine_type: engineType,
    path: conn.path,
    host: conn.host,
    port: conn.port,
    username: conn.username,
    password: conn.password,
    database: conn.database,
    ssl_mode: conn.sslMode,
    auth_token: conn.authToken,
  };

  return measureDevFetch("connect_database", () =>
    invoke<string>("connect_database", { config }),
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
): Promise<TableStructureData> {
  return measureDevFetch("get_table_structure", () =>
    invoke<TableStructureData>("get_table_structure", { tableName, connId }),
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
  engineType: 'sqlite' | 'turso' | 'postgres' = 'sqlite',
  foreignKeys: ForeignKeyConstraint[] = [],
  checkConstraints: CheckConstraint[] = [],
): Promise<string> {
  const serializedCheckConstraints = checkConstraints.map((constraint) => ({
    name: constraint.name,
    expression: constraint.expression,
  }));

  return measureDevFetch("build_create_table_sql", () =>
    invoke<string>("build_create_table_sql", {
      tableName,
      columns,
      ifNotExists,
      engineType,
      foreignKeys,
      checkConstraints: serializedCheckConstraints,
    }),
  );
}

export async function buildCreateViewSQL(
  viewName: string,
  selectSql: string,
  ifNotExists: boolean,
  temporary: boolean,
): Promise<string> {
  return measureDevFetch("build_create_view_sql", () =>
    invoke<string>("build_create_view_sql", {
      viewName,
      selectSql,
      ifNotExists,
      temporary,
    }),
  );
}

export async function getDefaultAiProviderConfig(): Promise<DefaultAiProviderConfig> {
  return measureDevFetch("get_default_ai_provider_config", () =>
    invoke<DefaultAiProviderConfig>("get_default_ai_provider_config"),
  );
}

export async function pingAiProvider(
  request: AiProviderPingRequest,
): Promise<void> {
  return measureDevFetch("ping_ai_provider", () =>
    invoke<void>("ping_ai_provider", { request }),
  );
}

export async function generateSql(
  request: GenerateSqlRequest,
): Promise<GenerateSqlResponse> {
  return measureDevFetch("generate_sql", () =>
    invoke<GenerateSqlResponse>("generate_sql", { request }),
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

export interface TruncateTableOptions {
  restartIdentity?: boolean;
  cascade?: boolean;
}

export async function truncateTable(
  tableName: string,
  options?: TruncateTableOptions,
  connId?: string,
): Promise<QueryResult> {
  return measureDevFetch("truncate_table", () =>
    invoke<QueryResult>("truncate_table", { tableName, options, connId }),
  );
}
