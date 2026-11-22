import { describe, expect, it } from 'vitest';
import { readScopedState, stateScope, withoutPreset, writeScopedState } from './scoped-state';
import { createTestEnv } from './test-env';

const KEY = 'mywidgetbox:sample:state';
const asNumber = (value: unknown) => (typeof value === 'number' ? value : null);

describe('scoped State', () => {
  it('names a scope per Preset, and one for Settings opened from a Share link', () => {
    expect(stateScope('3')).toBe('preset:3');
    expect(stateScope(null)).toBe('shared');
  });

  it('reads back what was written, dropping scopes that do not parse', () => {
    const env = createTestEnv();
    writeScopedState(env, KEY, { 'preset:1': 5, 'preset:2': 'bad', shared: 7 });
    expect(readScopedState(env, KEY, asNumber)).toEqual({ 'preset:1': 5, shared: 7 });
  });

  it('reads nothing from missing, unreadable or other-version storage', () => {
    for (const raw of [null, 'not json', JSON.stringify({ version: 2, scopes: { shared: 1 } })]) {
      const env = createTestEnv();
      if (raw !== null) env.storage.setItem(KEY, raw);
      expect(readScopedState(env, KEY, asNumber)).toEqual({});
    }
  });

  it("drops a deleted Preset's scope only", () => {
    expect(withoutPreset({ 'preset:1': 1, 'preset:2': 2, shared: 3 }, '2')).toEqual({ 'preset:1': 1, shared: 3 });
  });
});
