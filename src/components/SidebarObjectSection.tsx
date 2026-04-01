import { useRef, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Pin, Plus, type LucideIcon } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { cn } from '@/lib/utils';
import { getQualifiedTableName, getSchemaName } from '@/lib/databaseObjects';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface SidebarObjectInfo {
  name: string;
  schema?: string | null;
}

interface SidebarObjectSectionProps {
  title: string;
  items: SidebarObjectInfo[];
  open: boolean;
  onToggle: () => void;
  onCreate?: () => void;
  createTitle?: string;
  createButtonClassName?: string;
  itemIcon: LucideIcon;
  selectedItem: string | null;
  isItemPinned?: (qualifiedName: string) => boolean;
  showSchemaBadge: boolean;
  listClassName: string;
  containerClassName?: string;
  onOpenData: (qualifiedName: string) => void;
  onOpenStructure?: (qualifiedName: string) => void;
  openDataLabel?: string;
  openStructureLabel?: string;
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
  isItemPinned,
  showSchemaBadge,
  listClassName,
  containerClassName,
  onOpenData,
  onOpenStructure,
  openDataLabel = 'Open Data',
  openStructureLabel = 'Open Structure',
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

        {open ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div ref={listRef} className={cn('min-w-0 flex-1', listClassName)}>
              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const item = items[virtualItem.index];
                  const normalizedItem = {
                    name: item.name,
                    schema: item.schema ?? undefined,
                  };
                  const qualifiedName = getQualifiedTableName(normalizedItem);
                  const schemaName = getSchemaName(normalizedItem);
                  const isSelected = selectedItem === qualifiedName;
                  const pinned = isItemPinned?.(qualifiedName) ?? false;

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
                            onDoubleClick={() =>
                              onOpenStructure
                                ? onOpenStructure(qualifiedName)
                                : onOpenData(qualifiedName)
                            }
                          >
                            <ItemIcon
                              size={14}
                              className={isSelected ? 'text-primary' : 'text-muted-foreground'}
                            />
                            <span className="truncate">{item.name}</span>
                            {(pinned || (showSchemaBadge && schemaName)) && (
                              <span className="ml-auto flex items-center gap-1.5">
                                {pinned && (
                                  <Pin
                                    size={11}
                                    className={isSelected ? 'text-primary/90' : 'text-muted-foreground/70'}
                                    aria-label="Pinned table"
                                  />
                                )}
                                {showSchemaBadge && schemaName && (
                                  <span className="rounded-sm border border-border/60 bg-background/70 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-[0.12em] text-muted-foreground/70">
                                    {schemaName}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem onClick={() => onOpenData(qualifiedName)}>
                            {openDataLabel}
                          </ContextMenuItem>
                          {onOpenStructure && (
                            <ContextMenuItem onClick={() => onOpenStructure(qualifiedName)}>
                              {openStructureLabel}
                            </ContextMenuItem>
                          )}
                          {renderMenuItems?.(qualifiedName)}
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
