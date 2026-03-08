import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { LazyStore } from "@tauri-apps/plugin-store";

export interface Connection {
  id: string;
  connId?: string;
  name: string;
  path: string;
  type: "sqlite";
  lastUsed: number;
  tag?: "local" | "testing" | "development" | "production";
}

export interface TableInfo {
  name: string;
  table_type: string;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  col_type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
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

export const MAX_RESULT_ROWS = 1000;
export const MAX_TABS = 20;
export const MAX_ACTIVE_CONNECTIONS = 5;

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

export type TabType =
  | "data"
  | "structure"
  | "query"
  | "create-table"
  | "edit-table";

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

type BooleanSetter = boolean | ((prev: boolean) => boolean);

export interface Tab {
  id: string;
  connectionId: string;
  type: TabType;
  title: string;
  tableName?: string;
  query?: string;
  result?: QueryResult | null;
  error?: string;
}

interface AppState {
  // Connection
  connections: Connection[];
  activeSidebarConnectionId: string | null;
  isConnected: boolean;
  showConnectionDialog: boolean;

  // Database objects
  tablesByConnection: Record<string, TableInfo[]>;
  selectedTable: string | null;

  // Tabs
  tabs: Tab[];
  activeTabId: string | null;

  // Logs
  logs: SqlLog[];
  showLogDrawer: boolean;

  // Toasts
  toasts: ToastItem[];

  // Settings Modal
  showSettingsModal: boolean;

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
    updates: Partial<Pick<Connection, "name" | "tag" | "connId" | "lastUsed">>,
  ) => void;
  removeConnection: (id: string) => void;
  disconnectConnection: (id: string) => void;
  closeAllConnections: () => void;
  closeOtherConnections: (id: string) => void;
  setActiveSidebarConnection: (id: string | null) => void;
  setIsConnected: (val: boolean) => void;
  setShowConnectionDialog: (val: boolean) => void;
  setTables: (connectionId: string, tables: TableInfo[]) => void;
  setSelectedTable: (name: string | null) => void;

  // Tab actions
  addTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  openTableTab: (
    connectionId: string,
    tableName: string,
    type: TabType,
  ) => void;

  // Log actions
  addLog: (log: Omit<SqlLog, "id" | "timestamp">) => void;
  clearLogs: () => void;
  setShowLogDrawer: (val: BooleanSetter) => void;
  setShowSettingsModal: (val: boolean) => void;
  showToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;

  // Alert actions
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

let tabCounter = 0;

// Initialize Tauri Store
const tauriStore = new LazyStore("app_settings.json");

// Define custom storage for Zustand to use Tauri Store
const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await tauriStore.get<string | null>(name)) ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await tauriStore.set(name, value);
    await tauriStore.save();
  },
  removeItem: async (name: string): Promise<void> => {
    await tauriStore.delete(name);
    await tauriStore.save();
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      connections: [],
      activeSidebarConnectionId: null,
      isConnected: false,
      showConnectionDialog: false,
      tablesByConnection: {},
      selectedTable: null,
      tabs: [],
      activeTabId: null,
      logs: [],
      showLogDrawer: false,
      toasts: [],
      showSettingsModal: false,
      alertOptions: null,
      theme: "dark",
      developerToolsEnabled: false,
      isAiPanelOpen: false,
      aiProviderMode: "default",
      aiCustomProfiles: [],
      aiActiveCustomProfileId: null,
      aiCustomProviderKind: "openai",
      aiCustomName: "",
      aiCustomBaseUrl: "https://api.openai.com/v1",
      aiCustomModel: "gpt-4o-mini",
      databaseVersion: null,

      setIsAiPanelOpen: (val) => set({ isAiPanelOpen: val }),
      setAiProviderMode: (mode) => set({ aiProviderMode: mode }),
      setAiActiveCustomProfileId: (id) => set({ aiActiveCustomProfileId: id }),
      setAiCustomProviderKind: (providerKind) => set({ aiCustomProviderKind: providerKind }),
      setAiCustomName: (name) => set({ aiCustomName: name }),
      setAiCustomBaseUrl: (baseUrl) => set({ aiCustomBaseUrl: baseUrl }),
      setAiCustomModel: (model) => set({ aiCustomModel: model }),
      upsertAiCustomProfile: (profile) =>
        set((state) => {
          const updatedProfile: AiCustomProfile = {
            ...profile,
            updatedAt: Date.now(),
          };
          const nextProfiles = state.aiCustomProfiles.some((p) => p.id === profile.id)
            ? state.aiCustomProfiles.map((p) => (p.id === profile.id ? updatedProfile : p))
            : [updatedProfile, ...state.aiCustomProfiles];
          return {
            aiCustomProfiles: nextProfiles.sort((a, b) => b.updatedAt - a.updatedAt),
            aiActiveCustomProfileId: profile.id,
          };
        }),
      removeAiCustomProfile: (id) =>
        set((state) => {
          const nextProfiles = state.aiCustomProfiles.filter((p) => p.id !== id);
          const activeId =
            state.aiActiveCustomProfileId === id
              ? (nextProfiles[0]?.id ?? null)
              : state.aiActiveCustomProfileId;
          return {
            aiCustomProfiles: nextProfiles,
            aiActiveCustomProfileId: activeId,
          };
        }),
      setTheme: (theme) => set({ theme }),
      setDeveloperToolsEnabled: (enabled) => set({ developerToolsEnabled: enabled }),
      setDatabaseVersion: (version) => set({ databaseVersion: version }),

      addConnection: (conn) =>
        set((state) => ({
          connections: [
            conn,
            ...state.connections.filter((c) => c.id !== conn.id),
          ].slice(0, 20),
        })),

      removeConnection: (id) =>
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
          activeSidebarConnectionId:
            state.activeSidebarConnectionId === id
              ? null
              : state.activeSidebarConnectionId,
        })),

      disconnectConnection: (id) =>
        set((state) => {
          const updated = state.connections.map((c) =>
            c.id === id ? { ...c, connId: undefined } : c,
          );
          let newActiveId = state.activeSidebarConnectionId;
          if (state.activeSidebarConnectionId === id) {
            const nextActive = updated.find((c) => c.connId && c.id !== id);
            newActiveId = nextActive?.id ?? null;
          }
          const hasActiveConnections = updated.some((c) => c.connId);
          const newTabs = state.tabs.filter((t) => t.connectionId !== id);
          let newActiveTabId = state.activeTabId;
          if (state.tabs.some((t) => t.id === state.activeTabId && t.connectionId === id)) {
            newActiveTabId = newTabs.length > 0 ? newTabs[0].id : null;
          }
          return {
            connections: updated,
            activeSidebarConnectionId: newActiveId,
            isConnected: hasActiveConnections,
            tabs: newTabs,
            activeTabId: newActiveTabId,
          };
        }),

      closeAllConnections: () =>
        set((state) => ({
          connections: state.connections.map((c) => ({
            ...c,
            connId: undefined,
          })),
          activeSidebarConnectionId: null,
          isConnected: false,
          tabs: [],
          activeTabId: null,
          selectedTable: null,
        })),

      closeOtherConnections: (id) =>
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? c : { ...c, connId: undefined },
          ),
          tabs: state.tabs.filter((t) => t.connectionId === id),
          activeTabId: state.activeTabId && state.tabs.find((t) => t.id === state.activeTabId)?.connectionId === id ? state.activeTabId : state.tabs.find((t) => t.connectionId === id)?.id ?? null,
        })),

      updateConnection: (id, updates) =>
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        })),

      setActiveSidebarConnection: (id) =>
        set({
          activeSidebarConnectionId: id,
          selectedTable: null,
        }),

      setIsConnected: (val) => set({ isConnected: val }),
      setShowConnectionDialog: (val) => set({ showConnectionDialog: val }),

      setTables: (connectionId, tables) =>
        set((state) => ({
          tablesByConnection: {
            ...state.tablesByConnection,
            [connectionId]: tables,
          },
        })),

      setSelectedTable: (name) => set({ selectedTable: name }),

      addLog: (log) =>
        set((state) => ({
          logs: [
            {
              ...log,
              id: Math.random().toString(36).substring(7),
              timestamp: Date.now(),
            },
            ...state.logs,
          ].slice(0, 100),
        })),

      clearLogs: () => set({ logs: [] }),
      setShowLogDrawer: (val) =>
        set((state) => ({
          showLogDrawer: typeof val === 'function' ? val(state.showLogDrawer) : val,
        })),
      setShowSettingsModal: (val) => set({ showSettingsModal: val }),
      showToast: (toast) =>
        set((state) => ({
          toasts: [
            ...state.toasts,
            {
              ...toast,
              id: Math.random().toString(36).slice(2),
            },
          ].slice(-4),
        })),
      dismissToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        })),

      addTab: (tab) =>
        set((state) => {
          const existing = state.tabs.find((t) => t.id === tab.id);
          if (existing) {
            return { activeTabId: tab.id };
          }
          const newTabs = [...state.tabs, tab].slice(-MAX_TABS);
          return { tabs: newTabs, activeTabId: tab.id };
        }),

      closeTab: (id) =>
        set((state) => {
          const newTabs = state.tabs.filter((t) => t.id !== id);
          let newActiveId = state.activeTabId;
          if (state.activeTabId === id) {
            const idx = state.tabs.findIndex((t) => t.id === id);
            newActiveId =
              newTabs[Math.min(idx, newTabs.length - 1)]?.id || null;
          }
          // Update selectedTable to match the new active tab
          const newActiveTab = newTabs.find((t) => t.id === newActiveId);
          const newSelectedTable =
            newActiveTab?.type === "data" ||
            newActiveTab?.type === "structure" ||
            newActiveTab?.type === "edit-table"
              ? (newActiveTab.tableName ?? null)
              : null;
          return {
            tabs: newTabs,
            activeTabId: newActiveId,
            selectedTable: newSelectedTable,
          };
        }),

      closeAllTabs: () =>
        set(() => ({
          tabs: [],
          activeTabId: null,
          selectedTable: null,
        })),

      closeOtherTabs: (id) =>
        set((state) => ({
          tabs: state.tabs.filter((t) => t.id === id),
          activeTabId: id,
        })),

      setActiveTab: (id) =>
        set((state) => {
          const tab = state.tabs.find((t) => t.id === id);
          const newSelectedTable =
            tab?.type === "data" ||
            tab?.type === "structure" ||
            tab?.type === "edit-table"
              ? (tab.tableName ?? null)
              : null;
          return { activeTabId: id, selectedTable: newSelectedTable };
        }),

      updateTab: (id, updates) =>
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      openTableTab: (connectionId, tableName, type) => {
        const state = get();
        const existing = state.tabs.find(
          (t) =>
            t.connectionId === connectionId &&
            t.tableName === tableName &&
            t.type === type,
        );
        if (existing) {
          set({ activeTabId: existing.id, selectedTable: tableName });
          return;
        }
        const id = `tab-${++tabCounter}-${Date.now()}`;
        const title =
          type === "query"
            ? `Query ${tableName || ""}`
            : `${tableName} (${
                type === "data"
                  ? "Data"
                  : type === "structure"
                    ? "Structure"
                    : type === "edit-table"
                      ? "Edit"
                      : "Table"
              })`;
        const tab: Tab = { id, connectionId, type, title, tableName };
        set((state) => ({
          tabs: [...state.tabs, tab].slice(-MAX_TABS),
          activeTabId: id,
          selectedTable: tableName,
        }));
      },

      showAlert: (options) => set({ alertOptions: options }),
      hideAlert: () => set({ alertOptions: null }),
    }),
    {
      name: "vibedb-storage",
      partialize: (state) => ({
        connections: state.connections.map((c) => ({
          id: c.id,
          name: c.name,
          path: c.path,
          type: c.type,
          lastUsed: c.lastUsed,
          tag: c.tag,
        })),
        activeSidebarConnectionId: state.activeSidebarConnectionId,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        theme: state.theme,
        developerToolsEnabled: state.developerToolsEnabled,
        aiProviderMode: state.aiProviderMode,
        aiCustomProfiles: state.aiCustomProfiles,
        aiActiveCustomProfileId: state.aiActiveCustomProfileId,
        aiCustomProviderKind: state.aiCustomProviderKind,
        aiCustomName: state.aiCustomName,
        aiCustomBaseUrl: state.aiCustomBaseUrl,
        aiCustomModel: state.aiCustomModel,
      }),
      storage: createJSONStorage(() => storage),
    },
  ),
);

export function useActiveTab() {
  return useAppStore((s) => {
    if (!s.activeTabId) return null;
    return s.tabs.find((t) => t.id === s.activeTabId) || null;
  });
}
