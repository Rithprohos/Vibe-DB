import { useRef, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Plus, type LucideIcon } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { cn } from '@/lib/utils';
import { getQualifiedTableName, getSchemaName } from '@/lib/databaseObjects';
import type { TableInfo } from '@/store/useAppStore';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface SidebarObjectSectionProps {
  title: string;
  items: TableInfo[];
  open: boolean;
  onToggle: () => void;
  onCreate?: () => void;
  createTitle?: string;
  createButtonClassName?: string;
  itemIcon: LucideIcon;
  selectedItem: string | null;
  showSchemaBadge: boolean;
  listClassName: string;
  containerClassName?: string;
  onOpenData: (qualifiedName: string) => void;
  onOpenStructure: (qualifiedName: string) => void;
  renderMenuItems?: (qualifiedName: string) => ReactNode;
}

export default function SidebarObjectSection({
  title,
  items,
  open,
  onToggle,
  onCreate,
  createTitle,
  createButtonClassName,
  itemIcon: ItemIcon,
  selectedItem,
  showSchemaBadge,
  listClassName,
  containerClassName,
  onOpenData,
  onOpenStructure,
  renderMenuItems,
}: SidebarObjectSectionProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: open ? items.length : 0,
    getScrollElement: () => listRef.current,
    estimateSize: () => 34,
    overscan: 12,
  });

  return (
    <>
      <div className={cn('space-y-1', containerClassName)}>
        <div
          className="group flex cursor-pointer items-center space-x-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
          onClick={onToggle}
        >
          <span className="text-[10px] text-muted-foreground transition-transform group-hover:text-primary">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className="flex-1">{title}</span>
          <div className="grid grid-cols-[auto_17px] items-center gap-2">
            <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">
              {items.length}
            </span>
            {onCreate ? (
              <button
                className={cn(
                  'h-[17px] w-[17px] rounded p-0.5 opacity-0 transition-all group-hover:opacity-100',
                  createButtonClassName,
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onCreate();
                }}
                title={createTitle}
              >
                <Plus size={12} />
              </button>
            ) : (
              <span aria-hidden="true" className="h-[17px] w-[17px]" />
            )}
          </div>
        </div>

        <div
          className={cn(
            'grid min-h-0 flex-1 transition-[grid-template-rows,opacity] duration-200 ease-out',
            open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div
              ref={listRef}
              className={cn(listClassName, !open && 'pointer-events-none')}
            >
              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const item = items[virtualItem.index];
                  const qualifiedName = getQualifiedTableName(item);
                  const schemaName = getSchemaName(item);
                  const isSelected = selectedItem === qualifiedName;

                  return (
                    <div
                      key={qualifiedName}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                        paddingBottom: '2px',
                      }}
                    >
                      <ContextMenu modal={false}>
                        <ContextMenuTrigger asChild>
                          <div
                            className={cn(
                              'flex cursor-pointer items-center space-x-2 rounded-md px-2 py-1.5 text-sm transition-all',
                              isSelected
                                ? 'border border-primary/20 bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                            onClick={() => onOpenData(qualifiedName)}
                            onDoubleClick={() => onOpenStructure(qualifiedName)}
                          >
                            <ItemIcon
                              size={14}
                              className={isSelected ? 'text-primary' : 'text-muted-foreground'}
                            />
                            <span className="truncate">{item.name}</span>
                            {showSchemaBadge && schemaName && (
                              <span className="ml-auto rounded-sm border border-border/60 bg-background/70 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground/70">
                                {schemaName}
                              </span>
                            )}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem onClick={() => onOpenData(qualifiedName)}>
                            Open Data
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => onOpenStructure(qualifiedName)}>
                            Open Structure
                          </ContextMenuItem>
                          {renderMenuItems?.(qualifiedName)}
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
