import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

function isEditableTarget(target: HTMLElement | null): boolean {
  return Boolean(
    target &&
      (['INPUT', 'TEXTAREA'].includes(target.tagName) ||
        target.isContentEditable ||
        target.closest('.cm-editor')),
  );
}

export function useGlobalKeybindings(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const state = useAppStore.getState();
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
        state.setIsQuickSearchOpen(true);
        return;
      }

      if (isMod && key === 'n') {
        event.preventDefault();
        state.setShowConnectionDialog(true);
        return;
      }

      if (isMod && key === 'w') {
        if (state.activeTabId) {
          event.preventDefault();
          state.closeTab(state.activeTabId);
        }
        return;
      }

      if (isMod && key === 't') {
        event.preventDefault();
        state.addTab({
          id: `query-${Date.now()}`,
          connectionId: state.activeSidebarConnectionId || 'none',
          type: 'query',
          title: 'New Query',
          query: '-- New Query Tab\n',
        });
        return;
      }

      if (isMod && key === 'l') {
        event.preventDefault();
        state.setShowLogDrawer((prev) => !prev);
        return;
      }

      if (isMod && key === ',') {
        event.preventDefault();
        state.setShowSettingsModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
