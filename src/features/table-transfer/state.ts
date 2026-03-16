import type { AppState, PersistedTableTransferContext, TableViewState } from '@/store/types';
import type { TableTransferContext } from './types';

export function getTableTransferContextKey(connectionId: string, tableName: string): string {
  return `${connectionId}:${tableName}`;
}

function toTableTransferContext(
  context: Pick<PersistedTableTransferContext, 'appliedFilters' | 'sortCol' | 'sortDir'>,
): TableTransferContext {
  return {
    filters: context.appliedFilters.map((filter) => ({
      field: filter.field,
      operator: filter.operator,
      value: filter.value,
      valueTo: filter.valueTo,
    })),
    sortCol: context.sortCol,
    sortDir: context.sortDir,
  };
}

function tableViewStateToTransferContext(
  tableState: Pick<TableViewState, 'appliedFilters' | 'sortCol' | 'sortDir'>,
): TableTransferContext {
  return toTableTransferContext(tableState);
}

export function resolveTableTransferContext(
  state: Pick<
    AppState,
    'activeTabId' | 'tabs' | 'tableViewStateByTabId' | 'tableTransferContextByKey'
  >,
  connectionId: string,
  tableName: string,
): TableTransferContext {
  const persistedContext =
    state.tableTransferContextByKey[getTableTransferContextKey(connectionId, tableName)];
  if (persistedContext) {
    return toTableTransferContext(persistedContext);
  }

  const matchingTabs = state.tabs.filter(
    (tab) =>
      tab.type === 'data' &&
      tab.connectionId === connectionId &&
      tab.tableName === tableName,
  );

  if (matchingTabs.length === 0) {
    return {};
  }

  const preferredTab =
    matchingTabs.find((tab) => tab.id === state.activeTabId) ??
    matchingTabs[matchingTabs.length - 1];
  const tableState = state.tableViewStateByTabId[preferredTab.id];

  if (!tableState) {
    return {};
  }

  return tableViewStateToTransferContext(tableState);
}
