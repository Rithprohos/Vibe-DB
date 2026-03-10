import { lazy, Suspense, useEffect, useCallback, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Cloud, Database, LoaderCircle } from 'lucide-react';
import { useAppStore, type Connection } from './store/useAppStore';
import { listTables, connectDatabase, getDatabaseVersion } from './lib/db';
import {
  getStoredConnectionAuthToken,
  saveStoredConnectionAuthToken,
} from './lib/connectionTokenStore';
import DatabaseBar from './components/DatabaseBar';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
import WelcomeScreen from './components/WelcomeScreen';
import EmptyTabScreen from './components/EmptyTabScreen';
import TopBar from './components/TopBar';
import { useDevRenderCounter } from './lib/dev-performance';
import './index.css';

const ConnectionDialog = lazy(() => import('./components/ConnectionDialog'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const LogDrawer = lazy(() => import('./components/LogDrawer'));
const TableView = lazy(() => import('./components/TableView/index'));
const TableStructure = lazy(() => import('./components/TableStructure'));
const QueryEditor = lazy(() => import('./components/QueryEditor'));
const CreateTable = lazy(() => import('./components/CreateTable'));
const CreateView = lazy(() => import('./components/CreateView'));
const EditTable = lazy(() => import('./components/EditTable'));
const AiPanel = lazy(() => import('./components/AiPanel'));
const AlertModal = lazy(() => import('./components/AlertModal'));
const ToastViewport = lazy(() => import('./components/ToastViewport'));

function ContentLoading() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground w-full">
      <span className="text-sm font-medium tracking-wide">Loading view...</span>
    </div>
  );
}

interface SqlLogEvent {
  sql: string;
  status: 'success' | 'error';
  duration: number;
  message: string;
}

type ConnectSource = 'manual' | 'restore';
type ConnectionProgressStep = 'restoring' | 'loading-token' | 'connecting' | 'loading-schema';

interface ConnectionProgressState {
  connectionName: string;
  connectionType: Connection['type'];
  source: ConnectSource;
  step: ConnectionProgressStep;
}

function getConnectionProgressStepLabel(step: ConnectionProgressStep): string {
  switch (step) {
    case 'restoring':
      return 'Restoring previous session...';
    case 'loading-token':
      return 'Loading secure credentials...';
    case 'connecting':
      return 'Connecting to database...';
    case 'loading-schema':
      return 'Loading tables and metadata...';
    default:
      return 'Connecting...';
  }
}

function ConnectionRestoreLoading({
  startupCheckPending,
  progress,
}: {
  startupCheckPending: boolean;
  progress: ConnectionProgressState | null;
}) {
  const title = progress
    ? progress.source === 'restore'
      ? `Restoring ${progress.connectionName}`
      : `Connecting to ${progress.connectionName}`
    : 'Restoring previous session';
  const subtitle = progress
    ? getConnectionProgressStepLabel(progress.step)
    : 'Checking saved connection...';
  const isTurso = progress?.connectionType === 'turso';

  return (
    <div className="flex h-full w-full items-center justify-center bg-background p-8">
      <div className="w-full max-w-md rounded-md border border-border/70 bg-secondary/20 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-background text-primary">
            {isTurso ? <Cloud size={16} /> : <Database size={16} />}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{title}</div>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
          <LoaderCircle size={16} className="ml-auto animate-spin text-primary" />
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-sm border border-border bg-background">
          <div className="h-full w-1/2 animate-pulse bg-primary/70" />
        </div>
        {startupCheckPending && !progress && (
          <div className="mt-3 text-[11px] text-muted-foreground">
            Preparing workspace...
          </div>
        )}
      </div>
    </div>
  );
}

function isRemoteTursoConnection(connection: Connection): boolean {
  return connection.type === 'turso' && Boolean(connection.host?.trim());
}

export default function App() {
  useDevRenderCounter('App');

  // Use granular selectors to prevent unnecessary re-renders
  const connections = useAppStore(s => s.connections);
  const isConnected = useAppStore(s => s.isConnected);
  const showConnectionDialog = useAppStore(s => s.showConnectionDialog);
  const tabs = useAppStore(s => s.tabs);
  const activeTabId = useAppStore(s => s.activeTabId);
  const theme = useAppStore(s => s.theme);
  const setTables = useAppStore(s => s.setTables);
  const setIsConnected = useAppStore(s => s.setIsConnected);
  const addConnection = useAppStore(s => s.addConnection);
  const updateConnection = useAppStore(s => s.updateConnection);
  const setActiveSidebarConnection = useAppStore(s => s.setActiveSidebarConnection);
  const addTab = useAppStore(s => s.addTab);
  const setDatabaseVersion = useAppStore(s => s.setDatabaseVersion);
  const addLog = useAppStore(s => s.addLog);
  const autoConnectAttempted = useRef(false);
  const tokenMigrationAttempted = useRef(false);
  const [startupRestoreChecked, setStartupRestoreChecked] = useState(false);
  const [connectionProgress, setConnectionProgress] = useState<ConnectionProgressState | null>(null);

  const migrateLegacyConnectionTokens = useCallback(async () => {
    if (tokenMigrationAttempted.current) return;
    tokenMigrationAttempted.current = true;

    const state = useAppStore.getState();
    const legacyConnections = state.connections.filter(
      (connection) =>
        connection.type === 'turso' &&
        typeof connection.authToken === 'string' &&
        connection.authToken.trim().length > 0,
    );

    if (legacyConnections.length === 0) {
      return;
    }

    for (const connection of legacyConnections) {
      const token = connection.authToken?.trim();
      if (!token) continue;

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

  // Apply theme on mount and changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleConnect = useCallback(
    async (conn: Connection, source: ConnectSource = 'manual') => {
      setConnectionProgress({
        connectionName: conn.name,
        connectionType: conn.type,
        source,
        step: source === 'restore' ? 'restoring' : 'connecting',
      });

      try {
        let connId = conn.connId;
        const remoteTurso = isRemoteTursoConnection(conn);
        let hasAuthToken: boolean | undefined = remoteTurso
          ? Boolean(conn.hasAuthToken)
          : undefined;
        
        // If not connected, connect to the tauri backend
        if (!connId) {
          let authToken = conn.authToken?.trim() || undefined;

          if (!authToken && remoteTurso) {
            setConnectionProgress({
              connectionName: conn.name,
              connectionType: conn.type,
              source,
              step: 'loading-token',
            });
            authToken = (await getStoredConnectionAuthToken(conn.id)) ?? undefined;
          }

          if (remoteTurso && !authToken) {
            throw new Error('Auth token is required for remote Turso connections');
          }

          if (remoteTurso && authToken) {
            await saveStoredConnectionAuthToken(conn.id, authToken);
          }

          const connectPayload: Connection = {
            ...conn,
            authToken,
          };

          hasAuthToken = remoteTurso ? Boolean(authToken) : undefined;

          const persistedConnection: Connection = {
            ...conn,
            authToken: undefined,
            hasAuthToken,
          };

          setConnectionProgress({
            connectionName: conn.name,
            connectionType: conn.type,
            source,
            step: 'connecting',
          });
          connId = await connectDatabase(connectPayload);
          const version = await getDatabaseVersion(connId);
          addConnection(persistedConnection);
          updateConnection(conn.id, {
            connId,
            lastUsed: Date.now(),
            hasAuthToken,
            authToken: undefined,
          });
          setDatabaseVersion(version);
        } else {
          updateConnection(conn.id, {
            lastUsed: Date.now(),
            hasAuthToken,
            authToken: undefined,
          });
        }

        // Fetch tables for this specific connection
        setConnectionProgress({
          connectionName: conn.name,
          connectionType: conn.type,
          source,
          step: 'loading-schema',
        });
        const tables = await listTables(connId);
        setTables(conn.id, tables);
        setIsConnected(true);
        setActiveSidebarConnection(conn.id);

        if (tables.length === 0) {
          const queryTabId = `query-welcome-${Date.now()}`;
          addTab({
            id: queryTabId,
            connectionId: conn.id,
            type: 'query',
            title: 'Query 1',
            query: '-- Welcome to VibeDB! 🚀\n-- This is a fresh database. Create your first table:\n\nCREATE TABLE users (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  email TEXT UNIQUE,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n',
          });
        }
      } catch (e: any) {
        console.error('Failed to connect:', e);
        // Only set disconnected if we literally have 0 connections working
        if (connections.filter(c => c.connId).length === 0) {
          setIsConnected(false);
        }
        alert(`Failed to connect: ${e}`);
      } finally {
        setConnectionProgress(null);
      }
    },
    [
      addConnection,
      addTab,
      connections,
      setActiveSidebarConnection,
      setDatabaseVersion,
      setIsConnected,
      setTables,
      updateConnection,
    ]
  );

  // Listen for connect events (from ConnectionDialog or DatabaseBar)
  useEffect(() => {
    const handler = (e: Event) => {
      const conn = (e as CustomEvent).detail as Connection;
      void handleConnect(conn, 'manual');
    };
    window.addEventListener('vibedb:connect', handler);
    return () => window.removeEventListener('vibedb:connect', handler);
  }, [handleConnect]);

  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | null = null;

    listen<SqlLogEvent>('vibedb:sql-log', (event) => {
      const payload = event.payload;
      addLog({
        sql: payload.sql,
        status: payload.status,
        duration: payload.duration,
        message: payload.message,
      });
    }).then((fn) => {
      if (mounted) {
        unsub = fn;
      } else {
        fn();
      }
    });

    return () => {
      mounted = false;
      unsub?.();
    };
  }, [addLog]);

  // Auto-connect previously active connection after store hydrates
  useEffect(() => {
    const doAutoConnect = async () => {
      if (autoConnectAttempted.current) return;
      autoConnectAttempted.current = true;

      try {
        await migrateLegacyConnectionTokens();
        const state = useAppStore.getState();
        if (state.activeSidebarConnectionId && !state.isConnected) {
          const connToRestore = state.connections.find(c => c.id === state.activeSidebarConnectionId);
          if (connToRestore) {
            await handleConnect(connToRestore, 'restore');
          }
        }
      } finally {
        setStartupRestoreChecked(true);
      }
    };
    
    const unsubscribe = useAppStore.persist.onFinishHydration(() => {
      void doAutoConnect();
    });
    
    // Also try immediately in case already hydrated
    if (useAppStore.persist.hasHydrated()) {
      void doAutoConnect();
    }
    
    return unsubscribe;
  }, [handleConnect, migrateLegacyConnectionTokens]);

  // Selectors for keybindings
  const showLogDrawer = useAppStore(s => s.showLogDrawer);
  const setShowLogDrawer = useAppStore(s => s.setShowLogDrawer);
  const showSettingsModal = useAppStore(s => s.showSettingsModal);
  const setShowSettingsModal = useAppStore(s => s.setShowSettingsModal);
  const setShowConnectionDialog = useAppStore(s => s.setShowConnectionDialog);
  const closeTab = useAppStore(s => s.closeTab);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const [hasLoadedLogDrawer, setHasLoadedLogDrawer] = useState(() => useAppStore.getState().showLogDrawer);

  // Preload the lazy chunk so first open of logs feels instant.
  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const preloadLogDrawer = () => {
      if (!cancelled) {
        void import('./components/LogDrawer');
      }
    };

    const hasRequestIdleCallback = typeof window.requestIdleCallback === 'function';
    if (hasRequestIdleCallback) {
      idleId = window.requestIdleCallback(preloadLogDrawer, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(preloadLogDrawer, 600);
    }

    return () => {
      cancelled = true;
      if (idleId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  // Global Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditableTarget = Boolean(
        target &&
        (
          ['INPUT', 'TEXTAREA'].includes(target.tagName) ||
          target.isContentEditable ||
          target.closest('.cm-editor')
        )
      );

      // Keep native editor shortcuts intact inside form fields and CodeMirror.
      if (isEditableTarget && e.key !== ',' && e.key !== 'l') {
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      
      if (isMod && e.key === 'n') {
        e.preventDefault();
        setShowConnectionDialog(true);
      } else if (isMod && e.key === 'w') {
        if (activeTabId) {
          e.preventDefault();
          closeTab(activeTabId);
        }
      } else if (isMod && e.key === 't') {
        e.preventDefault();
        const id = `query-${Date.now()}`;
        addTab({
          id,
          connectionId: activeSidebarConnectionId || 'none',
          type: 'query',
          title: 'New Query',
          query: '-- New Query Tab\n',
        });
      } else if (isMod && e.key === 'l') {
        e.preventDefault();
        setShowLogDrawer((prev) => !prev);
      } else if (isMod && e.key === ',') {
        e.preventDefault();
        setShowSettingsModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, activeSidebarConnectionId, setShowConnectionDialog, closeTab, addTab, setShowLogDrawer, setShowSettingsModal]);

  useEffect(() => {
    if (showLogDrawer) {
      setHasLoadedLogDrawer(true);
    }
  }, [showLogDrawer]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const renderContent = () => {
    if (!isConnected) {
      if (!startupRestoreChecked || connectionProgress) {
        return (
          <ConnectionRestoreLoading
            startupCheckPending={!startupRestoreChecked}
            progress={connectionProgress}
          />
        );
      }
      return <WelcomeScreen />;
    }
    if (!activeTab) {
      return <EmptyTabScreen />;
    }

    switch (activeTab.type) {
      case 'data':
        return activeTab.tableName ? (
          <Suspense fallback={<ContentLoading />}>
            <TableView key={activeTab.id} tableName={activeTab.tableName} tabId={activeTab.id} />
          </Suspense>
        ) : null;
      case 'structure':
        return activeTab.tableName ? (
          <Suspense fallback={<ContentLoading />}>
            <TableStructure key={activeTab.id} tableName={activeTab.tableName} tabId={activeTab.id} />
          </Suspense>
        ) : null;
      case 'query':
        return (
          <Suspense fallback={<ContentLoading />}>
            <QueryEditor key={activeTab.id} tabId={activeTab.id} />
          </Suspense>
        );
      case 'create-table':
        return (
          <Suspense fallback={<ContentLoading />}>
            <CreateTable key={activeTab.id} tabId={activeTab.id} />
          </Suspense>
        );
      case 'create-view':
        return (
          <Suspense fallback={<ContentLoading />}>
            <CreateView key={activeTab.id} tabId={activeTab.id} />
          </Suspense>
        );
      case 'edit-table':
        return activeTab.tableName ? (
          <Suspense fallback={<ContentLoading />}>
            <EditTable key={activeTab.id} tableName={activeTab.tableName} tabId={activeTab.id} />
          </Suspense>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <TopBar />
      <div className="app-main flex-1 flex overflow-hidden">
        <DatabaseBar />
        <Sidebar />
        <div className="content-area flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
          <TabBar />
          <div className="flex-1 min-h-0 overflow-hidden">
            {renderContent()}
          </div>
        </div>
        <Suspense fallback={null}>
          <AiPanel />
        </Suspense>
      </div>
      <StatusBar />
      {showConnectionDialog && (
        <Suspense fallback={null}>
          <ConnectionDialog />
        </Suspense>
      )}
      {showSettingsModal && (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <AlertModal />
      </Suspense>
      <Suspense fallback={null}>
        <ToastViewport />
      </Suspense>
      {hasLoadedLogDrawer && (
        <Suspense fallback={null}>
          <LogDrawer />
        </Suspense>
      )}
    </div>
  );
}
