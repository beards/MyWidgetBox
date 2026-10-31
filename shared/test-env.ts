import type { Env, KeyValueStorage } from './env';

export interface TestEnvOptions {
  /** Fixed sequence of uint32 values returned by randomUint32; throws when exhausted. */
  random?: number[];
  /** Initial clock value in ms. */
  now?: number;
  url?: string;
  /** Storage to use instead of a fresh in-memory one, e.g. another env's to simulate a second tab. */
  storage?: KeyValueStorage;
}

/** A deterministic Env for controller tests: fixed random sequence, manual clock, in-memory storage. */
export function createTestEnv(
  options: TestEnvOptions = {},
): Env & { advance(ms: number): void; notifyStorageChange(key: string | null): void } {
  const random = [...(options.random ?? [])];
  let now = options.now ?? 0;
  const storageListeners = new Set<(key: string | null) => void>();
  return {
    randomUint32: () => {
      const value = random.shift();
      if (value === undefined) throw new Error('test env: random sequence exhausted');
      return value;
    },
    now: () => now,
    advance: (ms) => {
      now += ms;
    },
    storage: options.storage ?? createMemoryStorage(),
    onStorageChange(listener) {
      storageListeners.add(listener);
      return () => storageListeners.delete(listener);
    },
    /** Simulates the browser telling this tab that another tab changed `key`. */
    notifyStorageChange: (key) => storageListeners.forEach((listener) => listener(key)),
    url: new URL(options.url ?? 'https://example.test/'),
  };
}

function createMemoryStorage(): KeyValueStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}
