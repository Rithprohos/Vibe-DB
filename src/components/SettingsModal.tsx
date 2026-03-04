import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  Settings, 
  Palette, 
  Keyboard, 
  Info,
  Database,
  Sliders
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SettingsTab = 'general' | 'appearance' | 'keybindings' | 'about';

interface SettingsNavItem {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
}

const navItems: SettingsNavItem[] = [
  { id: 'general', label: 'General', icon: <Sliders size={16} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'keybindings', label: 'Keybindings', icon: <Keyboard size={16} /> },
  { id: 'about', label: 'About', icon: <Info size={16} /> },
];

function GeneralSettings() {
  const connections = useAppStore(s => s.connections);
  const activeCount = connections.filter(c => c.connId).length;
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Connection Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
            <div>
              <div className="text-sm font-medium">Max Active Connections</div>
              <div className="text-xs text-muted-foreground mt-0.5">Limit concurrent database connections</div>
            </div>
            <div className="text-sm font-mono text-primary">5</div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
            <div>
              <div className="text-sm font-medium">Saved Connections</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total connections in history</div>
            </div>
            <div className="text-sm font-mono text-primary">{connections.length}</div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
            <div>
              <div className="text-sm font-medium">Currently Active</div>
              <div className="text-xs text-muted-foreground mt-0.5">Active connections now</div>
            </div>
            <div className="text-sm font-mono text-primary">{activeCount}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Query Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
            <div>
              <div className="text-sm font-medium">Max Result Rows</div>
              <div className="text-xs text-muted-foreground mt-0.5">Rows returned per query (auto-truncate)</div>
            </div>
            <div className="text-sm font-mono text-primary">1000</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Theme</h3>
        <div className="p-4 rounded-lg bg-secondary/30 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0a0a0f] border border-border flex items-center justify-center">
              <Database size={18} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium">VibeDB Dark</div>
              <div className="text-xs text-muted-foreground">Default dark theme optimized for database work</div>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground p-2 bg-primary/5 rounded border border-primary/10">
            Light theme coming soon
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Accent Color</h3>
        <div className="flex gap-2">
          <button className="w-8 h-8 rounded-full bg-[#00e599] ring-2 ring-offset-2 ring-offset-background ring-primary" />
          <button className="w-8 h-8 rounded-full bg-[#7c3aed] opacity-50 cursor-not-allowed" title="Coming soon" />
          <button className="w-8 h-8 rounded-full bg-[#3b82f6] opacity-50 cursor-not-allowed" title="Coming soon" />
        </div>
      </div>
    </div>
  );
}

function KeybindingsSettings() {
  const shortcuts = [
    { keys: ['Cmd', 'N'], action: 'New Connection' },
    { keys: ['Cmd', 'W'], action: 'Close Tab' },
    { keys: ['Cmd', 'T'], action: 'New Query Tab' },
    { keys: ['Cmd', 'L'], action: 'Toggle Logs' },
    { keys: ['Cmd', ','], action: 'Open Settings' },
    { keys: ['Cmd', 'Enter'], action: 'Execute Query' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Keyboard Shortcuts</h3>
        <div className="space-y-2">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-sm text-muted-foreground">{s.action}</span>
              <div className="flex gap-1">
                {s.keys.map((key, j) => (
                  <kbd key={j} className="px-2 py-0.5 text-[10px] font-mono bg-background rounded border border-border text-foreground">
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AboutSettings() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-6">
        <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Database size={32} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">VibeDB</h2>
        <p className="text-sm text-muted-foreground mt-1">Cross-platform SQLite Manager</p>
        <div className="text-xs font-mono text-muted-foreground/60 mt-2">Version 0.1.0</div>
      </div>

      <div className="p-4 rounded-lg bg-secondary/30 border border-border">
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          A modern, fast, and intuitive database management tool built with Tauri, React, and TypeScript.
        </p>
      </div>

      <div className="text-center">
        <a 
          href="https://github.com/vibedb/vibedb" 
          className="text-xs text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Repository
        </a>
      </div>
    </div>
  );
}

export default function SettingsModal() {
  const showSettingsModal = useAppStore(s => s.showSettingsModal);
  const setShowSettingsModal = useAppStore(s => s.setShowSettingsModal);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const renderContent = () => {
    switch (activeTab) {
      case 'general': return <GeneralSettings />;
      case 'appearance': return <AppearanceSettings />;
      case 'keybindings': return <KeybindingsSettings />;
      case 'about': return <AboutSettings />;
    }
  };

  return (
    <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
      <DialogContent className="sm:max-w-[680px] h-[480px] bg-card border-border shadow-2xl p-0 overflow-hidden flex">
        <div className="w-[180px] bg-secondary/30 border-r border-border flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-primary" />
              <span className="text-sm font-semibold">Settings</span>
            </div>
          </div>
          <nav className="flex-1 p-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
                  activeTab === item.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border shrink-0">
            <h2 className="text-base font-semibold text-foreground">
              {navItems.find(i => i.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}