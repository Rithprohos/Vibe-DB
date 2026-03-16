import { getQualifiedTableName } from "@/lib/databaseObjects";
import type { TableInfo } from "@/store/useAppStore";

export function orderPinnedTablesFirst(
  tables: TableInfo[],
  pinnedTableNames: ReadonlySet<string>,
): TableInfo[] {
  if (tables.length <= 1 || pinnedTableNames.size === 0) {
    return tables;
  }

  const pinnedTables: TableInfo[] = [];
  const unpinnedTables: TableInfo[] = [];

  for (const table of tables) {
    if (pinnedTableNames.has(getQualifiedTableName(table))) {
      pinnedTables.push(table);
      continue;
    }

    unpinnedTables.push(table);
  }

  if (pinnedTables.length === 0 || unpinnedTables.length === 0) {
    return tables;
  }

  return [...pinnedTables, ...unpinnedTables];
}
