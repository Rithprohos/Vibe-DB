import { appDataDir, join } from "@tauri-apps/api/path";
import { Stronghold } from "@tauri-apps/plugin-stronghold";

const AI_STRONGHOLD_CLIENT = "vibedb-ai";
const AI_STRONGHOLD_PASSWORD = "vibedb-ai-stronghold-v1";
const AI_STRONGHOLD_SNAPSHOT = "ai-config.hold";
const AI_KEY_PREFIX = "openai_api_key::";
const AI_KEY_STORE_STEP_TIMEOUT_MS = 15000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

interface AiKeyStoreContext {
  stronghold: Stronghold;
  store: ReturnType<Awaited<ReturnType<Stronghold["loadClient"]>>["getStore"]>;
}

let keyStoreContextPromise: Promise<AiKeyStoreContext> | null = null;
let keyStoreOperationPromise: Promise<void> = Promise.resolve();

async function withAiKeyStoreTimeout<T>(
  label: string,
  task: Promise<T>,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Stronghold ${label} timed out after ${AI_KEY_STORE_STEP_TIMEOUT_MS}ms`));
    }, AI_KEY_STORE_STEP_TIMEOUT_MS);

    void task.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function resolveAiKeyStoreName(profileId?: string): string {
  const raw = profileId?.trim() || "default";
  if (!raw) {
    throw new Error("Profile ID cannot be empty");
  }

  return `${AI_KEY_PREFIX}${raw}`;
}

async function createAiKeyStoreContext(): Promise<AiKeyStoreContext> {
  const snapshotPath = await join(await appDataDir(), AI_STRONGHOLD_SNAPSHOT);
  const stronghold = await withAiKeyStoreTimeout(
    "load",
    Stronghold.load(snapshotPath, AI_STRONGHOLD_PASSWORD),
  );

  try {
    const client = await withAiKeyStoreTimeout(
      "loadClient",
      stronghold.loadClient(AI_STRONGHOLD_CLIENT),
    );
    return { stronghold, store: client.getStore() };
  } catch {
    const client = await withAiKeyStoreTimeout(
      "createClient",
      stronghold.createClient(AI_STRONGHOLD_CLIENT),
    );
    return { stronghold, store: client.getStore() };
  }
}

async function getAiKeyStoreContext(): Promise<AiKeyStoreContext> {
  if (!keyStoreContextPromise) {
    keyStoreContextPromise = createAiKeyStoreContext().catch((error: unknown) => {
      keyStoreContextPromise = null;
      throw error;
    });
  }

  return await keyStoreContextPromise;
}

async function withAiKeyStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = keyStoreOperationPromise.then(operation, operation);
  keyStoreOperationPromise = run.then(
    () => undefined,
    () => undefined,
  );
  return await run;
}

export async function hasStoredAiApiKey(profileId?: string): Promise<boolean> {
  return await withAiKeyStoreLock(async () => {
    const key = resolveAiKeyStoreName(profileId);
    const { store } = await getAiKeyStoreContext();
    const value = await withAiKeyStoreTimeout("get", store.get(key));
    return value !== null && value.length > 0;
  });
}

export async function getStoredAiApiKey(
  profileId?: string,
): Promise<string | null> {
  return await withAiKeyStoreLock(async () => {
    const key = resolveAiKeyStoreName(profileId);
    const { store } = await getAiKeyStoreContext();
    const value = await withAiKeyStoreTimeout("get", store.get(key));
    if (!value) {
      return null;
    }

    const decoded = textDecoder.decode(value).trim();
    return decoded || null;
  });
}

export async function saveStoredAiApiKey(
  apiKey: string,
  profileId?: string,
): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("API key cannot be empty");
  }

  await withAiKeyStoreLock(async () => {
    const key = resolveAiKeyStoreName(profileId);
    const { stronghold, store } = await getAiKeyStoreContext();
    await withAiKeyStoreTimeout(
      "insert",
      store.insert(key, Array.from(textEncoder.encode(trimmed))),
    );
    await withAiKeyStoreTimeout("save", stronghold.save());
  });
}

export async function clearStoredAiApiKey(profileId?: string): Promise<void> {
  await withAiKeyStoreLock(async () => {
    const key = resolveAiKeyStoreName(profileId);
    const { stronghold, store } = await getAiKeyStoreContext();
    await withAiKeyStoreTimeout("remove", store.remove(key));
    await withAiKeyStoreTimeout("save", stronghold.save());
  });
}
