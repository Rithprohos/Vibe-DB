import { useEffect } from 'react';
import { getDatabaseVersion } from '../lib/db';
import { useAppStore, type AppState } from '../store/useAppStore';

const selectActiveSidebarConnectionId = (state: AppState) => state.activeSidebarConnectionId;
const selectActiveConnectionConnId = (state: AppState) =>
  state.connections.find((connection) => connection.id === state.activeSidebarConnectionId)?.connId
    ?? null;
const selectSetDatabaseVersion = (state: AppState) => state.setDatabaseVersion;

export function useDatabaseVersionSync(): void {
  const activeSidebarConnectionId = useAppStore(selectActiveSidebarConnectionId);
  const activeConnectionConnId = useAppStore(selectActiveConnectionConnId);
  const setDatabaseVersion = useAppStore(selectSetDatabaseVersion);

  useEffect(() => {
    let cancelled = false;

    const syncActiveDatabaseVersion = async () => {
      if (!activeConnectionConnId) {
        setDatabaseVersion(null);
        return;
      }

      try {
        const version = await getDatabaseVersion(activeConnectionConnId);
        if (!cancelled) {
          setDatabaseVersion(version);
        }
      } catch {
        if (!cancelled) {
          setDatabaseVersion(null);
        }
      }
    };

    void syncActiveDatabaseVersion();

    return () => {
      cancelled = true;
    };
  }, [activeConnectionConnId, activeSidebarConnectionId, setDatabaseVersion]);
}
