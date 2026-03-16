export interface Connection {
  id: string;
  connId?: string;
  name: string;
  path?: string;
  type: "sqlite" | "turso" | "postgres";
  lastUsed: number;
  tag?: "local" | "testing" | "development" | "production";
  // PostgreSQL-specific fields
  host?: string;
  port?: number;
  username?: string;
  hasPassword?: boolean;
  password?: string;
  database?: string;
  sslMode?: "disable" | "prefer" | "require" | "verify-ca" | "verify-full";
  // Turso-specific fields
  hasAuthToken?: boolean;
  authToken?: string;
}

export interface TableInfo {
  name: string;
  table_type: string;
  schema?: string;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  col_type: string;
  enum_values?: string[] | null;
  notnull: boolean | number;
  dflt_value: string | null;
  pk: boolean | number;
}

export interface IndexInfo {
  name: string;
  unique: boolean;
  columns: string[];
}

export interface ForeignKeyInfo {
  from_col: string;
  to_table: string;
  to_col: string;
}

export interface TableStructureData {
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  foreign_keys: ForeignKeyInfo[];
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  rows_affected: number;
  message: string;
}

export interface QueryResultLight {
  columns: string[];
  rows: any[][];
  rows_affected: number;
  message: string;
  totalRows?: number;
  truncated?: boolean;
}

export interface TableFilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  valueTo: string;
}

export interface TableViewState {
  data: QueryResult | null;
  totalRows: number | null;
  structure: TableStructureData | null;
  page: number;
  pageSize: number;
  sortCol: string | null;
  sortDir: "ASC" | "DESC";
  showFilterPanel: boolean;
  filters: TableFilterCondition[];
  appliedFilters: TableFilterCondition[];
  isInspectorOpen: boolean;
  selectedRowIndex: number | null;
}

export interface PersistedTableTransferContext {
  appliedFilters: TableFilterCondition[];
  sortCol: string | null;
  sortDir: "ASC" | "DESC";
}

export interface VisualizationPoint {
  x: number;
  y: number;
}

export interface VisualizationState {
  pan: VisualizationPoint;
  zoom: number;
  positionsByTable: Record<string, VisualizationPoint>;
}

export interface SqlLog {
  id: string;
  sql: string;
  timestamp: number;
  status: "success" | "error";
  duration: number;
  message: string;
}

export interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  connectionId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface QuickSearchRecentItem {
  connectionId: string;
  tableName: string;
  openedAt: number;
}

export type TabType =
  | "data"
  | "structure"
  | "visualize"
  | "query"
  | "create-table"
  | "edit-table"
  | "create-view";

export type Theme = "dark" | "dark-modern" | "light" | "purple";
export type AiProviderMode = "default" | "custom";
export type AiCustomProviderKind = "polli" | "openai";

export interface AiCustomProfile {
  id: string;
  name: string;
  providerKind: AiCustomProviderKind;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  updatedAt: number;
}

export type AlertType = "info" | "success" | "warning" | "error";

export interface AlertOptions {
  title: string;
  message?: string;
  type?: AlertType;
  confirmText?: string;
  onConfirm?: () => void;
}

export type BooleanSetter = boolean | ((prev: boolean) => boolean);

export interface CreateViewDraft {
  viewName: string;
  sourceSql: string;
  ifNotExists: boolean;
  temporary: boolean;
}

export interface Tab {
  id: string;
  connectionId: string;
  type: TabType;
  title: string;
  tableName?: string;
  schemaName?: string | null;
  visualizeSourceTable?: string | null;
  query?: string;
  result?: QueryResult | null;
  error?: string;
  createViewDraft?: CreateViewDraft;
  savedQueryId?: string | null;
  savedQueryName?: string | null;
}

export interface AppState {
  // Connection
  connections: Connection[];
  activeSidebarConnectionId: string | null;
  isConnected: boolean;
  showConnectionDialog: boolean;

  // Database objects
  tablesByConnection: Record<string, TableInfo[]>;
  pinnedTablesByConnection: Record<string, string[]>;
  selectedTable: string | null;

  // Tabs
  tabs: Tab[];
  activeTabId: string | null;
  tableViewStateByTabId: Record<string, TableViewState>;
  tableTransferContextByKey: Record<string, PersistedTableTransferContext>;
  visualizationStateByTabId: Record<string, VisualizationState>;

  // Logs
  logs: SqlLog[];
  showLogDrawer: boolean;

  // Toasts
  toasts: ToastItem[];

  // Saved queries
  savedQueries: SavedQuery[];
  quickSearchRecentItems: QuickSearchRecentItem[];

  // Settings Modal
  showSettingsModal: boolean;
  isQuickSearchOpen: boolean;

  // Alert Modal
  alertOptions: AlertOptions | null;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  developerToolsEnabled: boolean;
  setDeveloperToolsEnabled: (enabled: boolean) => void;

  // AI Panel
  isAiPanelOpen: boolean;
  setIsAiPanelOpen: (val: boolean) => void;
  aiProviderMode: AiProviderMode;
  aiCustomProfiles: AiCustomProfile[];
  aiActiveCustomProfileId: string | null;
  aiCustomProviderKind: AiCustomProviderKind;
  aiCustomName: string;
  aiCustomBaseUrl: string;
  aiCustomModel: string;
  setAiProviderMode: (mode: AiProviderMode) => void;
  setAiActiveCustomProfileId: (id: string | null) => void;
  setAiCustomProviderKind: (providerKind: AiCustomProviderKind) => void;
  setAiCustomName: (name: string) => void;
  setAiCustomBaseUrl: (baseUrl: string) => void;
  setAiCustomModel: (model: string) => void;
  upsertAiCustomProfile: (profile: Omit<AiCustomProfile, "updatedAt">) => void;
  removeAiCustomProfile: (id: string) => void;

  // Metadata
  databaseVersion: string | null;
  setDatabaseVersion: (version: string | null) => void;

  // Actions
  addConnection: (conn: Connection) => void;
  updateConnection: (
    id: string,
    updates: Partial<Connection>,
  ) => void;
  removeConnection: (id: string) => void;
  disconnectConnection: (id: string) => void;
  closeAllConnections: () => void;
  closeOtherConnections: (id: string) => void;
  setActiveSidebarConnection: (id: string | null) => void;
  setIsConnected: (val: boolean) => void;
  setShowConnectionDialog: (val: boolean) => void;
  setTables: (connectionId: string, tables: TableInfo[]) => void;
  togglePinnedTable: (connectionId: string, tableName: string) => void;
  setSelectedTable: (name: string | null) => void;

  // Tab actions
  addTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  updateTableViewState: (
    tabId: string,
    updates: Partial<TableViewState>,
  ) => void;
  openTableTab: (
    connectionId: string,
    tableName: string,
    type: TabType,
  ) => void;
  openVisualizationTab: (input: {
    connectionId: string;
    schemaName?: string | null;
    sourceTable?: string | null;
  }) => void;
  updateVisualizationState: (
    tabId: string,
    updates: Partial<VisualizationState>,
  ) => void;
  setVisualizationTablePosition: (
    tabId: string,
    tableName: string,
    position: VisualizationPoint,
  ) => void;

  // Log actions
  addLog: (log: Omit<SqlLog, "id" | "timestamp">) => void;
  clearLogs: () => void;
  setShowLogDrawer: (val: BooleanSetter) => void;
  setShowSettingsModal: (val: boolean) => void;
  setIsQuickSearchOpen: (val: BooleanSetter) => void;
  saveQuery: (input: {
    id?: string;
    name: string;
    sql: string;
    connectionId: string | null;
  }) => SavedQuery;
  renameSavedQuery: (id: string, name: string) => void;
  deleteSavedQuery: (id: string) => void;
  unlinkTabsForSavedQuery: (savedQueryId: string) => void;
  showToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;

  // Alert actions
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}
