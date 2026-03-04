import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Settings, Sparkles } from 'lucide-react';

export default function TopBar() {
  const connections = useAppStore(s => s.connections);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const databaseVersion = useAppStore(s => s.databaseVersion);
  const isAiPanelOpen = useAppStore(s => s.isAiPanelOpen);
  const setIsAiPanelOpen = useAppStore(s => s.setIsAiPanelOpen);
  const setShowSettingsModal = useAppStore(s => s.setShowSettingsModal);
  const tabs = useAppStore(s => s.tabs);
  const activeTabId = useAppStore(s => s.activeTabId);

  const activeConnection = useMemo(
    () => connections.find(c => c.id === activeSidebarConnectionId),
    [connections, activeSidebarConnectionId]
  );
  const isDataTabActive = useMemo(
    () => tabs.find(t => t.id === activeTabId)?.type === 'data',
    [tabs, activeTabId]
  );
  const toggleAiPanel = useCallback(
    () => setIsAiPanelOpen(!isAiPanelOpen),
    [setIsAiPanelOpen, isAiPanelOpen]
  );
  const openSettings = useCallback(
    () => setShowSettingsModal(true),
    [setShowSettingsModal]
  );

  return (
    <div
      className="flex items-center justify-between px-3 h-[44px] bg-background shrink-0 select-none pl-[80px]"
      data-tauri-drag-region
    >
      {/* Left side: Empty placeholder for drag region */}
      <div className="flex items-center gap-4 text-muted-foreground w-[60px]" data-tauri-drag-region>
      </div>

      {/* Center: Title */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center text-[12px] font-medium text-muted-foreground/80 gap-1.5" 
        data-tauri-drag-region
      >
        <span>vibe-db {activeConnection ? `— ${activeConnection.name}` : ''}</span>
        {databaseVersion && (
          <span className="text-[10px] text-muted-foreground/40 font-mono tracking-widest bg-secondary/50 px-1.5 py-0.5 rounded ml-1">
            v{databaseVersion}
          </span>
        )}
      </div>

      {/* Right side: AI & Settings */}
      <div className="flex items-center gap-2 text-muted-foreground pr-2">
        {isDataTabActive && (
          <button
            onClick={toggleAiPanel}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-[11px] font-medium mr-2 ${
              isAiPanelOpen
                ? 'bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/30'
                : 'hover:bg-secondary text-muted-foreground border border-transparent'
            }`}
          >
            <Sparkles size={13} className={isAiPanelOpen ? 'text-accent-secondary' : 'text-muted-foreground'} />
            AI Chat
          </button>
        )}
        <button 
          onClick={openSettings}
          className="p-1.5 rounded hover:bg-secondary transition-colors"
        >
          <Settings size={15} />
        </button>
      </div>
    </div>
  );
}
