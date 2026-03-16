import { describe, expect, test } from "bun:test";

import { orderPinnedTablesFirst } from "../src/lib/sidebarTablePinning";
import {
  prunePinnedTablesForConnection,
  removePinnedTablesForConnection,
  togglePinnedTableForConnection,
} from "../src/store/slices/connectionSlice";
import type { TableInfo } from "../src/store/useAppStore";

const TABLES: TableInfo[] = [
  { name: "users", schema: "admin", table_type: "table" },
  { name: "audit_log", table_type: "table" },
  { name: "users", schema: "public", table_type: "table" },
  { name: "zebra", table_type: "table" },
];

describe("sidebar table pinning order", () => {
  test("places pinned tables first while preserving existing order inside each group", () => {
    const ordered = orderPinnedTablesFirst(
      TABLES,
      new Set(["audit_log", "public.users"]),
    );

    expect(ordered.map((table) => `${table.schema ? `${table.schema}.` : ""}${table.name}`)).toEqual([
      "audit_log",
      "public.users",
      "admin.users",
      "zebra",
    ]);
  });

  test("handles schema-qualified names independently", () => {
    const ordered = orderPinnedTablesFirst(TABLES, new Set(["admin.users"]));

    expect(ordered.map((table) => `${table.schema ? `${table.schema}.` : ""}${table.name}`)).toEqual([
      "admin.users",
      "audit_log",
      "public.users",
      "zebra",
    ]);
  });
});

describe("connection pinning state helpers", () => {
  test("toggles pinned tables per connection", () => {
    const initial = {
      connA: ["public.users"],
      connB: ["orders"],
    };

    const afterPin = togglePinnedTableForConnection(initial, "connA", "audit_log");
    expect(afterPin).toEqual({
      connA: ["public.users", "audit_log"],
      connB: ["orders"],
    });

    const afterUnpin = togglePinnedTableForConnection(afterPin, "connA", "public.users");
    expect(afterUnpin).toEqual({
      connA: ["audit_log"],
      connB: ["orders"],
    });
  });

  test("prunes stale pinned table names when table metadata refreshes", () => {
    const initial = {
      connA: ["public.users", "ghost_table"],
      connB: ["orders"],
    };

    const pruned = prunePinnedTablesForConnection(initial, "connA", [
      { name: "users", schema: "public", table_type: "table" },
      { name: "profiles", schema: "public", table_type: "table" },
    ]);

    expect(pruned).toEqual({
      connA: ["public.users"],
      connB: ["orders"],
    });
  });

  test("removes pinned tables for a deleted connection", () => {
    const next = removePinnedTablesForConnection(
      {
        connA: ["users"],
        connB: ["orders"],
      },
      "connA",
    );

    expect(next).toEqual({
      connB: ["orders"],
    });
  });
});
