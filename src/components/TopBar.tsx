import { useAppStore } from '../store/useAppStore';
import { Sparkles, Zap } from 'lucide-react';

export default function TopBar() {
  const { isAiPanelOpen, setIsAiPanelOpen, activeConnection, tabs, activeTabId } = useAppStore();

  const activeTab = tabs.find(t => t.id === activeTabId);
  const isDataTabActive = activeTab?.type === 'data';

  return (
    <div
      className="flex items-center justify-between px-4 h-[38px] bg-secondary border-b border-border shrink-0 select-none"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-2.5" data-tauri-drag-region>
        <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center border border-primary/20">
          <Zap size={13} className="text-primary" />
        </div>
        <span className="text-[15px] font-bold tracking-tight bg-gradient-to-r from-primary to-accent-secondary bg-clip-text text-transparent">
          VibeDB
        </span>
        {activeConnection && (
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(0,229,153,0.4)]" />
            <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[200px]">
              {activeConnection.name}
            </span>
          </div>
        )}
      </div>
      <div className="flex gap-3 items-center">
        {isDataTabActive && (
          <button
            onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors text-[11px] font-medium tracking-wide ${
              isAiPanelOpen
                ? 'bg-accent-secondary/10 border-accent-secondary/30 text-accent-secondary border'
                : 'hover:bg-accent border border-border text-muted-foreground'
            }`}
          >
            <Sparkles size={12} className={isAiPanelOpen ? 'text-accent-secondary' : 'text-muted-foreground'} />
            AI
          </button>
        )}
      </div>
    </div>
  );
}
