import { DEFAULT_TABLE_PAGE_SIZE } from "./constants";
import type { Tab, TabType, TableViewState } from "./types";

function isDataBearingTab(type: TabType): boolean {
  return type === "data" || type === "structure" || type === "edit-table";
}

export function getSelectedTableForTab(tab?: Tab | null): string | null {
  if (!tab || !isDataBearingTab(tab.type)) {
    return null;
  }
  return tab.tableName ?? null;
}

export function createDefaultTableViewState(): TableViewState {
  return {
    data: null,
    hasLoadedData: false,
    totalRows: 0,
    hasLoadedRowCount: false,
    structure: null,
    hasLoadedStructure: false,
    page: 0,
    pageSize: DEFAULT_TABLE_PAGE_SIZE,
    sortCol: null,
    sortDir: "ASC",
    showFilterPanel: false,
    filters: [],
    appliedFilters: [],
    isInspectorOpen: false,
    selectedRowIndex: null,
  };
}

export function pruneTableViewStateByTabs(
  tableViewStateByTabId: Record<string, TableViewState>,
  tabs: Tab[],
): Record<string, TableViewState> {
  if (tabs.length === 0) {
    return {};
  }

  const activeIds = new Set(tabs.map((tab) => tab.id));
  return Object.fromEntries(
    Object.entries(tableViewStateByTabId).filter(([tabId]) => activeIds.has(tabId)),
  );
}
