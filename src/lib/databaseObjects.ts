import type { TableInfo } from '@/store/useAppStore';

export const ALL_SCHEMAS_VALUE = '__all__';

export function getQualifiedTableName(table: Pick<TableInfo, 'name' | 'schema'>): string {
  const schema = table.schema?.trim();
  if (!schema) {
    return table.name;
  }

  return `${schema}.${table.name}`;
}

export function getSchemaName(table: Pick<TableInfo, 'schema'>): string | null {
  const schema = table.schema?.trim();
  return schema ? schema : null;
}

export function splitQualifiedTableName(tableName: string): {
  schema: string | null;
  name: string;
} {
  const parts = tableName
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return {
      schema: null,
      name: tableName.trim(),
    };
  }

  return {
    schema: parts.slice(0, -1).join('.'),
    name: parts[parts.length - 1],
  };
}

export function replaceQualifiedTableName(tableName: string, nextName: string): string {
  const { schema } = splitQualifiedTableName(tableName);
  if (!schema) {
    return nextName;
  }

  return `${schema}.${nextName}`;
}
