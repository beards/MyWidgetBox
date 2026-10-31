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
    url: new URL(location.href),
  };
}
