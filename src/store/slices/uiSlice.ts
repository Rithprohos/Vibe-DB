import type { AppState } from "../types";
import type { AppSet } from "./shared";

type UiSlice = Pick<
  AppState,
  | "logs"
  | "showLogDrawer"
  | "toasts"
  | "showSettingsModal"
  | "alertOptions"
  | "theme"
  | "developerToolsEnabled"
  | "databaseVersion"
  | "setTheme"
  | "setDeveloperToolsEnabled"
  | "setDatabaseVersion"
  | "addLog"
  | "clearLogs"
  | "setShowLogDrawer"
  | "setShowSettingsModal"
  | "showToast"
  | "dismissToast"
  | "showAlert"
  | "hideAlert"
>;

export function createUiSlice(set: AppSet): UiSlice {
  return {
    logs: [],
    showLogDrawer: false,
    toasts: [],
    showSettingsModal: false,
    alertOptions: null,
    theme: "dark",
    developerToolsEnabled: false,
    databaseVersion: null,

    setTheme: (theme) => set({ theme }),
    setDeveloperToolsEnabled: (enabled) => set({ developerToolsEnabled: enabled }),
    setDatabaseVersion: (version) => set({ databaseVersion: version }),

    addLog: (log) =>
      set((state) => ({
        logs: [
          {
            ...log,
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now(),
          },
          ...state.logs,
        ].slice(0, 100),
      })),

    clearLogs: () => set({ logs: [] }),
    setShowLogDrawer: (val) =>
      set((state) => ({
        showLogDrawer: typeof val === "function" ? val(state.showLogDrawer) : val,
      })),
    setShowSettingsModal: (val) => set({ showSettingsModal: val }),
    showToast: (toast) =>
      set((state) => ({
        toasts: [
          ...state.toasts,
          {
            ...toast,
            id: Math.random().toString(36).slice(2),
          },
        ].slice(-4),
      })),
    dismissToast: (id) =>
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      })),

    showAlert: (options) => set({ alertOptions: options }),
    hideAlert: () => set({ alertOptions: null }),
  };
}
