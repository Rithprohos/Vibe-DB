import { MAX_QUICK_SEARCH_RECENT_ITEMS, MAX_TABS } from "../constants";
import { getTableTransferContextKey } from "@/features/table-transfer/state";
import {
  createDefaultVisualizationState,
  createDefaultTableViewState,
  getSelectedTableForTab,
  pruneVisualizationStateByTabs,
  pruneTableViewStateByTabs,
} from "../helpers";
import type {
  AppState,
  PersistedTableTransferContext,
  Tab,
  TableViewState,
} from "../types";
import type { AppGet, AppSet } from "./shared";

type TabsSlice = Pick<
  AppState,
  | "tabs"
  | "activeTabId"
  | "tableViewStateByTabId"
  | "tableTransferContextByKey"
  | "visualizationStateByTabId"
  | "quickSearchRecentItems"
  | "addTab"
  | "closeTab"
  | "closeAllTabs"
  | "closeOtherTabs"
  | "setActiveTab"
  | "updateTab"
  | "updateTableViewState"
  | "openTableTab"
  | "openVisualizationTab"
  | "openEnumDetailTab"
  | "updateVisualizationState"
  | "setVisualizationTablePosition"
>;

let tabCounter = 0;

export function updateTableTransferContextForTab(
  tableTransferContextByKey: Record<string, PersistedTableTransferContext>,
  tab: Pick<Tab, "connectionId" | "tableName" | "type"> | undefined,
  tableViewState: Pick<TableViewState, "appliedFilters" | "sortCol" | "sortDir">,
): Record<string, PersistedTableTransferContext> {
  if (!tab || tab.type !== "data" || !tab.tableName) {
    return tableTransferContextByKey;
  }

  return {
    ...tableTransferContextByKey,
    [getTableTransferContextKey(tab.connectionId, tab.tableName)]: {
      appliedFilters: tableViewState.appliedFilters.map((filter) => ({ ...filter })),
      sortCol: tableViewState.sortCol,
      sortDir: tableViewState.sortDir,
    },
  };
}

export function createTabsSlice(set: AppSet, get: AppGet): TabsSlice {
  return {
    tabs: [],
    activeTabId: null,
    tableViewStateByTabId: {},
    tableTransferContextByKey: {},
    visualizationStateByTabId: {},
    quickSearchRecentItems: [],

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
          visualizationStateByTabId: pruneVisualizationStateByTabs(
            state.visualizationStateByTabId,
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
        visualizationStateByTabId: {},
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
          visualizationStateByTabId: pruneVisualizationStateByTabs(
            state.visualizationStateByTabId,
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
      set((state) => {
        const nextTableViewState = {
          ...(state.tableViewStateByTabId[tabId] ?? createDefaultTableViewState()),
          ...updates,
        };
        const tab = state.tabs.find((currentTab) => currentTab.id === tabId);

        return {
          tableViewStateByTabId: {
            ...state.tableViewStateByTabId,
            [tabId]: nextTableViewState,
          },
          tableTransferContextByKey: updateTableTransferContextForTab(
            state.tableTransferContextByKey,
            tab,
            nextTableViewState,
          ),
        };
      }),

    updateVisualizationState: (tabId, updates) =>
      set((state) => ({
        visualizationStateByTabId: {
          ...state.visualizationStateByTabId,
          [tabId]: {
            ...(state.visualizationStateByTabId[tabId] ??
              createDefaultVisualizationState()),
            ...updates,
          },
        },
      })),

    setVisualizationTablePosition: (tabId, tableName, position) =>
      set((state) => ({
        visualizationStateByTabId: {
          ...state.visualizationStateByTabId,
          [tabId]: {
            ...(state.visualizationStateByTabId[tabId] ??
              createDefaultVisualizationState()),
            positionsByTable: {
              ...(
                state.visualizationStateByTabId[tabId]?.positionsByTable ?? {}
              ),
              [tableName]: position,
            },
          },
        },
      })),

    openTableTab: (connectionId, tableName, type) => {
      const nextRecentItems = (recentItems: AppState["quickSearchRecentItems"]) => [
        {
          connectionId,
          tableName,
          openedAt: Date.now(),
        },
        ...recentItems.filter(
          (item) =>
            !(
              item.connectionId === connectionId &&
              item.tableName === tableName
            ),
        ),
      ].slice(0, MAX_QUICK_SEARCH_RECENT_ITEMS);

      const state = get();
      const existing = state.tabs.find(
        (t) =>
          t.connectionId === connectionId &&
          t.tableName === tableName &&
          t.type === type,
      );
      if (existing) {
        set({
          activeTabId: existing.id,
          selectedTable: tableName,
          quickSearchRecentItems: nextRecentItems(state.quickSearchRecentItems),
        });
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
        quickSearchRecentItems: nextRecentItems(
          currentState.quickSearchRecentItems,
        ),
      }));
    },

    openVisualizationTab: ({ connectionId, schemaName, sourceTable }) => {
      const scopeLabel = schemaName?.trim()
        ? schemaName.trim()
        : "All Schemas";
      const title = `${scopeLabel} (Visualize)`;

      const state = get();
      const existing = state.tabs.find(
        (tab) => tab.connectionId === connectionId && tab.type === "visualize",
      );

      if (existing) {
        set((currentState) => ({
          tabs: currentState.tabs.map((tab) =>
            tab.id === existing.id
              ? {
                  ...tab,
                  title,
                  schemaName: schemaName?.trim() ? schemaName.trim() : null,
                  visualizeSourceTable: sourceTable?.trim() ? sourceTable.trim() : null,
                }
              : tab,
          ),
          activeTabId: existing.id,
          selectedTable: null,
        }));
        return;
      }

      const id = `visualize-${++tabCounter}-${Date.now()}`;
      const tab = {
        id,
        connectionId,
        type: "visualize" as const,
        title,
        schemaName: schemaName?.trim() ? schemaName.trim() : null,
        visualizeSourceTable: sourceTable?.trim() ? sourceTable.trim() : null,
      };

      set((currentState) => ({
        tabs: [...currentState.tabs, tab].slice(-MAX_TABS),
        activeTabId: id,
        selectedTable: null,
      }));
    },

    openEnumDetailTab: ({ connectionId, enumName, enumSchema }) => {
      const trimmedEnumName = enumName.trim();
      if (!trimmedEnumName) {
        return;
      }

      const trimmedEnumSchema = enumSchema?.trim() ? enumSchema.trim() : null;
      const fullName = trimmedEnumSchema
        ? `${trimmedEnumSchema}.${trimmedEnumName}`
        : trimmedEnumName;
      const title = `${fullName} (Enum)`;

      const state = get();
      const existing = state.tabs.find(
        (tab) =>
          tab.connectionId === connectionId &&
          tab.type === "enum-detail" &&
          tab.enumName === trimmedEnumName &&
          (tab.enumSchema?.trim() || null) === trimmedEnumSchema,
      );

      if (existing) {
        set({
          activeTabId: existing.id,
          selectedTable: null,
        });
        return;
      }

      const id = `enum-${++tabCounter}-${Date.now()}`;
      const tab = {
        id,
        connectionId,
        type: "enum-detail" as const,
        title,
        enumName: trimmedEnumName,
        enumSchema: trimmedEnumSchema,
      };

      set((currentState) => ({
        tabs: [...currentState.tabs, tab].slice(-MAX_TABS),
        activeTabId: id,
        selectedTable: null,
      }));
    },
  };
}
