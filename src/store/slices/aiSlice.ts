import type { AppState, AiCustomProfile } from "../types";
import type { AppSet } from "./shared";

type AiSlice = Pick<
  AppState,
  | "isAiPanelOpen"
  | "aiProviderMode"
  | "aiCustomProfiles"
  | "aiActiveCustomProfileId"
  | "aiCustomProviderKind"
  | "aiCustomName"
  | "aiCustomBaseUrl"
  | "aiCustomModel"
  | "setIsAiPanelOpen"
  | "setAiProviderMode"
  | "setAiActiveCustomProfileId"
  | "setAiCustomProviderKind"
  | "setAiCustomName"
  | "setAiCustomBaseUrl"
  | "setAiCustomModel"
  | "upsertAiCustomProfile"
  | "removeAiCustomProfile"
>;

export function createAiSlice(set: AppSet): AiSlice {
  return {
    isAiPanelOpen: false,
    aiProviderMode: "default",
    aiCustomProfiles: [],
    aiActiveCustomProfileId: null,
    aiCustomProviderKind: "openai",
    aiCustomName: "",
    aiCustomBaseUrl: "https://api.openai.com/v1",
    aiCustomModel: "gpt-4o-mini",

    setIsAiPanelOpen: (val) => set({ isAiPanelOpen: val }),
    setAiProviderMode: (mode) => set({ aiProviderMode: mode }),
    setAiActiveCustomProfileId: (id) => set({ aiActiveCustomProfileId: id }),
    setAiCustomProviderKind: (providerKind) =>
      set({ aiCustomProviderKind: providerKind }),
    setAiCustomName: (name) => set({ aiCustomName: name }),
    setAiCustomBaseUrl: (baseUrl) => set({ aiCustomBaseUrl: baseUrl }),
    setAiCustomModel: (model) => set({ aiCustomModel: model }),
    upsertAiCustomProfile: (profile) =>
      set((state) => {
        const updatedProfile: AiCustomProfile = {
          ...profile,
          updatedAt: Date.now(),
        };
        const nextProfiles = state.aiCustomProfiles.some((p) => p.id === profile.id)
          ? state.aiCustomProfiles.map((p) =>
              p.id === profile.id ? updatedProfile : p,
            )
          : [updatedProfile, ...state.aiCustomProfiles];

        return {
          aiCustomProfiles: nextProfiles.sort((a, b) => b.updatedAt - a.updatedAt),
          aiActiveCustomProfileId: profile.id,
        };
      }),
    removeAiCustomProfile: (id) =>
      set((state) => {
        const nextProfiles = state.aiCustomProfiles.filter((p) => p.id !== id);
        const activeId =
          state.aiActiveCustomProfileId === id
            ? (nextProfiles[0]?.id ?? null)
            : state.aiActiveCustomProfileId;

        return {
          aiCustomProfiles: nextProfiles,
          aiActiveCustomProfileId: activeId,
        };
      }),
  };
}
