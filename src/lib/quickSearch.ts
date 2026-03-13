import { getQualifiedTableName, getSchemaName } from '@/lib/databaseObjects';
import type { TableInfo } from '@/store/useAppStore';

export interface QuickSearchTableItem {
  qualifiedName: string;
  name: string;
  schema: string | null;
  qualifiedNameLower: string;
  nameLower: string;
  schemaLower: string;
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export function normalizeQuickSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function buildQuickSearchTableItems(
  tables: TableInfo[],
): QuickSearchTableItem[] {
  return tables
    .filter((table) => table.table_type === 'table')
    .map((table) => {
      const qualifiedName = getQualifiedTableName(table);
      const schema = getSchemaName(table);

      return {
        qualifiedName,
        name: table.name,
        schema,
        qualifiedNameLower: qualifiedName.toLowerCase(),
        nameLower: table.name.toLowerCase(),
        schemaLower: schema?.toLowerCase() ?? '',
      };
    })
    .sort((left, right) =>
      collator.compare(left.qualifiedName, right.qualifiedName),
    );
}

export function searchQuickSearchTableItems(
  items: QuickSearchTableItem[],
  query: string,
  limit: number,
): QuickSearchTableItem[] {
  if (limit <= 0) {
    return [];
  }

  if (!query) {
    return items.slice(0, limit);
  }

  const exactQualifiedMatches: QuickSearchTableItem[] = [];
  const exactNameMatches: QuickSearchTableItem[] = [];
  const namePrefixMatches: QuickSearchTableItem[] = [];
  const qualifiedPrefixMatches: QuickSearchTableItem[] = [];
  const nameSubstringMatches: QuickSearchTableItem[] = [];
  const fallbackMatches: QuickSearchTableItem[] = [];

  for (const item of items) {
    if (item.qualifiedNameLower === query) {
      exactQualifiedMatches.push(item);
      continue;
    }

    if (item.nameLower === query) {
      exactNameMatches.push(item);
      continue;
    }

    if (item.nameLower.startsWith(query)) {
      namePrefixMatches.push(item);
      continue;
    }

    if (item.qualifiedNameLower.startsWith(query)) {
      qualifiedPrefixMatches.push(item);
      continue;
    }

    if (item.nameLower.includes(query)) {
      nameSubstringMatches.push(item);
      continue;
    }

    if (
      item.qualifiedNameLower.includes(query) ||
      item.schemaLower.includes(query)
    ) {
      fallbackMatches.push(item);
    }
  }

  return [
    ...exactQualifiedMatches,
    ...exactNameMatches,
    ...namePrefixMatches,
    ...qualifiedPrefixMatches,
    ...nameSubstringMatches,
    ...fallbackMatches,
  ].slice(0, limit);
}
