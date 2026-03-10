import { pruneTableViewStateByTabs } from "../helpers";
import type { AppState } from "../types";
import type { AppSet } from "./shared";

type ConnectionSlice = Pick<
  AppState,
  | "connections"
  | "activeSidebarConnectionId"
  | "isConnected"
  | "showConnectionDialog"
  | "tablesByConnection"
  | "selectedTable"
  | "addConnection"
  | "removeConnection"
  | "disconnectConnection"
  | "closeAllConnections"
  | "closeOtherConnections"
  | "updateConnection"
  | "setActiveSidebarConnection"
  | "setIsConnected"
  | "setShowConnectionDialog"
  | "setTables"
  | "setSelectedTable"
>;

export function createConnectionSlice(set: AppSet): ConnectionSlice {
  return {
    connections: [],
    activeSidebarConnectionId: null,
    isConnected: false,
    showConnectionDialog: false,
    tablesByConnection: {},
    selectedTable: null,

    addConnection: (conn) =>
      set((state) => ({
        connections: [conn, ...state.connections.filter((c) => c.id !== conn.id)].slice(
          0,
          20,
        ),
      })),

    removeConnection: (id) =>
      set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
        activeSidebarConnectionId:
          state.activeSidebarConnectionId === id ? null : state.activeSidebarConnectionId,
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
          tableViewStateByTabId: pruneTableViewStateByTabs(
            state.tableViewStateByTabId,
            newTabs,
          ),
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
        tableViewStateByTabId: {},
        selectedTable: null,
      })),

    closeOtherConnections: (id) =>
      set((state) => {
        const nextTabs = state.tabs.filter((t) => t.connectionId === id);
        return {
          connections: state.connections.map((c) =>
            c.id === id ? c : { ...c, connId: undefined },
          ),
          tabs: nextTabs,
          activeTabId:
            state.activeTabId &&
            state.tabs.find((t) => t.id === state.activeTabId)?.connectionId === id
              ? state.activeTabId
              : (state.tabs.find((t) => t.connectionId === id)?.id ?? null),
          tableViewStateByTabId: pruneTableViewStateByTabs(
            state.tableViewStateByTabId,
            nextTabs,
          ),
        };
      }),

    updateConnection: (id, updates) =>
      set((state) => ({
        connections: state.connections.map((c) => (c.id === id ? { ...c, ...updates } : c)),
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
  };
}
