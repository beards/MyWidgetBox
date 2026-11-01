import type { Env } from './env';

/**
 * Shared (opt-in) Settings flow: versioned Settings per Widget, named Presets, and the load priority URL > storage > defaults, where any layer that
 * fails to parse or validate falls through to the next one.
 */

export interface SettingsSchema<S extends object> {
  /** Storage namespace, unique per Widget, e.g. 'dice'. */
  namespace: string;
  /** Current schema version; Settings written with any other version are not read. */
  version: number;
  defaults: S;
  /**
   * Checks Settings that already have missing fields filled from `defaults` and unknown
   * fields dropped. Returning false makes the whole layer (URL, stored Preset) fall through.
   */
  isValid(settings: unknown): settings is S;
}

/** Settings as carried outside the running page (Share link, storage, export file). */
export interface VersionedSettings {
  version: number;
  settings: unknown;
}

export type SettingsSource = 'url' | 'storage' | 'defaults';

export interface PresetSummary {
  id: string;
  /** May be empty (the initial Preset); the view shows a localized fallback name then. */
  name: string;
}

export interface SettingsSnapshot<S> {
  /** The Settings in effect right now. */
  settings: S;
  presets: PresetSummary[];
  /** The Preset being edited; null while Settings come from the URL and are not saved. */
  selectedPresetId: string | null;
  /** Which layer the Settings in effect were loaded from. */
  source: SettingsSource;
}

export interface SettingsStoreOptions {
  /**
   * URL layer of the load priority (filled in by the Share link ticket). Returns the
   * Settings encoded in the URL, or null when there are none. Throwing, or returning
   * Settings that fail validation, falls through to storage.
   */
  readUrl?: (url: URL) => VersionedSettings | null;
}

export interface SettingsStore<S> {
  getSnapshot(): SettingsSnapshot<S>;
  /**
   * Replaces the Settings in effect (the caller validates them). Saved to the selected
   * Preset; Settings opened from the URL stay in memory only.
   */
  update(settings: S): void;
  /** Saves the Settings in effect as a new Preset and selects it (also saves URL Settings). */
  createPreset(name: string): string;
  /** Switches to a stored Preset; unknown ids are ignored. */
  selectPreset(id: string): void;
  renamePreset(id: string, name: string): void;
  /** Deletes a Preset; the last remaining one cannot be deleted. */
  deletePreset(id: string): void;
  /** JSON backup of every Preset, with the schema version and the Widget's namespace. */
  exportFile(): string;
  /**
   * Replaces all Presets with those in an export file, validated like stored
   * ones. Returns false and changes nothing when the file (or any Preset in it) is unreadable.
   */
  importFile(text: string): boolean;
}

interface Preset<S> {
  id: string;
  name: string;
  settings: S;
}

interface StoredDocument<S> {
  presets: Preset<S>[];
  selectedPresetId: string;
}

/** Storage key holding one Widget's Presets (State, when a Widget has some, uses its own key). */
export function settingsStorageKey(namespace: string): string {
  return `mywidgetbox:${namespace}:settings`;
}

/**
 * Validates Settings written with the current schema version.
 * Returns null when they cannot be read. Reusable by Share link decoding and import.
 */
export function parseSettings<S extends object>(schema: SettingsSchema<S>, { version, settings }: VersionedSettings): S | null {
  try {
    if (version !== schema.version) return null;
    const filled = fillFromDefaults(schema.defaults, settings);
    return schema.isValid(filled) ? filled : null;
  } catch {
    return null;
  }
}

/** The versioned form of Settings, as written to storage, Share links and export files. */
export function serializeSettings<S extends object>(schema: SettingsSchema<S>, settings: S): VersionedSettings {
  return { version: schema.version, settings };
}

export function createSettingsStore<S extends object>(
  env: Env,
  schema: SettingsSchema<S>,
  options: SettingsStoreOptions = {},
): SettingsStore<S> {
  const key = settingsStorageKey(schema.namespace);
  const stored = readStorage();
  let doc: StoredDocument<S> = stored ?? {
    presets: [{ id: '1', name: '', settings: schema.defaults }],
    selectedPresetId: '1',
  };
  const fromUrl = readUrl();
  /** Settings opened from the URL; in memory only until saved as a Preset. */
  let urlSettings: S | null = fromUrl;
  let source: SettingsSource = fromUrl ? 'url' : stored ? 'storage' : 'defaults';

  function readUrl(): S | null {
    try {
      const input = options.readUrl?.(env.url);
      return input ? parseSettings(schema, input) : null;
    } catch {
      return null;
    }
  }

  function readStorage(): StoredDocument<S> | null {
    try {
      const raw = env.storage.getItem(key);
      // A stored Preset that cannot be read is dropped; the others survive.
      return raw === null ? null : parseDocument(JSON.parse(raw), false);
    } catch {
      return null;
    }
  }

  /** Reads a stored or exported document; `strict` rejects it when any Preset is unreadable. */
  function parseDocument(data: unknown, strict: boolean): StoredDocument<S> | null {
    if (!isPlainObject(data) || !Array.isArray(data.presets)) return null;
    const version = data.version as number;
    const presets = data.presets.flatMap((entry: unknown): Preset<S>[] => {
      if (!isPlainObject(entry) || typeof entry.id !== 'string' || typeof entry.name !== 'string') return [];
      const settings = parseSettings(schema, { version, settings: entry.settings });
      return settings ? [{ id: entry.id, name: entry.name, settings }] : [];
    });
    if (presets.length === 0 || (strict && presets.length !== data.presets.length)) return null;
    const selected = presets.find((preset) => preset.id === data.selectedPresetId) ?? presets[0]!;
    return { presets, selectedPresetId: selected.id };
  }

  function save() {
    if (!urlSettings) source = 'storage';
    try {
      env.storage.setItem(key, JSON.stringify({ version: schema.version, ...doc }));
    } catch {
      // Storage full or unavailable: keep working from memory.
    }
  }

  const selected = () => doc.presets.find((preset) => preset.id === doc.selectedPresetId)!;

  return {
    getSnapshot: () => ({
      settings: urlSettings ?? selected().settings,
      presets: doc.presets.map(({ id, name }) => ({ id, name })),
      selectedPresetId: urlSettings ? null : doc.selectedPresetId,
      source,
    }),
    update(settings) {
      if (urlSettings) {
        urlSettings = settings;
        return;
      }
      doc = {
        ...doc,
        presets: doc.presets.map((preset) => (preset.id === doc.selectedPresetId ? { ...preset, settings } : preset)),
      };
      save();
    },
    createPreset(name) {
      const id = String(Math.max(0, ...doc.presets.map((preset) => Number(preset.id) || 0)) + 1);
      const settings = urlSettings ?? selected().settings;
      urlSettings = null;
      doc = { presets: [...doc.presets, { id, name, settings }], selectedPresetId: id };
      save();
      return id;
    },
    selectPreset(id) {
      if (!doc.presets.some((preset) => preset.id === id)) return;
      urlSettings = null;
      doc = { ...doc, selectedPresetId: id };
      save();
    },
    renamePreset(id, name) {
      if (!doc.presets.some((preset) => preset.id === id)) return;
      doc = { ...doc, presets: doc.presets.map((preset) => (preset.id === id ? { ...preset, name } : preset)) };
      save();
    },
    deletePreset(id) {
      if (doc.presets.length === 1 || !doc.presets.some((preset) => preset.id === id)) return;
      const presets = doc.presets.filter((preset) => preset.id !== id);
      const selectedPresetId = doc.selectedPresetId === id ? presets[0]!.id : doc.selectedPresetId;
      doc = { presets, selectedPresetId };
      save();
    },
    exportFile: () => JSON.stringify({ namespace: schema.namespace, version: schema.version, ...doc }, null, 2),
    importFile(text) {
      let imported: StoredDocument<S> | null;
      try {
        const data: unknown = JSON.parse(text);
        imported = isPlainObject(data) && data.namespace === schema.namespace ? parseDocument(data, true) : null;
      } catch {
        return false;
      }
      if (!imported) return false;
      urlSettings = null;
      doc = imported;
      save();
      return true;
    },
  };
}

/**
 * Missing fields are taken from defaults, unknown fields are dropped; nested plain objects
 * are filled recursively. Arrays and other values are taken as they are.
 */
function fillFromDefaults(defaults: object, value: unknown): unknown {
  if (!isPlainObject(value)) return value;
  const filled: Record<string, unknown> = {};
  for (const [field, fallback] of Object.entries(defaults)) {
    if (!(field in value)) filled[field] = fallback;
    else if (isPlainObject(fallback)) filled[field] = fillFromDefaults(fallback, value[field]);
    else filled[field] = value[field];
  }
  return filled;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
