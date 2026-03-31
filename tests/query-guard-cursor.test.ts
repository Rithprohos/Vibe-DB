import { describe, expect, test } from 'bun:test';

import { getSqlStatementAtCursor, splitSqlStatements } from '../src/lib/queryGuard';

describe('query guard cursor statement resolution', () => {
  test('resolves the statement that contains the cursor', () => {
    const query = 'select * from groups;\n\nselect * from ai_usage;';
    const cursor = query.indexOf('ai_usage');
    const statement = getSqlStatementAtCursor(query, cursor);

    expect(statement?.sql).toBe('select * from ai_usage');
  });

  test('uses nearest previous statement when cursor is between statements', () => {
    const query = 'select * from groups;\n\nselect * from ai_usage;';
    const cursor = query.indexOf('\n\n') + 1;
    const statement = getSqlStatementAtCursor(query, cursor);

    expect(statement?.sql).toBe('select * from groups');
  });

  test('uses next statement when cursor is in leading whitespace', () => {
    const query = ' \n  select 1;\nselect 2;';
    const statement = getSqlStatementAtCursor(query, 0);

    expect(statement?.sql).toBe('select 1');
  });

  test('ignores semicolons in comments and string literals when splitting', () => {
    const query = "select ';' as semi; -- comment; still comment\nselect 2;";

    expect(splitSqlStatements(query)).toEqual([
      "select ';' as semi",
      '-- comment; still comment\nselect 2',
    ]);

    const cursor = query.indexOf('select 2') + 1;
    const statement = getSqlStatementAtCursor(query, cursor);
    expect(statement?.sql).toBe('-- comment; still comment\nselect 2');
  });

  test('returns null when there is no executable statement', () => {
    expect(getSqlStatementAtCursor('   \n\t', 0)).toBeNull();
  });
});
