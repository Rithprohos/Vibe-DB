import { lazy, Suspense, useEffect, useCallback, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAppStore, type Connection } from './store/useAppStore';
import { listTables, connectDatabase, getDatabaseVersion } from './lib/db';
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

  // Apply theme on mount and changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleConnect = useCallback(
    async (conn: Connection) => {
      try {
        let connId = conn.connId;
        
        // If not connected, connect to the tauri backend
        if (!connId) {
          connId = await connectDatabase(conn.path, conn.name);
          const version = await getDatabaseVersion(connId);
          addConnection(conn);
          updateConnection(conn.id, { connId, lastUsed: Date.now() });
          setDatabaseVersion(version);
        } else {
          updateConnection(conn.id, { lastUsed: Date.now() });
        }

        // Fetch tables for this specific connection
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
      }
    },
    [setTables, setIsConnected, updateConnection, addTab, setActiveSidebarConnection, setDatabaseVersion, addConnection]
  );

  // Listen for connect events (from ConnectionDialog or DatabaseBar)
  useEffect(() => {
    const handler = (e: Event) => {
      const conn = (e as CustomEvent).detail as Connection;
      handleConnect(conn);
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
    if (autoConnectAttempted.current) return;
    
    const doAutoConnect = async () => {
      const state = useAppStore.getState();
      if (state.activeSidebarConnectionId && !state.isConnected) {
        autoConnectAttempted.current = true;
        const connToRestore = state.connections.find(c => c.id === state.activeSidebarConnectionId);
        if (connToRestore) {
          handleConnect(connToRestore);
        }
      }
    };
    
    const unsubscribe = useAppStore.persist.onFinishHydration(() => {
      doAutoConnect();
    });
    
    // Also try immediately in case already hydrated
    if (useAppStore.persist.hasHydrated()) {
      doAutoConnect();
    }
    
    return unsubscribe;
  }, [handleConnect]);

  // Selectors for keybindings
  const showLogDrawer = useAppStore(s => s.showLogDrawer);
  const setShowLogDrawer = useAppStore(s => s.setShowLogDrawer);
  const showSettingsModal = useAppStore(s => s.showSettingsModal);
  const setShowSettingsModal = useAppStore(s => s.setShowSettingsModal);
  const setShowConnectionDialog = useAppStore(s => s.setShowConnectionDialog);
  const closeTab = useAppStore(s => s.closeTab);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const [hasLoadedLogDrawer, setHasLoadedLogDrawer] = useState(() => useAppStore.getState().showLogDrawer);

  // Keep a ref for showLogDrawer so the effect doesn't re-register on every toggle
  const showLogDrawerRef = useRef(showLogDrawer);
  showLogDrawerRef.current = showLogDrawer;

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
        setShowLogDrawer(!showLogDrawerRef.current);
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
