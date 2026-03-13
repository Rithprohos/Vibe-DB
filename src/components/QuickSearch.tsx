import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { Database, Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  buildQuickSearchTableItems,
  getQuickSearchRecentTableItems,
  normalizeQuickSearchQuery,
  searchQuickSearchTableItems,
} from '@/lib/quickSearch';
import { cn } from '@/lib/utils';
import { useAppStore, type AppState, type TableInfo } from '@/store/useAppStore';

const EMPTY_TABLES: TableInfo[] = [];
const RESULT_LIMIT = 200;
const LISTBOX_ID = 'global-quick-search-results';

const selectors = {
  isQuickSearchOpen: (state: AppState) => state.isQuickSearchOpen,
  setIsQuickSearchOpen: (state: AppState) => state.setIsQuickSearchOpen,
  activeSidebarConnectionId: (state: AppState) => state.activeSidebarConnectionId,
  quickSearchRecentItems: (state: AppState) => state.quickSearchRecentItems,
  openTableTab: (state: AppState) => state.openTableTab,
};

interface QuickSearchSection {
  id: string;
  label: string | null;
  items: ReturnType<typeof buildQuickSearchTableItems>;
}

export default function QuickSearch() {
  const isQuickSearchOpen = useAppStore(selectors.isQuickSearchOpen);
  const setIsQuickSearchOpen = useAppStore(selectors.setIsQuickSearchOpen);
  const activeSidebarConnectionId = useAppStore(selectors.activeSidebarConnectionId);
  const quickSearchRecentItems = useAppStore(selectors.quickSearchRecentItems);
  const openTableTab = useAppStore(selectors.openTableTab);
  const activeConnection = useAppStore(
    useCallback(
      (state: AppState) =>
        activeSidebarConnectionId
          ? state.connections.find(
              (connection) => connection.id === activeSidebarConnectionId,
            ) ?? null
          : null,
      [activeSidebarConnectionId],
    ),
  );
  const tables = useAppStore(
    useCallback(
      (state: AppState) =>
        activeSidebarConnectionId
          ? state.tablesByConnection[activeSidebarConnectionId] ?? EMPTY_TABLES
          : EMPTY_TABLES,
      [activeSidebarConnectionId],
    ),
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const shortcutLabel = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return 'CTRL+K';
    }

    return navigator.platform.toLowerCase().includes('mac') ? 'CMD+K' : 'CTRL+K';
  }, []);
  const normalizedQuery = useMemo(
    () => normalizeQuickSearchQuery(deferredQuery),
    [deferredQuery],
  );
  const isSearchPending = normalizeQuickSearchQuery(query) !== normalizedQuery;

  const searchableTables = useMemo(() => {
    return buildQuickSearchTableItems(tables);
  }, [tables]);

  const results = useMemo(() => {
    return searchQuickSearchTableItems(
      searchableTables,
      normalizedQuery,
      RESULT_LIMIT,
    );
  }, [normalizedQuery, searchableTables]);
  const recentResults = useMemo(() => {
    return getQuickSearchRecentTableItems(
      searchableTables,
      quickSearchRecentItems,
      activeSidebarConnectionId,
      RESULT_LIMIT,
    );
  }, [
    activeSidebarConnectionId,
    quickSearchRecentItems,
    searchableTables,
  ]);
  const sections = useMemo<QuickSearchSection[]>(() => {
    if (normalizedQuery) {
      return [{ id: 'results', label: null, items: results }];
    }

    if (recentResults.length === 0) {
      return [{ id: 'tables', label: null, items: results }];
    }

    const recentQualifiedNames = new Set(
      recentResults.map((item) => item.qualifiedName),
    );
    const remainingResults = searchableTables
      .filter((item) => !recentQualifiedNames.has(item.qualifiedName))
      .slice(0, Math.max(0, RESULT_LIMIT - recentResults.length));

    return [
      {
        id: 'recent',
        label: 'Recent tables',
        items: recentResults,
      },
      {
        id: 'tables',
        label: remainingResults.length > 0 ? 'All tables' : null,
        items: remainingResults,
      },
    ].filter((section) => section.items.length > 0);
  }, [normalizedQuery, recentResults, results, searchableTables]);
  const visibleResults = useMemo(
    () => sections.flatMap((section) => section.items),
    [sections],
  );
  const visibleResultIndexByQualifiedName = useMemo(
    () =>
      new Map(
        visibleResults.map((item, index) => [item.qualifiedName, index] as const),
      ),
    [visibleResults],
  );

  useEffect(() => {
    if (!isQuickSearchOpen) {
      setQuery('');
      setHighlightedIndex(0);
      resultRefs.current = [];
    }
  }, [isQuickSearchOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [normalizedQuery]);

  useEffect(() => {
    if (visibleResults.length === 0) {
      setHighlightedIndex(0);
      return;
    }

    setHighlightedIndex((currentIndex) =>
      Math.min(currentIndex, visibleResults.length - 1),
    );
  }, [visibleResults.length]);

  useEffect(() => {
    if (!isQuickSearchOpen || visibleResults.length === 0) {
      return;
    }

    resultRefs.current[highlightedIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [highlightedIndex, isQuickSearchOpen, visibleResults.length]);

  const closeQuickSearch = useCallback(() => {
    setIsQuickSearchOpen(false);
  }, [setIsQuickSearchOpen]);

  const openHighlightedTable = useCallback(
    (index: number) => {
      if (!activeSidebarConnectionId) {
        return;
      }

      const selected = visibleResults[index];
      if (!selected) {
        return;
      }

      openTableTab(activeSidebarConnectionId, selected.qualifiedName, 'data');
      setIsQuickSearchOpen(false);
    },
    [activeSidebarConnectionId, openTableTab, setIsQuickSearchOpen, visibleResults],
  );

  const handleInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeQuickSearch();
        return;
      }

      if (visibleResults.length === 0) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((currentIndex) =>
          Math.min(currentIndex + 1, visibleResults.length - 1),
        );
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((currentIndex) => Math.max(currentIndex - 1, 0));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        openHighlightedTable(highlightedIndex);
      }
    },
    [closeQuickSearch, highlightedIndex, openHighlightedTable, visibleResults.length],
  );

  const renderEmptyState = () => {
    if (!activeSidebarConnectionId || !activeConnection) {
      return (
        <div className="px-3 py-6 text-center">
          <div className="text-[12px] font-medium text-foreground">
            No active connection
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Select a connection in the sidebar, then search its tables.
          </div>
        </div>
      );
    }

    if (searchableTables.length === 0) {
      return (
        <div className="px-3 py-6 text-center">
          <div className="text-[12px] font-medium text-foreground">
            No tables available
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            This connection has no loaded tables to search yet.
          </div>
        </div>
      );
    }

    return (
      <div className="px-3 py-6 text-center">
        <div className="text-[12px] font-medium text-foreground">
          No matching tables
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          Try a different table name or schema prefix.
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isQuickSearchOpen} onOpenChange={setIsQuickSearchOpen}>
      <DialogContent
        hideCloseButton
        className="max-w-2xl gap-0 overflow-hidden border-border/80 bg-background p-0 shadow-2xl sm:rounded-sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Global quick search</DialogTitle>
        <DialogDescription className="sr-only">
          Search tables in the active connection and open the selected result.
        </DialogDescription>

        <div className="border-b border-border/80 px-3 py-2">
          <div className="flex items-center gap-2 border border-input bg-secondary/10 px-3 py-2">
            <Search size={14} className="shrink-0 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search tables..."
              className="h-auto border-0 bg-transparent px-0 py-0 font-mono text-[13px] shadow-none focus-visible:ring-0"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={visibleResults.length > 0}
              aria-controls={LISTBOX_ID}
              aria-activedescendant={
                visibleResults[highlightedIndex]
                  ? `quick-search-option-${highlightedIndex}`
                  : undefined
              }
            />
            <div className="flex shrink-0 items-center gap-1">
              <div className="border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {shortcutLabel}
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center border border-border/70 bg-background text-muted-foreground transition-colors hover:border-border hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  aria-label="Close quick search"
                >
                  <X size={12} />
                </button>
              </DialogClose>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>
              {activeConnection
                ? `Connection: ${activeConnection.name}`
                : 'Connection: none'}
            </span>
            <span>
              {isSearchPending
                ? 'Searching...'
                : visibleResults.length > 0
                  ? `${visibleResults.length} result${visibleResults.length === 1 ? '' : 's'}`
                  : 'No results'}
            </span>
          </div>
        </div>

        <div className="max-h-[420px] min-h-[120px]">
          {visibleResults.length === 0 ? (
            renderEmptyState()
          ) : (
            <div
              id={LISTBOX_ID}
              role="listbox"
              aria-busy={isSearchPending}
              className="h-[420px] overflow-y-auto px-1.5 py-1"
            >
              {sections.map((section) => (
                <div key={section.id}>
                  {section.label ? (
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {section.label}
                    </div>
                  ) : null}
                  {section.items.map((item) => {
                    const index =
                      visibleResultIndexByQualifiedName.get(item.qualifiedName) ?? 0;
                    const isHighlighted = index === highlightedIndex;

                    return (
                      <div
                        key={`${section.id}:${item.qualifiedName}`}
                        id={`quick-search-option-${index}`}
                        ref={(element) => {
                          resultRefs.current[index] = element;
                        }}
                        role="option"
                        tabIndex={-1}
                        aria-selected={isHighlighted}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-3 border border-transparent px-2 py-2 text-left transition-colors',
                          isHighlighted
                            ? 'border-primary/30 bg-primary/10 text-foreground'
                            : 'text-muted-foreground hover:border-border/70 hover:bg-secondary/40 hover:text-foreground',
                        )}
                        onMouseDown={(event) => {
                          event.preventDefault();
                        }}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onClick={() => openHighlightedTable(index)}
                      >
                        <Database
                          size={14}
                          className={cn(
                            'shrink-0',
                            isHighlighted ? 'text-primary' : 'text-muted-foreground',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-[12px] text-foreground">
                            {item.qualifiedName}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            {item.schema ? `Schema ${item.schema}` : 'Table'}
                          </div>
                        </div>
                        <div className="shrink-0 border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          Enter
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
