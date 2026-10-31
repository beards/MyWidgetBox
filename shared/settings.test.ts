import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from './env';
import {
  type SettingsSchema,
  type VersionedSettings,
  createSettingsStore,
  parseSettings,
  serializeSettings,
  settingsStorageKey,
} from './settings';
import { createTestEnv } from './test-env';

// A Widget whose Settings went through two schema changes:
// v1 { size: number }  ->  v2 { width: number }  ->  v3 { width: number, look: { color: string } }
interface TimerLikeSettings {
  width: number;
  look: { color: string };
}

const schema: SettingsSchema<TimerLikeSettings> = {
  namespace: 'sample',
  version: 3,
  defaults: { width: 10, look: { color: 'red' } },
  migrations: {
    1: ({ size }) => ({ width: size }),
    2: (settings) => settings, // v3 only added `look`, which is filled from defaults.
  },
  isValid: (settings): settings is TimerLikeSettings => {
    const { width, look } = settings as TimerLikeSettings;
    return typeof width === 'number' && typeof look.color === 'string';
  },
};

function storeDocument(version: number, settings: unknown) {
  return JSON.stringify({ version, selectedPresetId: '1', presets: [{ id: '1', name: 'Saved', settings }] });
}

describe('Settings store', () => {
  it('opens with defaults when nothing is stored', () => {
    const store = createSettingsStore(createTestEnv(), schema);
    expect(store.getSnapshot()).toMatchObject({ settings: { width: 10, look: { color: 'red' } }, source: 'defaults' });
  });

  it('migrates stored Settings from an old version step by step', () => {
    const env = createTestEnv();
    env.storage.setItem(settingsStorageKey('sample'), storeDocument(1, { size: 42 }));

    const store = createSettingsStore(env, schema);
    expect(store.getSnapshot()).toMatchObject({ settings: { width: 42, look: { color: 'red' } }, source: 'storage' });
  });

  it('fills missing nested fields from defaults and drops unknown ones', () => {
    const env = createTestEnv();
    env.storage.setItem(settingsStorageKey('sample'), storeDocument(3, { width: 5, look: { shadow: true }, extra: 1 }));

    expect(createSettingsStore(env, schema).getSnapshot().settings).toEqual({ width: 5, look: { color: 'red' } });
  });

  it('falls back to defaults when a migration fails or the version is unknown', () => {
    for (const stored of [storeDocument(1, 'not an object'), storeDocument(0, {}), storeDocument(4, {})]) {
      const env = createTestEnv();
      env.storage.setItem(settingsStorageKey('sample'), stored);
      expect(createSettingsStore(env, schema).getSnapshot().source).toBe('defaults');
    }
  });

  it('keeps readable Presets when another stored Preset is invalid', () => {
    const env = createTestEnv();
    env.storage.setItem(
      settingsStorageKey('sample'),
      JSON.stringify({
        version: 3,
        selectedPresetId: 'bad',
        presets: [
          { id: 'bad', name: 'Bad', settings: { width: 'wide' } },
          { id: 'good', name: 'Good', settings: { width: 7 } },
        ],
      }),
    );

    const snapshot = createSettingsStore(env, schema).getSnapshot();
    expect(snapshot.presets).toEqual([{ id: 'good', name: 'Good' }]);
    expect(snapshot.selectedPresetId).toBe('good');
    expect(snapshot.settings.width).toBe(7);
  });

  it('keeps working in memory when storage throws', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    const store = createSettingsStore({ ...createTestEnv(), storage: broken }, schema);

    store.update({ width: 3, look: { color: 'blue' } });
    expect(store.getSnapshot().settings.width).toBe(3);
  });

  it('round-trips serialized Settings through parseSettings', () => {
    const settings = { width: 8, look: { color: 'green' } };
    expect(parseSettings(schema, serializeSettings(schema, settings))).toEqual(settings);
    expect(parseSettings(schema, { version: 1, settings: { size: 2 } })).toEqual({ width: 2, look: { color: 'red' } });
    expect(parseSettings(schema, { version: 3, settings: { width: null } })).toBeNull();
  });
});

describe('Settings store URL layer', () => {
  const urlLayer = (url: URL): VersionedSettings | null => {
    const raw = url.searchParams.get('s');
    return raw === null ? null : (JSON.parse(raw) as VersionedSettings);
  };
  const urlWith = (payload: string) => `https://example.test/?s=${encodeURIComponent(payload)}`;

  function envWithStoredWidth(url: string, width: number) {
    const env = createTestEnv({ url });
    env.storage.setItem(settingsStorageKey('sample'), storeDocument(3, { width }));
    return env;
  }

  it('prefers Settings from the URL over stored Settings', () => {
    const env = envWithStoredWidth(urlWith('{"version":3,"settings":{"width":99}}'), 5);

    const snapshot = createSettingsStore(env, schema, { readUrl: urlLayer }).getSnapshot();
    expect(snapshot).toMatchObject({ settings: { width: 99 }, source: 'url', selectedPresetId: null });
    expect(snapshot.presets).toEqual([{ id: '1', name: 'Saved' }]);
  });

  it('migrates old-version Settings from the URL', () => {
    const env = createTestEnv({ url: urlWith('{"version":1,"settings":{"size":4}}') });
    expect(createSettingsStore(env, schema, { readUrl: urlLayer }).getSnapshot().settings.width).toBe(4);
  });

  it.each(['{"version":3,"settings":{"width":"x"}}', '{broken', '{"version":7,"settings":{}}'])(
    'falls through to storage when the URL Settings cannot be read: %s',
    (payload) => {
      const env = envWithStoredWidth(urlWith(payload), 5);
      expect(createSettingsStore(env, schema, { readUrl: urlLayer }).getSnapshot()).toMatchObject({
        settings: { width: 5 },
        source: 'storage',
      });
    },
  );

  it('keeps edits to URL Settings in memory without overwriting storage', () => {
    const env = envWithStoredWidth(urlWith('{"version":3,"settings":{"width":99}}'), 5);
    const store = createSettingsStore(env, schema, { readUrl: urlLayer });
    store.update({ width: 100, look: { color: 'red' } });
    expect(store.getSnapshot().settings.width).toBe(100);

    const reloaded = createSettingsStore({ ...env, url: new URL('https://example.test/') }, schema);
    expect(reloaded.getSnapshot().settings.width).toBe(5);
  });

  it('saves URL Settings only when the user creates a Preset from them', () => {
    const env = envWithStoredWidth(urlWith('{"version":3,"settings":{"width":99}}'), 5);
    const store = createSettingsStore(env, schema, { readUrl: urlLayer });
    const id = store.createPreset('From link');

    expect(store.getSnapshot()).toMatchObject({ selectedPresetId: id, source: 'storage', settings: { width: 99 } });
    const reloaded = createSettingsStore({ ...env, url: new URL('https://example.test/') }, schema);
    expect(reloaded.getSnapshot().presets.map((preset) => preset.name)).toEqual(['Saved', 'From link']);
    expect(reloaded.getSnapshot().settings.width).toBe(99);
  });

  it('leaves the URL Settings when switching to a stored Preset', () => {
    const env = envWithStoredWidth(urlWith('{"version":3,"settings":{"width":99}}'), 5);
    const store = createSettingsStore(env, schema, { readUrl: urlLayer });
    store.selectPreset('1');
    expect(store.getSnapshot()).toMatchObject({ selectedPresetId: '1', source: 'storage', settings: { width: 5 } });
  });
});

describe('Settings export / import', () => {
  it('round-trips all Presets through an export file', () => {
    const source = createSettingsStore(createTestEnv(), schema);
    source.update({ width: 3, look: { color: 'blue' } });
    source.createPreset('Big');
    source.update({ width: 50, look: { color: 'green' } });
    const file = source.exportFile();

    const target = createSettingsStore(createTestEnv(), schema);
    expect(target.importFile(file)).toBe(true);
    expect(target.getSnapshot()).toEqual(source.getSnapshot());
    expect(JSON.parse(file)).toMatchObject({ namespace: 'sample', version: 3 });
  });

  it('migrates an export file written by an old version', () => {
    const store = createSettingsStore(createTestEnv(), schema);
    const old = JSON.stringify({
      namespace: 'sample',
      version: 1,
      selectedPresetId: '7',
      presets: [{ id: '7', name: 'Old', settings: { size: 8 } }],
    });
    expect(store.importFile(old)).toBe(true);
    expect(store.getSnapshot()).toMatchObject({
      settings: { width: 8, look: { color: 'red' } },
      presets: [{ id: '7', name: 'Old' }],
      source: 'storage',
    });
  });

  it('rejects invalid files and keeps the current Settings', () => {
    const env = createTestEnv();
    const store = createSettingsStore(env, schema);
    store.update({ width: 4, look: { color: 'red' } });
    const before = store.getSnapshot();
    const stored = env.storage.getItem(settingsStorageKey('sample'));
    const valid = { namespace: 'sample', version: 3, selectedPresetId: '1' };
    const preset = (settings: unknown) => [{ id: '1', name: '', settings }];
    for (const file of [
      'not json',
      '[]',
      JSON.stringify({ ...valid, presets: [] }),
      JSON.stringify({ ...valid, namespace: 'other', presets: preset({ width: 1 }) }),
      JSON.stringify({ ...valid, version: 9, presets: preset({ width: 1 }) }),
      JSON.stringify({ ...valid, presets: preset({ width: 'x' }) }),
    ]) {
      expect(store.importFile(file)).toBe(false);
      expect(store.getSnapshot()).toEqual(before);
      expect(env.storage.getItem(settingsStorageKey('sample'))).toBe(stored);
    }
  });
});
