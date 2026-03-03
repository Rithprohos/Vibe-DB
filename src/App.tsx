import { useEffect, useCallback } from 'react';
import { useAppStore, type Connection } from './store/useAppStore';
import { listTables, connectDatabase, getDatabaseVersion } from './lib/db';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
import WelcomeScreen from './components/WelcomeScreen';
import ConnectionDialog from './components/ConnectionDialog';
import LogDrawer from './components/LogDrawer';
import TableView from './components/TableView';
import TableStructure from './components/TableStructure';
import QueryEditor from './components/QueryEditor';
import TopBar from './components/TopBar';
import AiPanel from './components/AiPanel';
import './index.css';

export default function App() {
  const {
    activeConnection,
    isConnected,
    showConnectionDialog,
    tabs,
    activeTabId,
    setTables,
    setIsConnected,
    addConnection,
    setActiveConnection,
    addTab,
    setDatabaseVersion,
  } = useAppStore();

  const handleConnect = useCallback(
    async (conn: Connection) => {
      try {
        // Always create a fresh connection - connId is session-only
        const connId = await connectDatabase(conn.path, conn.name);

        const tables = await listTables(connId);
        const version = await getDatabaseVersion(connId);
        
        // Update connection with new session connId (not persisted)
        const updatedConn = { ...conn, connId, lastUsed: Date.now() };
        
        // Set active connection first (this clears tables), then set tables
        setActiveConnection(updatedConn);
        setTables(tables);
        setDatabaseVersion(version);
        setIsConnected(true);
        addConnection(updatedConn);

        const queryTabId = `query-welcome-${Date.now()}`;
        addTab({
          id: queryTabId,
          type: 'query',
          title: 'Query 1',
          query: tables.length === 0
            ? '-- Welcome to VibeDB! 🚀\n-- This is a fresh database. Create your first table:\n\nCREATE TABLE users (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  name TEXT NOT NULL,\n  email TEXT UNIQUE,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n'
            : '-- Connected to ' + conn.name + '\n\nSELECT * FROM sqlite_master;\n',
        });
      } catch (e: any) {
        console.error('Failed to connect:', e);
        setIsConnected(false);
        alert(`Failed to connect: ${e}`);
      }
    },
    [setTables, setIsConnected, addConnection, addTab, setActiveConnection]
  );

  // Listen for connect events
  useEffect(() => {
    const handler = (e: Event) => {
      const conn = (e as CustomEvent).detail as Connection;
      handleConnect(conn);
    };
    window.addEventListener('vibedb:connect', handler);
    return () => window.removeEventListener('vibedb:connect', handler);
  }, [handleConnect]);

  // Auto-reconnect on mount
  useEffect(() => {
    if (activeConnection && !isConnected) {
      handleConnect(activeConnection);
    }
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const renderContent = () => {
    if (!isConnected || !activeTab) {
      return <WelcomeScreen />;
    }

    switch (activeTab.type) {
      case 'data':
        return activeTab.tableName ? (
          <TableView tableName={activeTab.tableName} />
        ) : null;
      case 'structure':
        return activeTab.tableName ? (
          <TableStructure tableName={activeTab.tableName} />
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
        <Sidebar />
        <div className="content-area flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
          <TabBar />
          {renderContent()}
        </div>
        <AiPanel />
      </div>
      <StatusBar />
      {showConnectionDialog && <ConnectionDialog />}
      <LogDrawer /> {/* Rendered LogDrawer */}
    </div>
  );
}
