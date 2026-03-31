import { useEffect } from 'react';
import { useAppStore, type AppState } from '../store/useAppStore';

const selectActiveSidebarConnectionId = (state: AppState) => state.activeSidebarConnectionId;
const selectActiveTabId = (state: AppState) => state.activeTabId;
const selectAddTab = (state: AppState) => state.addTab;
const selectCloseTab = (state: AppState) => state.closeTab;
const selectSetIsQuickSearchOpen = (state: AppState) => state.setIsQuickSearchOpen;
const selectSetShowConnectionDialog = (state: AppState) => state.setShowConnectionDialog;
const selectSetShowLogDrawer = (state: AppState) => state.setShowLogDrawer;
const selectSetShowSettingsModal = (state: AppState) => state.setShowSettingsModal;

function isEditableTarget(target: HTMLElement | null): boolean {
  return Boolean(
    target &&
      (['INPUT', 'TEXTAREA'].includes(target.tagName) ||
        target.isContentEditable ||
        target.closest('.cm-editor')),
  );
}

export function useGlobalKeybindings(): void {
  const activeSidebarConnectionId = useAppStore(selectActiveSidebarConnectionId);
  const activeTabId = useAppStore(selectActiveTabId);
  const addTab = useAppStore(selectAddTab);
  const closeTab = useAppStore(selectCloseTab);
  const setIsQuickSearchOpen = useAppStore(selectSetIsQuickSearchOpen);
  const setShowConnectionDialog = useAppStore(selectSetShowConnectionDialog);
  const setShowLogDrawer = useAppStore(selectSetShowLogDrawer);
  const setShowSettingsModal = useAppStore(selectSetShowSettingsModal);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isMod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (
        isEditableTarget(target) &&
        !(isMod && (key === 'k' || key === 'l' || key === ','))
      ) {
        return;
      }

      if (isMod && key === 'k') {
        event.preventDefault();
        setIsQuickSearchOpen(true);
        return;
      }

      if (isMod && key === 'n') {
        event.preventDefault();
        setShowConnectionDialog(true);
        return;
      }

      if (isMod && key === 'w') {
        if (activeTabId) {
          event.preventDefault();
          closeTab(activeTabId);
        }
        return;
      }

      if (isMod && key === 't') {
        event.preventDefault();
        addTab({
          id: `query-${Date.now()}`,
          connectionId: activeSidebarConnectionId || 'none',
          type: 'query',
          title: 'New Query',
          query: '-- New Query Tab\n',
        });
        return;
      }

      if (isMod && key === 'l') {
        event.preventDefault();
        setShowLogDrawer((prev) => !prev);
        return;
      }

      if (isMod && key === ',') {
        event.preventDefault();
        setShowSettingsModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeSidebarConnectionId,
    activeTabId,
    addTab,
    closeTab,
    setIsQuickSearchOpen,
    setShowConnectionDialog,
    setShowLogDrawer,
    setShowSettingsModal,
  ]);
}
