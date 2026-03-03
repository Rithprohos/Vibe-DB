import { useAppStore } from '../store/useAppStore';
import { Database, Wrench, Zap, FileText, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, closeAllTabs, closeOtherTabs, addTab } = useAppStore();

  const handleNewQuery = () => {
    const id = `query-${Date.now()}`;
    addTab({
      id,
      type: 'query',
      title: 'New Query',
      query: '',
    });
  };

  const tabIcon = (type: string) => {
    switch (type) {
      case 'data':
        return <Database size={14} className="text-primary" />;
      case 'structure':
        return <Wrench size={14} className="text-muted-foreground" />;
      case 'query':
        return <Zap size={14} className="text-accent-secondary" />;
      default:
        return <FileText size={14} className="text-muted-foreground" />;
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="flex bg-background border-b border-border h-[var(--tabbar-height)] overflow-x-auto overflow-y-hidden select-none sticky top-0 z-10 custom-scrollbar-hide">
      {tabs.map((tab) => (
        <ContextMenu key={tab.id}>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                "group flex items-center space-x-2 px-4 h-full cursor-pointer border-r border-border min-w-[140px] max-w-[220px] transition-colors relative",
                activeTabId === tab.id 
                  ? "bg-secondary text-foreground" 
                  : "bg-background text-muted-foreground hover:bg-secondary/50"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {activeTabId === tab.id && (
                <div className="absolute top-0 left-0 w-full h-[2px] bg-primary shadow-glow transition-all" />
              )}
              
              <span className="flex-shrink-0">{tabIcon(tab.type)}</span>
              <span className="flex-1 truncate text-[13px] font-medium">{tab.title}</span>
              
              <div
                className={cn(
                  "flex items-center justify-center w-5 h-5 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100",
                  activeTabId === tab.id && "opacity-100"
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
      ))}
      <div 
        className="flex items-center justify-center w-12 h-full border-r border-border hover:bg-secondary/50 cursor-pointer transition-colors text-muted-foreground hover:text-foreground"
        onClick={handleNewQuery} 
        title="New Query"
      >
        <Plus size={16} />
      </div>
    </div>
  );
}
