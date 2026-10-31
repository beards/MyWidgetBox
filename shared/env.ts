/**
 * Everything a Widget controller needs from the outside world.
 * Controllers receive an Env at creation and never touch browser globals
 * directly, so tests can inject a deterministic one (see test-env.ts).
 */
export interface Env {
  /** Returns a uniformly distributed unsigned 32-bit integer. */
  randomUint32: () => number;
  /** Current time in milliseconds since the Unix epoch. */
  now: () => number;
  storage: KeyValueStorage;
  /**
   * Calls listener when another tab (same origin) changed `storage`, with the changed key
   * (null when it was cleared). Returns an unsubscribe function.
   */
  onStorageChange(listener: (key: string | null) => void): () => void;
  url: URL;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Cryptographically secure uint32 source (crypto.getRandomValues). */
export function createBrowserRandom(): () => number {
  const buffer = new Uint32Array(1);
  return () => crypto.getRandomValues(buffer)[0]!;
}

/** The production Env, backed by real browser APIs. */
export function createBrowserEnv(): Env {
  return {
    randomUint32: createBrowserRandom(),
    now: () => Date.now(),
    storage: localStorage,
    onStorageChange(listener) {
      const handle = (event: StorageEvent) => {
        if (event.storageArea === localStorage) listener(event.key);
      };
      window.addEventListener('storage', handle);
      return () => window.removeEventListener('storage', handle);
    },
    url: new URL(location.href),
  };
}
