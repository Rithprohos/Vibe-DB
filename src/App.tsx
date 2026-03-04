import { useEffect, useCallback, useRef } from 'react';
import { useAppStore, type Connection } from './store/useAppStore';
import { listTables, connectDatabase, getDatabaseVersion } from './lib/db';
import DatabaseBar from './components/DatabaseBar';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
import WelcomeScreen from './components/WelcomeScreen';
import EmptyTabScreen from './components/EmptyTabScreen';
import ConnectionDialog from './components/ConnectionDialog';
import SettingsModal from './components/SettingsModal';
import LogDrawer from './components/LogDrawer';
import TableView from './components/TableView';
import TableStructure from './components/TableStructure';
import QueryEditor from './components/QueryEditor';
import TopBar from './components/TopBar';
import AiPanel from './components/AiPanel';
import './index.css';

export default function App() {
  // Use granular selectors to prevent unnecessary re-renders
  const connections = useAppStore(s => s.connections);
  const isConnected = useAppStore(s => s.isConnected);
  const showConnectionDialog = useAppStore(s => s.showConnectionDialog);
  const tabs = useAppStore(s => s.tabs);
  const activeTabId = useAppStore(s => s.activeTabId);
  const setTables = useAppStore(s => s.setTables);
  const setIsConnected = useAppStore(s => s.setIsConnected);
  const addConnection = useAppStore(s => s.addConnection);
  const updateConnection = useAppStore(s => s.updateConnection);
  const setActiveSidebarConnection = useAppStore(s => s.setActiveSidebarConnection);
  const addTab = useAppStore(s => s.addTab);
  const setDatabaseVersion = useAppStore(s => s.setDatabaseVersion);
  const autoConnectAttempted = useRef(false);

  const handleConnect = useCallback(
    async (conn: Connection) => {
      try {
        let connId = conn.connId;
        
        // If not connected, connect to the tauri backend
        if (!connId) {
          connId = await connectDatabase(conn.path, conn.name);
          const version = await getDatabaseVersion(connId);
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
    [setTables, setIsConnected, updateConnection, addTab, setActiveSidebarConnection, setDatabaseVersion, connections]
  );

  // Listen for connect events (from ConnectionDialog or DatabaseBar)
  useEffect(() => {
    const handler = (e: Event) => {
      const conn = (e as CustomEvent).detail as Connection;
      // If it's a new connection (not in store yet), add it
      if (!connections.find(c => c.id === conn.id)) {
        addConnection(conn);
      }
      handleConnect(conn);
    };
    window.addEventListener('vibedb:connect', handler);
    return () => window.removeEventListener('vibedb:connect', handler);
  }, [handleConnect, connections, addConnection]);

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
  const setShowSettingsModal = useAppStore(s => s.setShowSettingsModal);
  const setShowConnectionDialog = useAppStore(s => s.setShowConnectionDialog);
  const closeTab = useAppStore(s => s.closeTab);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);

  // Keep a ref for showLogDrawer so the effect doesn't re-register on every toggle
  const showLogDrawerRef = useRef(showLogDrawer);
  showLogDrawerRef.current = showLogDrawer;

  // Global Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is in an input/textarea to avoid triggering shortcuts unexpectedly
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        if (e.key !== ',' && e.key !== 'l' && e.key !== 'Enter') return;
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
          <TableView tableName={activeTab.tableName} tabId={activeTab.id} />
        ) : null;
      case 'structure':
        return activeTab.tableName ? (
          <TableStructure tableName={activeTab.tableName} tabId={activeTab.id} />
        ) : null;
      case 'query':
        return <QueryEditor tabId={activeTab.id} />;
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
          {renderContent()}
        </div>
        <AiPanel />
      </div>
      <StatusBar />
      {showConnectionDialog && <ConnectionDialog />}
      <SettingsModal />
      <LogDrawer />
    </div>
  );
}
