import { lazy, Suspense, useEffect, useState } from 'react';
import DatabaseBar from './components/DatabaseBar';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import StatusBar from './components/StatusBar';
import TopBar from './components/TopBar';
import ActiveTabContent from './components/app/ActiveTabContent';
import {
  useConnectEventListener,
  useLogDrawerPreload,
  useProductionContextMenuGuard,
  useSqlLogListener,
  useThemeSync,
} from './hooks/useAppShellEffects';
import { useAppConnectionManager } from './hooks/useAppConnectionManager';
import { useDatabaseVersionSync } from './hooks/useDatabaseVersionSync';
import { useGlobalKeybindings } from './hooks/useGlobalKeybindings';
import { useDevRenderCounter } from './lib/dev-performance';
import { useAppStore, type AppState } from './store/useAppStore';
import './index.css';

const ConnectionDialog = lazy(() => import('./components/ConnectionDialog'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const LogDrawer = lazy(() => import('./components/LogDrawer'));
const AiPanel = lazy(() => import('./components/AiPanel'));
const AlertModal = lazy(() => import('./components/AlertModal'));
const ToastViewport = lazy(() => import('./components/ToastViewport'));
const QuickSearch = lazy(() => import('./components/QuickSearch'));

const selectShowConnectionDialog = (state: AppState) => state.showConnectionDialog;
const selectShowSettingsModal = (state: AppState) => state.showSettingsModal;
const selectTheme = (state: AppState) => state.theme;
const selectIsAiPanelOpen = (state: AppState) => state.isAiPanelOpen;
const selectIsQuickSearchOpen = (state: AppState) => state.isQuickSearchOpen;

export default function App() {
  useDevRenderCounter('App');

  const showConnectionDialog = useAppStore(selectShowConnectionDialog);
  const showSettingsModal = useAppStore(selectShowSettingsModal);
  const isAiPanelOpen = useAppStore(selectIsAiPanelOpen);
  const isQuickSearchOpen = useAppStore(selectIsQuickSearchOpen);
  const theme = useAppStore(selectTheme);
  const [hasLoadedQuickSearch, setHasLoadedQuickSearch] = useState(false);
  const { connectionProgress, handleConnect, startupRestoreChecked } = useAppConnectionManager();
  const hasLoadedLogDrawer = useLogDrawerPreload();

  useEffect(() => {
    if (isQuickSearchOpen) {
      setHasLoadedQuickSearch(true);
    }
  }, [isQuickSearchOpen]);

  useThemeSync(theme);
  useProductionContextMenuGuard();
  useDatabaseVersionSync();
  useConnectEventListener(handleConnect);
  useSqlLogListener();
  useGlobalKeybindings();

  return (
    <div className="app-container">
      <TopBar />
      <div className="app-main flex-1 flex overflow-hidden">
        <DatabaseBar />
        <Sidebar />
        <div className="content-area flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
          <TabBar />
          <div className="flex-1 min-h-0 overflow-hidden">
            <ActiveTabContent
              connectionProgress={connectionProgress}
              startupRestoreChecked={startupRestoreChecked}
            />
          </div>
        </div>
        {isAiPanelOpen && (
          <Suspense fallback={null}>
            <AiPanel />
          </Suspense>
        )}
      </div>
      <StatusBar />
      {hasLoadedQuickSearch && (
        <Suspense fallback={null}>
          <QuickSearch />
        </Suspense>
      )}
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
