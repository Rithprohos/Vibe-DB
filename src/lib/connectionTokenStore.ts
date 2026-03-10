import { appDataDir, join } from "@tauri-apps/api/path";
import { Stronghold } from "@tauri-apps/plugin-stronghold";

const CONNECTION_STRONGHOLD_CLIENT = "vibedb-connections";
const CONNECTION_STRONGHOLD_PASSWORD = "vibedb-credentials-stronghold-v1";
const CONNECTION_STRONGHOLD_SNAPSHOT = "credentials.hold";
const CONNECTION_KEY_PREFIX = "conn_auth_token::";
const CONNECTION_STORE_STEP_TIMEOUT_MS = 15000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

interface ConnectionTokenStoreContext {
  stronghold: Stronghold;
  store: ReturnType<Awaited<ReturnType<Stronghold["loadClient"]>>["getStore"]>;
}

let contextPromise: Promise<ConnectionTokenStoreContext> | null = null;
let operationPromise: Promise<void> = Promise.resolve();

async function withConnectionStoreTimeout<T>(
  label: string,
  task: Promise<T>,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Stronghold ${label} timed out after ${CONNECTION_STORE_STEP_TIMEOUT_MS}ms`));
    }, CONNECTION_STORE_STEP_TIMEOUT_MS);

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

function resolveConnectionTokenStoreName(connectionId: string): string {
  const raw = connectionId.trim();
  if (!raw) {
    throw new Error("Connection ID cannot be empty");
  }
  return `${CONNECTION_KEY_PREFIX}${raw}`;
}

async function createConnectionTokenStoreContext(): Promise<ConnectionTokenStoreContext> {
  const snapshotPath = await join(await appDataDir(), CONNECTION_STRONGHOLD_SNAPSHOT);
  const stronghold = await withConnectionStoreTimeout(
    "load",
    Stronghold.load(snapshotPath, CONNECTION_STRONGHOLD_PASSWORD),
  );

  try {
    const client = await withConnectionStoreTimeout(
      "loadClient",
      stronghold.loadClient(CONNECTION_STRONGHOLD_CLIENT),
    );
    return { stronghold, store: client.getStore() };
  } catch {
    const client = await withConnectionStoreTimeout(
      "createClient",
      stronghold.createClient(CONNECTION_STRONGHOLD_CLIENT),
    );
    return { stronghold, store: client.getStore() };
  }
}

async function getConnectionTokenStoreContext(): Promise<ConnectionTokenStoreContext> {
  if (!contextPromise) {
    contextPromise = createConnectionTokenStoreContext().catch((error: unknown) => {
      contextPromise = null;
      throw error;
    });
  }

  return await contextPromise;
}

async function withConnectionTokenStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = operationPromise.then(operation, operation);
  operationPromise = run.then(
    () => undefined,
    () => undefined,
  );
  return await run;
}

export async function getStoredConnectionAuthToken(
  connectionId: string,
): Promise<string | null> {
  return await withConnectionTokenStoreLock(async () => {
    const key = resolveConnectionTokenStoreName(connectionId);
    const { store } = await getConnectionTokenStoreContext();
    const value = await withConnectionStoreTimeout("get", store.get(key));
    if (!value) {
      return null;
    }

    const decoded = textDecoder.decode(value).trim();
    return decoded || null;
  });
}

export async function saveStoredConnectionAuthToken(
  connectionId: string,
  token: string,
): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Connection token cannot be empty");
  }

  await withConnectionTokenStoreLock(async () => {
    const key = resolveConnectionTokenStoreName(connectionId);
    const { stronghold, store } = await getConnectionTokenStoreContext();
    await withConnectionStoreTimeout(
      "insert",
      store.insert(key, Array.from(textEncoder.encode(trimmed))),
    );
    await withConnectionStoreTimeout("save", stronghold.save());
  });
}

export async function clearStoredConnectionAuthToken(
  connectionId: string,
): Promise<void> {
  await withConnectionTokenStoreLock(async () => {
    const key = resolveConnectionTokenStoreName(connectionId);
    const { stronghold, store } = await getConnectionTokenStoreContext();
    await withConnectionStoreTimeout("remove", store.remove(key));
    await withConnectionStoreTimeout("save", stronghold.save());
  });
}
