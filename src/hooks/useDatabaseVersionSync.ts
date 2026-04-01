import { useEffect } from 'react';
import { getDatabaseVersion } from '../lib/db';
import { useAppStore, type AppState } from '../store/useAppStore';

function getActiveConnectionConnId(state: AppState): string | null {
  return (
    state.connections.find((connection) => connection.id === state.activeSidebarConnectionId)?.connId
      ?? null
  );
}

export function useDatabaseVersionSync(): void {
  useEffect(() => {
    let cancelled = false;
    let lastConnId: string | null = null;

    const setDatabaseVersion = useAppStore.getState().setDatabaseVersion;

    const syncActiveDatabaseVersion = async (connId: string | null) => {
      if (!connId) {
        setDatabaseVersion(null);
        return;
      }

      try {
        const version = await getDatabaseVersion(connId);
        if (!cancelled) {
          setDatabaseVersion(version);
        }
      } catch {
        if (!cancelled) {
          setDatabaseVersion(null);
        }
      }
    };

    const initialState = useAppStore.getState();
    lastConnId = getActiveConnectionConnId(initialState);
    void syncActiveDatabaseVersion(lastConnId);

    const unsubscribe = useAppStore.subscribe((state) => {
      const nextConnId = getActiveConnectionConnId(state);
      if (nextConnId === lastConnId) {
        return;
      }

      lastConnId = nextConnId;
      void syncActiveDatabaseVersion(nextConnId);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
}
