import {
  validateSavedQueryInput,
  type SavedQueryInput,
} from "@/lib/savedQueries";
import type { AppState, SavedQuery, Tab } from "../types";
import type { AppGet, AppSet } from "./shared";

type SavedQueriesSlice = Pick<
  AppState,
  | "savedQueries"
  | "saveQuery"
  | "renameSavedQuery"
  | "deleteSavedQuery"
  | "unlinkTabsForSavedQuery"
>;

function mapTabsForSavedQueryUnlink(tabs: Tab[], savedQueryId: string): Tab[] {
  return tabs.map((tab) =>
    tab.savedQueryId === savedQueryId
      ? {
          ...tab,
          savedQueryId: null,
          savedQueryName: null,
        }
      : tab,
  );
}

function mapTabsForSavedQueryRename(
  tabs: Tab[],
  savedQueryId: string,
  savedQueryName: string,
): Tab[] {
  return tabs.map((tab) =>
    tab.savedQueryId === savedQueryId
      ? {
          ...tab,
          title: savedQueryName,
          savedQueryName,
        }
      : tab,
  );
}

export function createSavedQueriesSlice(set: AppSet, get: AppGet): SavedQueriesSlice {
  return {
    savedQueries: [],

    saveQuery: (input: SavedQueryInput): SavedQuery => {
      const state = get();
      const existing = input.id
        ? state.savedQueries.find((savedQuery) => savedQuery.id === input.id)
        : undefined;
      if (input.id && !existing) {
        throw new Error("Saved query no longer exists");
      }

      const validated = validateSavedQueryInput(state.savedQueries, input);
      const timestamp = Date.now();

      const savedQuery: SavedQuery = existing
        ? {
            ...existing,
            ...validated,
            updatedAt: timestamp,
          }
        : {
            id: crypto.randomUUID(),
            ...validated,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

      set((currentState) => ({
        savedQueries: existing
          ? currentState.savedQueries.map((entry) =>
              entry.id === savedQuery.id ? savedQuery : entry,
            )
          : [...currentState.savedQueries, savedQuery],
        tabs:
          existing && existing.name !== savedQuery.name
            ? mapTabsForSavedQueryRename(
                currentState.tabs,
                savedQuery.id,
                savedQuery.name,
              )
            : currentState.tabs,
      }));

      return savedQuery;
    },

    renameSavedQuery: (id, name) => {
      const state = get();
      const existing = state.savedQueries.find((savedQuery) => savedQuery.id === id);
      if (!existing) {
        throw new Error("Saved query no longer exists");
      }

      const validated = validateSavedQueryInput(state.savedQueries, {
        id,
        name,
        sql: existing.sql,
        connectionId: existing.connectionId,
      });

      set((currentState) => ({
        savedQueries: currentState.savedQueries.map((savedQuery) =>
          savedQuery.id === id
            ? {
                ...savedQuery,
                name: validated.name,
                updatedAt: Date.now(),
              }
            : savedQuery,
        ),
        tabs: mapTabsForSavedQueryRename(currentState.tabs, id, validated.name),
      }));
    },

    deleteSavedQuery: (id) =>
      set((state) => ({
        savedQueries: state.savedQueries.filter((savedQuery) => savedQuery.id !== id),
        tabs: mapTabsForSavedQueryUnlink(state.tabs, id),
      })),

    unlinkTabsForSavedQuery: (savedQueryId) =>
      set((state) => ({
        tabs: mapTabsForSavedQueryUnlink(state.tabs, savedQueryId),
      })),
  };
}
