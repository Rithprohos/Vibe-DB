import { describe, expect, test } from "bun:test";

import {
  getTableTransferContextKey,
  resolveTableTransferContext,
} from "../src/features/table-transfer/state";
import { removeTableTransferContextForConnection } from "../src/store/slices/connectionSlice";
import { updateTableTransferContextForTab } from "../src/store/slices/tabsSlice";
import type { PersistedTableTransferContext, TableViewState } from "../src/store/types";

function createTableViewState(
  overrides: Partial<TableViewState> = {},
): TableViewState {
  return {
    data: null,
    totalRows: null,
    structure: null,
    page: 0,
    pageSize: 100,
    sortCol: null,
    sortDir: "ASC",
    showFilterPanel: false,
    filters: [],
    appliedFilters: [],
    isInspectorOpen: false,
    selectedRowIndex: null,
    ...overrides,
  };
}

describe("table transfer context resolution", () => {
  test("uses persisted table transfer context when the table tab is closed", () => {
    const contextKey = getTableTransferContextKey("conn-1", "public.users");

    const context = resolveTableTransferContext(
      {
        activeTabId: null,
        tabs: [],
        tableViewStateByTabId: {},
        tableTransferContextByKey: {
          [contextKey]: {
            appliedFilters: [
              {
                id: "filter-1",
                field: "name",
                operator: "=",
                value: "Ada",
                valueTo: "",
              },
            ],
            sortCol: "created_at",
            sortDir: "DESC",
          },
        },
      },
      "conn-1",
      "public.users",
    );

    expect(context).toEqual({
      filters: [
        {
          field: "name",
          operator: "=",
          value: "Ada",
          valueTo: "",
        },
      ],
      sortCol: "created_at",
      sortDir: "DESC",
    });
  });

  test("falls back to the open table tab state when no persisted context exists", () => {
    const context = resolveTableTransferContext(
      {
        activeTabId: "tab-1",
        tabs: [
          {
            id: "tab-1",
            connectionId: "conn-1",
            type: "data",
            title: "users",
            tableName: "users",
          },
        ],
        tableViewStateByTabId: {
          "tab-1": createTableViewState({
            appliedFilters: [
              {
                id: "filter-1",
                field: "id",
                operator: ">=",
                value: "10",
                valueTo: "",
              },
            ],
            sortCol: "id",
            sortDir: "ASC",
          }),
        },
        tableTransferContextByKey: {},
      },
      "conn-1",
      "users",
    );

    expect(context).toEqual({
      filters: [
        {
          field: "id",
          operator: ">=",
          value: "10",
          valueTo: "",
        },
      ],
      sortCol: "id",
      sortDir: "ASC",
    });
  });
});

describe("table transfer context store helpers", () => {
  test("updates persisted transfer context from data tabs only", () => {
    const next = updateTableTransferContextForTab(
      {},
      {
        connectionId: "conn-1",
        tableName: "users",
        type: "data",
      },
      createTableViewState({
        appliedFilters: [
          {
            id: "filter-1",
            field: "email",
            operator: "LIKE",
            value: "%@example.com",
            valueTo: "",
          },
        ],
        sortCol: "email",
        sortDir: "DESC",
      }),
    );

    expect(next).toEqual<Record<string, PersistedTableTransferContext>>({
      "conn-1:users": {
        appliedFilters: [
          {
            id: "filter-1",
            field: "email",
            operator: "LIKE",
            value: "%@example.com",
            valueTo: "",
          },
        ],
        sortCol: "email",
        sortDir: "DESC",
      },
    });
  });

  test("removes transfer context entries when a connection is deleted", () => {
    const next = removeTableTransferContextForConnection(
      {
        "conn-1:users": {
          appliedFilters: [],
          sortCol: null,
          sortDir: "ASC",
        },
        "conn-2:orders": {
          appliedFilters: [],
          sortCol: "id",
          sortDir: "DESC",
        },
      },
      "conn-1",
    );

    expect(next).toEqual({
      "conn-2:orders": {
        appliedFilters: [],
        sortCol: "id",
        sortDir: "DESC",
      },
    });
  });
});
