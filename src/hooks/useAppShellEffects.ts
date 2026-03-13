import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAppStore, type AppState, type Connection, type Theme } from '../store/useAppStore';
import type { ConnectSource } from './useAppConnectionManager';

const IS_PROD = import.meta.env.PROD;

interface SqlLogEvent {
  sql: string;
  status: 'success' | 'error';
  duration: number;
  message: string;
}

const selectAddLog = (state: AppState) => state.addLog;
const selectShowLogDrawer = (state: AppState) => state.showLogDrawer;

export function useThemeSync(theme: Theme): void {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
}

function shouldAllowNativeContextMenu(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('input, textarea, [contenteditable="true"], [role="textbox"], .cm-editor, .cm-content') !== null
  );
}

export function useProductionContextMenuGuard(): void {
  useEffect(() => {
    if (!IS_PROD) {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      if (shouldAllowNativeContextMenu(event.target)) {
        return;
      }

      event.preventDefault();
    };

    window.addEventListener('contextmenu', handleContextMenu, true);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, []);
}

export function useConnectEventListener(
  onConnect: (connection: Connection, source?: ConnectSource) => Promise<void>,
): void {
  useEffect(() => {
    const handler = (event: Event) => {
      const connection = (event as CustomEvent<Connection>).detail;
      void onConnect(connection, 'manual');
    };

    window.addEventListener('vibedb:connect', handler);
    return () => window.removeEventListener('vibedb:connect', handler);
  }, [onConnect]);
}

export function useSqlLogListener(): void {
  const addLog = useAppStore(selectAddLog);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    listen<SqlLogEvent>('vibedb:sql-log', (event) => {
      const payload = event.payload;
      addLog({
        sql: payload.sql,
        status: payload.status,
        duration: payload.duration,
        message: payload.message,
      });
    }).then((cleanup) => {
      if (mounted) {
        unsubscribe = cleanup;
      } else {
        cleanup();
      }
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [addLog]);
}

export function useLogDrawerPreload(): boolean {
  const showLogDrawer = useAppStore(selectShowLogDrawer);
  const [hasLoadedLogDrawer, setHasLoadedLogDrawer] = useState(
    () => useAppStore.getState().showLogDrawer,
  );

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const preloadLogDrawer = () => {
      if (!cancelled) {
        void import('../components/LogDrawer');
      }
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(preloadLogDrawer, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(preloadLogDrawer, 600);
    }

    return () => {
      cancelled = true;

      if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (showLogDrawer) {
      setHasLoadedLogDrawer(true);
    }
  }, [showLogDrawer]);

  return hasLoadedLogDrawer;
}
