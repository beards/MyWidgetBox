import type { Env, KeyValueStorage } from './env';

export interface TestEnvOptions {
  /** Fixed sequence of uint32 values returned by randomUint32; throws when exhausted. */
  random?: number[];
  /** Initial clock value in ms. */
  now?: number;
  url?: string;
}

/** A deterministic Env for controller tests: fixed random sequence, manual clock, in-memory storage. */
export function createTestEnv(options: TestEnvOptions = {}): Env & { advance(ms: number): void } {
  const random = [...(options.random ?? [])];
  let now = options.now ?? 0;
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
    storage: createMemoryStorage(),
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
