import { settingsIcon, navItems } from './constants';
import { type SettingsTab } from './types';
import { cn } from '@/lib/utils';

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <div className="flex w-[180px] shrink-0 flex-col border-r border-border bg-secondary/30">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          {settingsIcon}
          <span className="text-sm font-semibold">Settings</span>
        </div>
      </div>
      <nav className="flex-1 p-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
              activeTab === item.id
                ? 'border border-primary/20 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
