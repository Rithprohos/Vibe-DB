import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Search, Settings, Sparkles } from 'lucide-react';

function formatDatabaseVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) {
    return '';
  }

  const pgMatch = trimmed.match(/^PostgreSQL\s+(\d+(?:\.\d+){0,2})/i);
  if (pgMatch) {
    const majorMinor = pgMatch[1];
    if (/neon/i.test(trimmed)) {
      return `PostgreSQL ${majorMinor} (Neon)`;
    }
    return `PostgreSQL ${majorMinor}`;
  }

  if (trimmed.length > 48) {
    return `${trimmed.slice(0, 45)}...`;
  }

  return trimmed;
}

export default function TopBar() {
  const connections = useAppStore(s => s.connections);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const databaseVersion = useAppStore(s => s.databaseVersion);
  const isAiPanelOpen = useAppStore(s => s.isAiPanelOpen);
  const setIsAiPanelOpen = useAppStore(s => s.setIsAiPanelOpen);
  const setShowSettingsModal = useAppStore(s => s.setShowSettingsModal);
  const setIsQuickSearchOpen = useAppStore(s => s.setIsQuickSearchOpen);
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
  const openQuickSearch = useCallback(
    () => setIsQuickSearchOpen(true),
    [setIsQuickSearchOpen]
  );
  const versionBadge = useMemo(
    () => (databaseVersion ? formatDatabaseVersion(databaseVersion) : ''),
    [databaseVersion]
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
        <span>Vibe DB {activeConnection ? `— ${activeConnection.name}` : ''}</span>
        {databaseVersion && (
          <span
            title={databaseVersion}
            className="inline-block max-w-[300px] truncate text-[10px] text-muted-foreground/40 font-mono tracking-wide bg-secondary/50 px-1.5 py-0.5 rounded ml-1"
          >
            {versionBadge}
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
          onClick={openQuickSearch}
          className="p-1.5 rounded hover:bg-secondary transition-colors"
          title="Quick Search"
          aria-label="Open quick search"
        >
          <Search size={15} />
        </button>
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
