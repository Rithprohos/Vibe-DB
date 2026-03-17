import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  Database,
  Wrench,
  Zap,
  FileText,
  Plus,
  X,
  Table as TableIcon,
  Eye,
  Orbit,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

type TabMeta = {
  icon: LucideIcon;
  label: string;
};

function getTabMeta(type: string): TabMeta {
  switch (type) {
    case 'data':
      return {
        icon: Database,
        label: 'DATA',
      };
    case 'structure':
      return {
        icon: Wrench,
        label: 'DDL',
      };
    case 'query':
      return {
        icon: Zap,
        label: 'SQL',
      };
    case 'visualize':
      return {
        icon: Orbit,
        label: 'MAP',
      };
    case 'create-table':
      return {
        icon: TableIcon,
        label: 'NEW',
      };
    case 'edit-table':
      return {
        icon: Wrench,
        label: 'EDIT',
      };
    case 'create-view':
      return {
        icon: Eye,
        label: 'VIEW',
      };
    default:
      return {
        icon: FileText,
        label: 'TAB',
      };
  }
}

export default function TabBar() {
  const tabs = useAppStore(s => s.tabs);
  const activeTabId = useAppStore(s => s.activeTabId);
  const activeSidebarConnectionId = useAppStore(s => s.activeSidebarConnectionId);
  const setActiveTab = useAppStore(s => s.setActiveTab);
  const closeTab = useAppStore(s => s.closeTab);
  const closeAllTabs = useAppStore(s => s.closeAllTabs);
  const closeOtherTabs = useAppStore(s => s.closeOtherTabs);
  const addTab = useAppStore(s => s.addTab);

  const handleNewQuery = useCallback(() => {
    if (!activeSidebarConnectionId) return;
    const id = `query-${Date.now()}`;
    addTab({
      id,
      connectionId: activeSidebarConnectionId,
      type: 'query',
      title: 'New Query',
      query: '',
    });
  }, [activeSidebarConnectionId, addTab]);

  if (tabs.length === 0) return null;

  return (
    <div className="sticky top-0 z-10 flex h-[var(--tabbar-height)] items-end gap-1 overflow-x-auto overflow-y-hidden border-b border-border/30 bg-background/92 px-2 pb-0 select-none custom-scrollbar-hide">
      {tabs.map((tab) => {
        const isActive = activeTabId === tab.id;
        const meta = getTabMeta(tab.type);
        const Icon = meta.icon;

        return (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger asChild>
              <div
                className={cn(
                  'group relative flex h-[34px] min-w-[156px] max-w-[236px] cursor-pointer items-center gap-2 overflow-hidden rounded-t-md border border-b-0 px-3 transition-all duration-200',
                  isActive
                    ? 'border-border/35 bg-background text-foreground shadow-[0_-1px_0_rgba(255,255,255,0.02)]'
                    : 'border-transparent bg-background/35 text-muted-foreground hover:border-border/18 hover:bg-background/58 hover:text-foreground',
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                <div
                  className={cn(
                    'absolute inset-0 opacity-0 transition-opacity duration-200',
                    isActive
                      ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_55%)] opacity-100'
                      : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_55%)] group-hover:opacity-100',
                  )}
                />
                {isActive && (
                  <>
                    <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
                  </>
                )}

                <span
                  className={cn(
                    'relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-sm border transition-all duration-200',
                    isActive
                      ? 'border-border/28 bg-background/90 text-foreground'
                      : 'border-border/18 bg-background/82 text-muted-foreground group-hover:border-border/28 group-hover:text-foreground',
                  )}
                >
                  <Icon
                    size={13}
                    className={cn(
                      'transition-transform duration-200',
                      isActive ? 'scale-100' : 'group-hover:scale-105',
                    )}
                  />
                </span>

                <span className="relative min-w-0 flex-1 truncate text-[12px] font-medium leading-none">
                  {tab.title}
                </span>

                <span
                  className={cn(
                    'relative hidden rounded-sm border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] md:inline-flex',
                    isActive
                      ? 'border-border/25 bg-background/78 text-muted-foreground/80'
                      : 'border-transparent bg-transparent text-muted-foreground/50 group-hover:text-muted-foreground/70',
                  )}
                >
                  {meta.label}
                </span>

                <div
                className={cn(
                  'relative flex h-5 w-5 items-center justify-center rounded-sm border border-transparent transition-all duration-200',
                  isActive
                    ? 'opacity-100 text-muted-foreground hover:bg-background/80 hover:text-foreground'
                    : 'opacity-0 text-muted-foreground group-hover:opacity-100 hover:bg-background/80 hover:text-foreground',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                  }}
                >
                  <X size={12} />
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
              <ContextMenuItem onClick={() => closeTab(tab.id)}>
                Close
              </ContextMenuItem>
              <ContextMenuItem onClick={() => closeOtherTabs(tab.id)}>
                Close Others
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => closeAllTabs()}>
                Close All
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
      <div
        className={cn(
          'group relative mb-0 flex h-[34px] w-12 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-t-md border border-b-0 transition-all duration-200',
          activeSidebarConnectionId
            ? 'border-border/18 bg-background/42 text-muted-foreground hover:border-border/28 hover:bg-background/62 hover:text-foreground'
            : 'border-transparent bg-background/35 text-muted-foreground/55',
        )}
        onClick={handleNewQuery} 
        title="New Query"
      >
        <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_55%)]" />
        <Plus size={14} className="relative transition-transform duration-200 group-hover:scale-105" />
      </div>
    </div>
  );
}
