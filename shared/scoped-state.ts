import type { Env } from './env';
import { isPlainObject } from './settings';

/**
 * Shared (opt-in) storage for State a Widget keeps per Preset (the wheel's drawn entries, the
 * timer's runs). One storage key holds `{ version: 1, scopes: { [scope]: value } }`, where the
 * scope is `preset:<id>` for a stored Preset and `shared` for Settings opened from a Share link,
 * so ids reused in another Preset never pick up someone else's State.
 */
const VERSION = 1;

export function stateScope(selectedPresetId: string | null): string {
  return selectedPresetId === null ? 'shared' : `preset:${selectedPresetId}`;
}

/**
 * The stored scopes, each value passed through `parse` (null drops that scope); {} when nothing
 * readable is stored, null when storage cannot be read at all (the caller keeps its in-memory State).
 */
export function readScopedState<T>(env: Env, key: string, parse: (value: unknown) => T | null): Record<string, T> | null {
  let raw: string | null;
  try {
    raw = env.storage.getItem(key);
  } catch {
    return null;
  }
  try {
    const data: unknown = JSON.parse(raw ?? 'null');
    if (!isPlainObject(data) || data.version !== VERSION || !isPlainObject(data.scopes)) return {};
    return Object.fromEntries(
      Object.entries(data.scopes).flatMap(([scope, value]) => {
        const parsed = parse(value);
        return parsed === null ? [] : [[scope, parsed]];
      }),
    );
  } catch {
    return {};
  }
}

export function writeScopedState<T>(env: Env, key: string, scopes: Record<string, T>): void {
  try {
    env.storage.setItem(key, JSON.stringify({ version: VERSION, scopes }));
  } catch {
    // Storage full or unavailable: the caller keeps working from memory.
  }
}

/** The scopes without the one of a deleted Preset. */
export function withoutPreset<T>(scopes: Record<string, T>, presetId: string): Record<string, T> {
  return Object.fromEntries(Object.entries(scopes).filter(([scope]) => scope !== stateScope(presetId)));
}
