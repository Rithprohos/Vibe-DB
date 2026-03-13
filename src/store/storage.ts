import { LazyStore } from "@tauri-apps/plugin-store";
import type { StateStorage } from "zustand/middleware";

const tauriStore = new LazyStore("app_settings.json");
let pendingWrite: Promise<void> = Promise.resolve();

function queueWrite(operation: () => Promise<void>): Promise<void> {
  const nextWrite = pendingWrite.then(operation, operation);
  pendingWrite = nextWrite.catch(() => undefined);
  return nextWrite;
}

export async function flushStorage(): Promise<void> {
  await pendingWrite;
}

export const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await tauriStore.get<string | null>(name)) ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await queueWrite(async () => {
      await tauriStore.set(name, value);
      await tauriStore.save();
    });
  },
  removeItem: async (name: string): Promise<void> => {
    await queueWrite(async () => {
      await tauriStore.delete(name);
      await tauriStore.save();
    });
  },
};
