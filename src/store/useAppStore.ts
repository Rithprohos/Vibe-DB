import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createAiSlice } from "./slices/aiSlice";
import { createConnectionSlice } from "./slices/connectionSlice";
import { createSavedQueriesSlice } from "./slices/savedQueriesSlice";
import { createTabsSlice } from "./slices/tabsSlice";
import { createUiSlice } from "./slices/uiSlice";
import { storage } from "./storage";
import type { AppState } from "./types";

export * from "./constants";
export type {
  AiCustomProfile,
  AiCustomProviderKind,
  AiProviderMode,
  AlertOptions,
  AlertType,
  AppState,
  ColumnInfo,
  Connection,
  CreateViewDraft,
  ForeignKeyInfo,
  IndexInfo,
  QueryResult,
  QueryResultLight,
  QuickSearchRecentItem,
  SavedQuery,
  SqlLog,
  Tab,
  TabType,
  TableFilterCondition,
  TableInfo,
  TableStructureData,
  TableViewState,
  Theme,
  ToastItem,
  VisualizationPoint,
  VisualizationState,
} from "./types";

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...createUiSlice(set),
      ...createAiSlice(set),
      ...createConnectionSlice(set),
      ...createSavedQueriesSlice(set, get),
      ...createTabsSlice(set, get),
    }),
    {
      name: "vibedb-storage",
      partialize: (state) => ({
        connections: state.connections.map((c) => ({
          id: c.id,
          name: c.name,
          path: c.path,
          type: c.type,
          lastUsed: c.lastUsed,
          tag: c.tag,
          host: c.host,
          port: c.port,
          username: c.username,
          database: c.database,
          sslMode: c.sslMode,
          hasPassword: c.hasPassword,
          hasAuthToken: c.hasAuthToken,
        })),
        activeSidebarConnectionId: state.activeSidebarConnectionId,
        pinnedTablesByConnection: state.pinnedTablesByConnection,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        savedQueries: state.savedQueries,
        quickSearchRecentItems: state.quickSearchRecentItems,
        theme: state.theme,
        developerToolsEnabled: state.developerToolsEnabled,
        aiProviderMode: state.aiProviderMode,
        aiCustomProfiles: state.aiCustomProfiles,
        aiActiveCustomProfileId: state.aiActiveCustomProfileId,
        aiCustomProviderKind: state.aiCustomProviderKind,
        aiCustomName: state.aiCustomName,
        aiCustomBaseUrl: state.aiCustomBaseUrl,
        aiCustomModel: state.aiCustomModel,
      }),
      storage: createJSONStorage(() => storage),
    },
  ),
);

export function useActiveTab() {
  return useAppStore((state) => {
    if (!state.activeTabId) return null;
    return state.tabs.find((tab) => tab.id === state.activeTabId) || null;
  });
}
