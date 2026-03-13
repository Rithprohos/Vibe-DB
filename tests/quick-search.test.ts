import { describe, expect, test } from 'bun:test';

import {
  buildQuickSearchTableItems,
  getQuickSearchRecentTableItems,
  normalizeQuickSearchQuery,
  searchQuickSearchTableItems,
} from '../src/lib/quickSearch';
import type { QuickSearchRecentItem, TableInfo } from '../src/store/useAppStore';

const TABLES: TableInfo[] = [
  { name: 'users', table_type: 'table' },
  { name: 'user_sessions', table_type: 'table' },
  { name: 'audit_log', table_type: 'table' },
  { name: 'users', table_type: 'table', schema: 'admin' },
  { name: 'user_view', table_type: 'view' },
];
const RECENT_ITEMS: QuickSearchRecentItem[] = [
  { connectionId: 'conn-a', tableName: 'audit_log', openedAt: 30 },
  { connectionId: 'conn-b', tableName: 'users', openedAt: 20 },
  { connectionId: 'conn-a', tableName: 'admin.users', openedAt: 10 },
];

describe('quick search helpers', () => {
  test('normalizes queries consistently', () => {
    expect(normalizeQuickSearchQuery('  Users  ')).toBe('users');
  });

  test('builds searchable items for tables only', () => {
    const items = buildQuickSearchTableItems(TABLES);

    expect(items.map((item) => item.qualifiedName)).toEqual([
      'admin.users',
      'audit_log',
      'user_sessions',
      'users',
    ]);
  });

  test('ranks exact name matches above prefix and substring matches', () => {
    const items = buildQuickSearchTableItems(TABLES);
    const matches = searchQuickSearchTableItems(items, 'users', 10);

    expect(matches.map((item) => item.qualifiedName)).toEqual([
      'users',
      'admin.users',
    ]);
  });

  test('matches schema-qualified tables by schema fragments', () => {
    const items = buildQuickSearchTableItems(TABLES);
    const matches = searchQuickSearchTableItems(items, 'admin', 10);

    expect(matches.map((item) => item.qualifiedName)).toEqual(['admin.users']);
  });

  test('returns recent tables scoped to the active connection', () => {
    const items = buildQuickSearchTableItems(TABLES);
    const matches = getQuickSearchRecentTableItems(items, RECENT_ITEMS, 'conn-a', 10);

    expect(matches.map((item) => item.qualifiedName)).toEqual([
      'audit_log',
      'admin.users',
    ]);
  });

  test('respects the result limit', () => {
    const items = buildQuickSearchTableItems(TABLES);
    const matches = searchQuickSearchTableItems(items, 'user', 2);

    expect(matches).toHaveLength(2);
  });
});
