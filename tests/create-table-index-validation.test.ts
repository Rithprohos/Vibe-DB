import { describe, expect, test } from 'bun:test';

import { getLiveConstraintError } from '../src/components/create-table/validation';
import type { CreateTableIndex } from '../src/lib/createTableConstants';

function buildIndex(overrides: Partial<CreateTableIndex> = {}): CreateTableIndex {
  return {
    id: 'idx-1',
    name: '',
    columns: [],
    unique: false,
    method: undefined,
    ...overrides,
  };
}

describe('create table index validation', () => {
  test('requires index name when index row has values', () => {
    const error = getLiveConstraintError({
      engineType: 'sqlite',
      foreignKeys: [],
      checkConstraints: [],
      indexes: [buildIndex({ columns: ['email'] })],
      namedColumnNames: new Set(['email']),
    });

    expect(error).toBe('Index #1 name is required');
  });

  test('rejects duplicate index names case-insensitively', () => {
    const error = getLiveConstraintError({
      engineType: 'sqlite',
      foreignKeys: [],
      checkConstraints: [],
      indexes: [
        buildIndex({ id: 'idx-1', name: 'idx_users_email', columns: ['email'] }),
        buildIndex({ id: 'idx-2', name: 'IDX_USERS_EMAIL', columns: ['name'] }),
      ],
      namedColumnNames: new Set(['email', 'name']),
    });

    expect(error).toBe('Index "IDX_USERS_EMAIL" already exists');
  });

  test('rejects unknown index column names', () => {
    const error = getLiveConstraintError({
      engineType: 'sqlite',
      foreignKeys: [],
      checkConstraints: [],
      indexes: [buildIndex({ name: 'idx_users_email', columns: ['email'] })],
      namedColumnNames: new Set(['name']),
    });

    expect(error).toBe('Index #1 references unknown column "email"');
  });

  test('rejects index method outside postgres', () => {
    const error = getLiveConstraintError({
      engineType: 'sqlite',
      foreignKeys: [],
      checkConstraints: [],
      indexes: [buildIndex({ name: 'idx_users_email', columns: ['email'], method: 'btree' })],
      namedColumnNames: new Set(['email']),
    });

    expect(error).toBe('Index #1: index method is only supported for PostgreSQL');
  });

  test('rejects UNIQUE index with non-btree postgres method', () => {
    const error = getLiveConstraintError({
      engineType: 'postgres',
      foreignKeys: [],
      checkConstraints: [],
      indexes: [
        buildIndex({
          name: 'idx_users_email',
          columns: ['email'],
          unique: true,
          method: 'gin',
        }),
      ],
      namedColumnNames: new Set(['email']),
    });

    expect(error).toBe('Index #1: UNIQUE indexes only support the BTREE method');
  });
});
