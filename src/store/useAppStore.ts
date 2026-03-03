import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Connection {
  id: string;
  connId?: string;
  name: string;
  path: string;
  type: "sqlite";
  lastUsed: number;
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
  activeConnection: Connection | null;
  isConnected: boolean;
  showConnectionDialog: boolean;

  // Database objects
  tables: TableInfo[];
  selectedTable: string | null;

  // Tabs
  tabs: Tab[];
  activeTabId: string | null;

  // Logs
  logs: SqlLog[];
  showLogDrawer: boolean;

  // AI Panel
  isAiPanelOpen: boolean;
  setIsAiPanelOpen: (val: boolean) => void;

  // Actions
  addConnection: (conn: Connection) => void;
  removeConnection: (id: string) => void;
  setActiveConnection: (conn: Connection | null) => void;
  setIsConnected: (val: boolean) => void;
  setShowConnectionDialog: (val: boolean) => void;
  setTables: (tables: TableInfo[]) => void;
  setSelectedTable: (name: string | null) => void;

  // Tab actions
  addTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  openTableTab: (tableName: string, type: TabType) => void;

  // Log actions
  addLog: (log: Omit<SqlLog, "id" | "timestamp">) => void;
  clearLogs: () => void;
  setShowLogDrawer: (val: boolean) => void;
}

let tabCounter = 0;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnection: null,
      isConnected: false,
      showConnectionDialog: false,
      tables: [],
      selectedTable: null,
      tabs: [],
      activeTabId: null,
      logs: [],
      showLogDrawer: false,
      isAiPanelOpen: false,

      setIsAiPanelOpen: (val) => set({ isAiPanelOpen: val }),

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
        })),

      setActiveConnection: (conn) =>
        set({
          activeConnection: conn,
          tables: [],
          selectedTable: null,
          tabs: [],
          activeTabId: null,
          logs: [],
          showLogDrawer: false,
        }),

      setIsConnected: (val) => set({ isConnected: val }),
      setShowConnectionDialog: (val) => set({ showConnectionDialog: val }),
      setTables: (tables) => set({ tables }),
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

      addTab: (tab) =>
        set((state) => {
          const existing = state.tabs.find(t => t.id === tab.id);
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
          return { tabs: newTabs, activeTabId: newActiveId };
        }),

      setActiveTab: (id) => set({ activeTabId: id }),

      updateTab: (id, updates) =>
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      openTableTab: (tableName, type) => {
        const state = get();
        const existing = state.tabs.find(
          (t) => t.tableName === tableName && t.type === type,
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
        const tab: Tab = { id, type, title, tableName };
        set((state) => ({
          tabs: [...state.tabs, tab].slice(-MAX_TABS),
          activeTabId: id,
          selectedTable: tableName,
        }));
      },
    }),
{
      name: 'vibedb-storage',
      partialize: (state) => ({
        connections: state.connections.map(c => ({
          id: c.id,
          name: c.name,
          path: c.path,
          type: c.type,
          lastUsed: c.lastUsed,
        })),
      }),
    },
  ),
);

export function useActiveTab() {
  return useAppStore((s) => {
    if (!s.activeTabId) return null;
    return s.tabs.find(t => t.id === s.activeTabId) || null;
  });
}
