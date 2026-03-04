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

export type TabType = "data" | "structure" | "query";

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

  // Settings Modal
  showSettingsModal: boolean;

  // AI Panel
  isAiPanelOpen: boolean;
  setIsAiPanelOpen: (val: boolean) => void;

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
  setShowLogDrawer: (val: boolean) => void;
  setShowSettingsModal: (val: boolean) => void;
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
      showSettingsModal: false,
      isAiPanelOpen: false,
      databaseVersion: null,

      setIsAiPanelOpen: (val) => set({ isAiPanelOpen: val }),
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
          // If disconnecting the active connection, switch to another active one
          let newActiveId = state.activeSidebarConnectionId;
          if (state.activeSidebarConnectionId === id) {
            const nextActive = updated.find((c) => c.connId && c.id !== id);
            newActiveId = nextActive?.id ?? null;
          }
          const hasActiveConnections = updated.some((c) => c.connId);
          return {
            connections: updated,
            activeSidebarConnectionId: newActiveId,
            isConnected: hasActiveConnections,
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
        })),

      closeOtherConnections: (id) =>
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? c : { ...c, connId: undefined },
          ),
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
      setShowLogDrawer: (val) => set({ showLogDrawer: val }),
      setShowSettingsModal: (val) => set({ showSettingsModal: val }),

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
            newActiveTab?.type === "data" || newActiveTab?.type === "structure"
              ? newActiveTab.title
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
            tab?.type === "data" || tab?.type === "structure"
              ? tab.title
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
            : `${tableName} (${type === "data" ? "Data" : "Structure"})`;
        const tab: Tab = { id, connectionId, type, title, tableName };
        set((state) => ({
          tabs: [...state.tabs, tab].slice(-MAX_TABS),
          activeTabId: id,
          selectedTable: tableName,
        }));
      },
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
