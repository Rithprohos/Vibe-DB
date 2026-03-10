import type { Connection } from '@/store/useAppStore';

export function getConnectionDatabaseName(
  connection: Pick<Connection, 'type' | 'database'>,
): string | null {
  if (connection.type !== 'postgres') {
    return null;
  }

  return connection.database?.trim() || 'postgres';
}
