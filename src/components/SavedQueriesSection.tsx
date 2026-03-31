import { memo, useCallback, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, Trash2 } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { getSavedQueriesForConnection, getSavedQuerySortValue } from "@/lib/savedQueries";
import { cn } from "@/lib/utils";
import { useAppStore, type SavedQuery } from "@/store/useAppStore";
import SavedQueryDialog from "./SavedQueryDialog";
import { Button } from "./ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface RenameState {
  id: string;
  initialName: string;
}

function SavedQueriesSectionComponent() {
  const savedQueries = useAppStore((state) => state.savedQueries);
  const activeSidebarConnectionId = useAppStore((state) => state.activeSidebarConnectionId);
  const activeConnection = useAppStore(
    (state) =>
      state.activeSidebarConnectionId
        ? state.connections.find((connection) => connection.id === state.activeSidebarConnectionId) ?? null
        : null,
  );
  const activeConnectionId = activeConnection?.id ?? "";
  const addTab = useAppStore((state) => state.addTab);
  const renameSavedQuery = useAppStore((state) => state.renameSavedQuery);
  const deleteSavedQuery = useAppStore((state) => state.deleteSavedQuery);
  const showToast = useAppStore((state) => state.showToast);

  const [open, setOpen] = useState(false);
  const [renameState, setRenameState] = useState<RenameState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedQuery | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scopedSavedQueries = useMemo(
    () => getSavedQueriesForConnection(savedQueries, activeSidebarConnectionId),
    [activeSidebarConnectionId, savedQueries],
  );

  const sortedSavedQueries = useMemo(
    () =>
      [...scopedSavedQueries]
        .sort((left, right) => getSavedQuerySortValue(right) - getSavedQuerySortValue(left)),
    [scopedSavedQueries],
  );

  const virtualizer = useVirtualizer({
    count: open ? sortedSavedQueries.length : 0,
    getScrollElement: () => listRef.current,
    estimateSize: () => 42,
    overscan: 10,
  });

  const handleOpenSavedQuery = useCallback(
    (savedQuery: SavedQuery) => {
      addTab({
        id: `query-saved-${crypto.randomUUID()}`,
        connectionId: activeConnectionId,
        type: "query",
        title: savedQuery.name,
        query: savedQuery.sql,
        savedQueryId: savedQuery.id,
        savedQueryName: savedQuery.name,
      });
    },
    [activeConnectionId, addTab],
  );

  const handleRenameSubmit = useCallback(
    async ({ name }: { name: string }) => {
      if (!renameState) {
        throw new Error("Saved query no longer exists");
      }

      renameSavedQuery(renameState.id, name);
      setRenameState(null);
      showToast({ type: "success", message: "Saved query renamed" });
    },
    [renameSavedQuery, renameState, showToast],
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;

    deleteSavedQuery(deleteTarget.id);
    setDeleteTarget(null);
    showToast({ type: "info", message: "Saved query deleted" });
  }, [deleteSavedQuery, deleteTarget, showToast]);

  if (!activeSidebarConnectionId || !activeConnection) {
    return null;
  }

  return (
    <>
      <div className="flex min-h-0 max-h-[260px] flex-col space-y-1">
        <div
          className="group flex items-center gap-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="text-[10px] text-muted-foreground group-hover:text-primary">
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
          <span className="flex-1">Saved Queries</span>
          <div className="grid grid-cols-[auto_17px] items-center gap-2">
            <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">
              {scopedSavedQueries.length}
            </span>
            <span aria-hidden="true" className="h-[17px] w-[17px]" />
          </div>
        </div>

        <div
          className={cn(
            "grid min-h-0 transition-[grid-template-rows,opacity] duration-200 ease-out",
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col gap-3 pt-2">
              {scopedSavedQueries.length === 0 ? (
                <div className="rounded-sm border border-dashed border-border/70 bg-background/30 px-4 py-6 text-center">
                  <FileCode2 size={18} className="mx-auto mb-2 text-muted-foreground/50" />
                  <div className="text-sm font-medium text-foreground">No saved queries</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Save SQL from a query tab to keep reusable snippets here.
                  </div>
                </div>
              ) : (
                <div ref={listRef} className="min-h-0 flex-1 overflow-auto pr-1">
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      position: "relative",
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                      const savedQuery = sortedSavedQueries[virtualItem.index];
                      return (
                        <div
                          key={savedQuery.id}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualItem.start}px)`,
                            paddingBottom: "4px",
                          }}
                        >
                          <ContextMenu modal={false}>
                            <ContextMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-sm border border-transparent bg-background/40 px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-border/60 hover:bg-accent hover:text-foreground"
                                onClick={() => handleOpenSavedQuery(savedQuery)}
                              >
                                <FileCode2 size={14} className="shrink-0 text-primary/80" />
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {savedQuery.name}
                                </span>
                              </button>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-44">
                              <ContextMenuItem onClick={() => handleOpenSavedQuery(savedQuery)}>
                                Open in New Tab
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() =>
                                  setRenameState({
                                    id: savedQuery.id,
                                    initialName: savedQuery.name,
                                  })
                                }
                              >
                                Rename
                              </ContextMenuItem>
                              <ContextMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(savedQuery)}
                              >
                                Delete
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <SavedQueryDialog
        open={renameState !== null}
        mode="rename"
        initialName={renameState?.initialName ?? ""}
        connection={activeConnection}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setRenameState(null);
          }
        }}
        onSubmit={handleRenameSubmit}
      />

      <Dialog open={deleteTarget !== null} onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px] bg-card border-border shadow-2xl shadow-black/20">
          <DialogHeader>
            <DialogTitle>Delete Saved Query</DialogTitle>
            <DialogDescription>
              Open tabs will remain in place as unlinked drafts. Their SQL will not be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-sm border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground">
            {deleteTarget?.name}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete}>
              <Trash2 size={14} />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const SavedQueriesSection = memo(SavedQueriesSectionComponent);

export default SavedQueriesSection;
