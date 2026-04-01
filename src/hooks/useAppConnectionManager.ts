import { useCallback, useEffect, useRef, useState } from 'react';
import { connectDatabase, getDatabaseVersion, listEnums, listTables, type EnumInfo } from '../lib/db';
import {
  getStoredConnectionAuthToken,
  getStoredConnectionPassword,
  saveStoredConnectionAuthToken,
  saveStoredConnectionPassword,
} from '../lib/connectionTokenStore';
import { flushStorage } from '../store/storage';
import { useAppStore, type AppState, type Connection } from '../store/useAppStore';

export type ConnectSource = 'manual' | 'restore';
type ConnectionProgressStep = 'restoring' | 'loading-token' | 'connecting' | 'loading-schema';

export interface ConnectionProgressState {
  connectionName: string;
  connectionType: Connection['type'];
  source: ConnectSource;
  step: ConnectionProgressStep;
}

const selectAddConnection = (state: AppState) => state.addConnection;
const selectAddTab = (state: AppState) => state.addTab;
const selectSetActiveSidebarConnection = (state: AppState) => state.setActiveSidebarConnection;
const selectSetDatabaseVersion = (state: AppState) => state.setDatabaseVersion;
const selectSetIsConnected = (state: AppState) => state.setIsConnected;
const selectSetTables = (state: AppState) => state.setTables;
const selectSetEnums = (state: AppState) => state.setEnums;
const selectUpdateConnection = (state: AppState) => state.updateConnection;

function isRemoteTursoConnection(connection: Connection): boolean {
  return connection.type === 'turso' && Boolean(connection.host?.trim());
}

function isPostgresConnection(connection: Connection): boolean {
  return connection.type === 'postgres';
}

export function useAppConnectionManager() {
  const addConnection = useAppStore(selectAddConnection);
  const addTab = useAppStore(selectAddTab);
  const setActiveSidebarConnection = useAppStore(selectSetActiveSidebarConnection);
  const setDatabaseVersion = useAppStore(selectSetDatabaseVersion);
  const setIsConnected = useAppStore(selectSetIsConnected);
  const setTables = useAppStore(selectSetTables);
  const setEnums = useAppStore(selectSetEnums);
  const updateConnection = useAppStore(selectUpdateConnection);
  const autoConnectAttempted = useRef(false);
  const tokenMigrationAttempted = useRef(false);
  const [startupRestoreChecked, setStartupRestoreChecked] = useState(false);
  const [connectionProgress, setConnectionProgress] = useState<ConnectionProgressState | null>(
    null,
  );

  const migrateLegacyConnectionTokens = useCallback(async () => {
    if (tokenMigrationAttempted.current) {
      return;
    }

    tokenMigrationAttempted.current = true;

    const legacyConnections = useAppStore
      .getState()
      .connections.filter(
        (connection) =>
          connection.type === 'turso' &&
          typeof connection.authToken === 'string' &&
          connection.authToken.trim().length > 0,
      );

    for (const connection of legacyConnections) {
      const token = connection.authToken?.trim();
      if (!token) {
        continue;
      }

      try {
        await saveStoredConnectionAuthToken(connection.id, token);
        useAppStore.getState().updateConnection(connection.id, {
          authToken: undefined,
          hasAuthToken: true,
        });
      } catch (error) {
        console.error(`Failed to migrate token for connection ${connection.id}:`, error);
      }
    }
  }, []);

  const handleConnect = useCallback(
    async (connection: Connection, source: ConnectSource = 'manual') => {
      const progressBase = {
        connectionName: connection.name,
        connectionType: connection.type,
        source,
      } as const;

      setConnectionProgress({
        ...progressBase,
        step: source === 'restore' ? 'restoring' : 'connecting',
      });

      try {
        let connId = connection.connId;
        const remoteTurso = isRemoteTursoConnection(connection);
        const postgresConnection = isPostgresConnection(connection);
        let hasAuthToken: boolean | undefined = remoteTurso
          ? Boolean(connection.hasAuthToken)
          : undefined;
        let hasPassword: boolean | undefined = postgresConnection
          ? Boolean(connection.hasPassword)
          : undefined;

        if (!connId) {
          let authToken = connection.authToken?.trim() || undefined;
          let password = connection.password?.trim() || undefined;

          if (!authToken && remoteTurso) {
            setConnectionProgress({ ...progressBase, step: 'loading-token' });
            authToken = (await getStoredConnectionAuthToken(connection.id)) ?? undefined;
          }

          if (!password && postgresConnection && connection.hasPassword) {
            setConnectionProgress({ ...progressBase, step: 'loading-token' });
            password = (await getStoredConnectionPassword(connection.id)) ?? undefined;
          }

          if (remoteTurso && !authToken) {
            throw new Error('Auth token is required for remote Turso connections');
          }

          if (remoteTurso && authToken) {
            await saveStoredConnectionAuthToken(connection.id, authToken);
          }

          if (postgresConnection && password) {
            await saveStoredConnectionPassword(connection.id, password);
          }

          const connectPayload: Connection = {
            ...connection,
            authToken,
            password,
          };

          hasAuthToken = remoteTurso ? Boolean(authToken) : undefined;
          hasPassword = postgresConnection ? Boolean(password) : undefined;

          const persistedConnection: Connection = {
            ...connection,
            authToken: undefined,
            password: undefined,
            hasAuthToken,
            hasPassword,
          };

          setConnectionProgress({ ...progressBase, step: 'connecting' });
          connId = await connectDatabase(connectPayload);
          const version = await getDatabaseVersion(connId);

          addConnection(persistedConnection);
          updateConnection(connection.id, {
            connId,
            lastUsed: Date.now(),
            hasAuthToken,
            hasPassword,
            authToken: undefined,
            password: undefined,
          });
          setDatabaseVersion(version);
        } else {
          updateConnection(connection.id, {
            lastUsed: Date.now(),
            hasAuthToken,
            hasPassword,
            authToken: undefined,
            password: undefined,
          });
        }

        if (!connId) {
          throw new Error('Failed to establish a connection');
        }

        setConnectionProgress({ ...progressBase, step: 'loading-schema' });
        const [tables, enums] = await Promise.all([
          listTables(connId),
          connection.type === 'postgres'
            ? listEnums(connId).catch((error) => {
                console.error('Failed to load enums:', error);
                return [] as EnumInfo[];
              })
            : Promise.resolve([] as EnumInfo[]),
        ]);
        setTables(connection.id, tables);
        setEnums(connection.id, enums);
        setIsConnected(true);
        setActiveSidebarConnection(connection.id);

        if (tables.length === 0) {
          addTab({
            id: `query-welcome-${Date.now()}`,
            connectionId: connection.id,
            type: 'query',
            title: 'Query 1',
            query:
              '-- Welcome to VibeDB! 🚀\n-- This is a fresh database. Create your first table:\n\nCREATE TABLE users (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  email TEXT UNIQUE,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n',
          });
        }

        await flushStorage();
      } catch (error: unknown) {
        console.error('Failed to connect:', error);

        if (
          useAppStore.getState().connections.filter((candidate) => candidate.connId).length === 0
        ) {
          setIsConnected(false);
        }

        const message = error instanceof Error ? error.toString() : String(error);
        alert(`Failed to connect: ${message}`);
      } finally {
        setConnectionProgress(null);
      }
    },
    [
      addConnection,
      addTab,
      setActiveSidebarConnection,
      setDatabaseVersion,
      setIsConnected,
      setTables,
      setEnums,
      updateConnection,
    ],
  );

  useEffect(() => {
    const doAutoConnect = async () => {
      if (autoConnectAttempted.current) {
        return;
      }

      autoConnectAttempted.current = true;

      try {
        await migrateLegacyConnectionTokens();
        const state = useAppStore.getState();

        if (state.activeSidebarConnectionId && !state.isConnected) {
          const connectionToRestore = state.connections.find(
            (connection) => connection.id === state.activeSidebarConnectionId,
          );

          if (connectionToRestore) {
            await handleConnect(connectionToRestore, 'restore');
          }
        }
      } finally {
        setStartupRestoreChecked(true);
      }
    };

    const unsubscribe = useAppStore.persist.onFinishHydration(() => {
      void doAutoConnect();
    });

    if (useAppStore.persist.hasHydrated()) {
      void doAutoConnect();
    }

    return unsubscribe;
  }, [handleConnect, migrateLegacyConnectionTokens]);

  return {
    connectionProgress,
    handleConnect,
    startupRestoreChecked,
  };
}
