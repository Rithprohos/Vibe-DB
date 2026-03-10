import { MAX_TABS } from "../constants";
import {
  createDefaultTableViewState,
  getSelectedTableForTab,
  pruneTableViewStateByTabs,
} from "../helpers";
import type { AppState } from "../types";
import type { AppGet, AppSet } from "./shared";

type TabsSlice = Pick<
  AppState,
  | "tabs"
  | "activeTabId"
  | "tableViewStateByTabId"
  | "addTab"
  | "closeTab"
  | "closeAllTabs"
  | "closeOtherTabs"
  | "setActiveTab"
  | "updateTab"
  | "updateTableViewState"
  | "openTableTab"
>;

let tabCounter = 0;

export function createTabsSlice(set: AppSet, get: AppGet): TabsSlice {
  return {
    tabs: [],
    activeTabId: null,
    tableViewStateByTabId: {},

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
          newActiveId = newTabs[Math.min(idx, newTabs.length - 1)]?.id || null;
        }

        const newActiveTab = newTabs.find((t) => t.id === newActiveId);
        return {
          tabs: newTabs,
          activeTabId: newActiveId,
          tableViewStateByTabId: pruneTableViewStateByTabs(
            state.tableViewStateByTabId,
            newTabs,
          ),
          selectedTable: getSelectedTableForTab(newActiveTab),
        };
      }),

    closeAllTabs: () =>
      set(() => ({
        tabs: [],
        activeTabId: null,
        tableViewStateByTabId: {},
        selectedTable: null,
      })),

    closeOtherTabs: (id) =>
      set((state) => {
        const nextTabs = state.tabs.filter((t) => t.id === id);
        return {
          tabs: nextTabs,
          activeTabId: id,
          tableViewStateByTabId: pruneTableViewStateByTabs(
            state.tableViewStateByTabId,
            nextTabs,
          ),
        };
      }),

    setActiveTab: (id) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === id);
        return { activeTabId: id, selectedTable: getSelectedTableForTab(tab) };
      }),

    updateTab: (id, updates) =>
      set((state) => ({
        tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      })),

    updateTableViewState: (tabId, updates) =>
      set((state) => ({
        tableViewStateByTabId: {
          ...state.tableViewStateByTabId,
          [tabId]: {
            ...(state.tableViewStateByTabId[tabId] ?? createDefaultTableViewState()),
            ...updates,
          },
        },
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
      const tab = { id, connectionId, type, title, tableName };

      set((currentState) => ({
        tabs: [...currentState.tabs, tab].slice(-MAX_TABS),
        activeTabId: id,
        selectedTable: tableName,
      }));
    },
  };
}
