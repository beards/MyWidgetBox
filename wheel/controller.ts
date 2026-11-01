import { type Appearance, appearanceDefaults, isAppearance, isHexColor } from '../shared/appearance';
import {
  type AnimationSettings,
  MAX_ANIMATION_DURATION,
  MIN_ANIMATION_DURATION,
  REDUCED_MOTION_DURATION,
  animationFor,
  isAnimationDuration,
  isAnimationSettings,
} from '../shared/animation';
import type { Env } from '../shared/env';
import {
  type PresetSummary,
  type SettingsSchema,
  type SettingsStoreOptions,
  createSettingsStore,
  isPlainObject,
  serializeSettings,
} from '../shared/settings';
import { type ShareLinkOptions, createShareLink, readShareLinkSettings } from '../shared/share-link';
import { type SoundSettings, isSoundSettings, soundDefaults } from '../shared/sound';
import { landingAngle } from './geometry';

// Part of this controller's interface (the view and tests use them from here).
export { type AnimationSettings, MAX_ANIMATION_DURATION, MIN_ANIMATION_DURATION, REDUCED_MOTION_DURATION, animationFor };

/** One option on the wheel; its sector's angle is proportional to its weight. */
export interface WheelEntry {
  /** Stable within the Settings, so edits and the drawn-entry State can refer to it. */
  id: string;
  label: string;
  /** Positive number, at most MAX_WEIGHT. */
  weight: number;
  /** `#rrggbb` sector color. */
  color: string;
}

export interface WheelOutcome {
  entryId: string;
  /** Label and color as they were when spun, so history survives later edits. */
  label: string;
  color: string;
  /**
   * Where the pointer stops, in degrees clockwise from the top of the unrotated wheel,
   * always inside the winning entry's sector.
   */
  angle: number;
}

/** A sector of the unrotated wheel, in degrees clockwise from the top. */
export interface Sector {
  entry: WheelEntry;
  start: number;
  end: number;
}

/** The shared appearance baseline plus the wheel's own items. */
export interface WheelAppearance extends Appearance {
  /** `#rrggbb` color of the sector labels. */
  labelColor: string;
  /** `#rrggbb` color of the pointer. */
  pointerColor: string;
  /** Whether entry text stops growing at maxLabelSize; otherwise it grows as far as its sector allows. */
  limitLabelSize: boolean;
  /** How entry text runs: `across` its sector (lines stacked from the rim inwards) or `along` it (reading outwards from the hub). */
  labelDirection: LabelDirection;
  /** Largest entry text size (wheel units, the wheel radius being 100), LABEL_SIZE_LIMIT_MIN..LABEL_SIZE_LIMIT_MAX. */
  maxLabelSize: number;
  /** Result pop-up text size, in % of the wheel diameter (the view shrinks it to keep the pop-up within the wheel). */
  resultTextSize: number;
}

/** What the wheel remembers and shares; one value per Preset. Add new fields with defaults here. */
export interface WheelSettings {
  entries: WheelEntry[];
  appearance: WheelAppearance;
  animation: AnimationSettings;
  /** Take each drawn entry off the wheel until reset (the drawn entries are State, not Settings). */
  removeAfterDraw: boolean;
  /** Tick played each time a sector boundary passes the pointer. */
  sound: SoundSettings;
  result: WheelResultSettings;
}

/** The pop-up showing the Outcome: it can always be clicked away. */
export interface WheelResultSettings {
  /** Whether it goes away by itself; otherwise it stays until clicked or the next spin. */
  autoHide: boolean;
  /** How long it stays when it goes away by itself, RESULT_SECONDS_MIN..RESULT_SECONDS_MAX. */
  seconds: number;
}

export interface WheelState {
  /** The entries of the Settings in effect. */
  entries: WheelEntry[];
  appearance: WheelAppearance;
  animationDuration: number;
  alwaysFullAnimation: boolean;
  removeAfterDraw: boolean;
  /** The sound Settings in effect; the view plays the tick with them. */
  sound: SoundSettings;
  result: WheelResultSettings;
  /**
   * Ids of entries drawn since the last reset (State: kept across reloads, never in Share links),
   * oldest first, always a subset of `entries`. Only used while removeAfterDraw is on.
   */
  drawnEntryIds: string[];
  /**
   * The entries on the wheel, which spins choose from: `entries` minus the drawn ones while
   * removeAfterDraw is on. A drawn entry stays until its spin has been revealed.
   */
  remainingEntries: WheelEntry[];
  /** removeAfterDraw is on and every entry has been drawn: spins are ignored until reset. */
  allDrawn: boolean;
  presets: PresetSummary[];
  /** null while Settings opened from a Share link are in effect and not saved. */
  selectedPresetId: string | null;
  outcome: WheelOutcome | null;
  /** The most recent Outcomes, newest first, at most HISTORY_LIMIT; kept in memory only. */
  history: WheelOutcome[];
  /** True from a spin until the view reports its animation finished; spins are ignored meanwhile. */
  animating: boolean;
}

export interface WheelController {
  getState(): WheelState;
  /** Calls listener after every state change; returns an unsubscribe function. */
  subscribe(listener: (state: WheelState) => void): () => void;
  /** Adds an entry with weight 1 and the next palette color; ignored at MAX_ENTRIES. */
  addEntry(label: string): void;
  /** Changes an entry's label, weight or color; invalid changes are ignored. Entry edits are ignored while animating. */
  updateEntry(id: string, changes: Partial<Omit<WheelEntry, 'id'>>): void;
  /** The last remaining entry cannot be removed. */
  removeEntry(id: string): void;
  /** Replaces the appearance (applied live); invalid appearances are ignored. */
  setAppearance(appearance: WheelAppearance): void;
  /** Decides a new Outcome among the remaining entries and starts animating it; ignored while animating or all drawn. */
  spin(): void;
  /** Called by the view when the animation of the current Outcome has finished; records the draw. */
  finishAnimation(): void;
  /** Clears the Outcome, history and drawn entries (entries are kept); ignored while animating. */
  reset(): void;
  /** Ignored while animating. */
  setRemoveAfterDraw(on: boolean): void;
  /** Changes some sound Settings; ignored if the result is invalid (volume outside 0–1, non-http(s) URL). */
  setSound(next: Partial<SoundSettings>): void;
  /** Sets the full animation length in ms; values outside 1–10 seconds are ignored. */
  setAnimationDuration(ms: number): void;
  setAlwaysFullAnimation(always: boolean): void;
  /** Changes when the result pop-up goes away; invalid times are ignored. */
  setResult(next: Partial<WheelResultSettings>): void;
  /** Replaces the Settings of the selected Preset (or of the Share link) with the defaults; keeps the Preset's name. Nothing stays drawn; ignored while animating. */
  restoreDefaults(): void;
  /** Saves the current Settings as a new Preset (with nothing drawn yet) and switches to it; ignored while animating. */
  createPreset(name: string): void;
  /** Ignored while animating. */
  selectPreset(id: string): void;
  renamePreset(id: string, name: string): void;
  /** The last remaining Preset cannot be deleted; ignored while animating. */
  deletePreset(id: string): void;
  /** A Share link to this page carrying the Settings in effect. */
  shareLink(options?: ShareLinkOptions): string;
  /** JSON backup of every Preset. */
  exportSettings(): string;
  /** Replaces all Presets from an export file; returns false and changes nothing if it is invalid or while animating. */
  importSettings(text: string): boolean;
}

/** Storage key of the State (drawn entries), separate from the Settings. */
export const WHEEL_STATE_KEY = 'mywidgetbox:wheel:state';
const STATE_VERSION = 1;

/**
 * Drawn entries are kept per Preset (and one scope for Settings opened from a Share link),
 * so entry ids reused in another Preset never show as drawn there.
 */
function drawnScope(selectedPresetId: string | null): string {
  return selectedPresetId === null ? 'shared' : `preset:${selectedPresetId}`;
}

export const MAX_ENTRIES = 100;
export const MAX_LABEL_LENGTH = 100;
export const MAX_WEIGHT = 1_000_000;
export const HISTORY_LIMIT = 20;
export const LABEL_DIRECTIONS = ['across', 'along'] as const;
export type LabelDirection = (typeof LABEL_DIRECTIONS)[number];
export const LABEL_SIZE_LIMIT_MIN = 4;
export const LABEL_SIZE_LIMIT_MAX = 40;
export const RESULT_TEXT_SIZE_MIN = 4;
export const RESULT_TEXT_SIZE_MAX = 30;
export const RESULT_SECONDS_MIN = 1;
export const RESULT_SECONDS_MAX = 30;

/** Colors given to new entries in turn (white labels stay readable on all of them). */
export const PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#469990', '#9a6324', '#808000'];

const defaultEntries: WheelEntry[] = ['A', 'B', 'C', 'D', 'E', 'F'].map((label, index) => ({
  id: String(index + 1),
  label,
  weight: 1,
  color: PALETTE[index % PALETTE.length]!,
}));

export const wheelSettingsSchema: SettingsSchema<WheelSettings> = {
  namespace: 'wheel',
  version: 1,
  // Fields added later need no version bump: missing ones are filled from these defaults.
  defaults: {
    entries: defaultEntries,
    appearance: { ...appearanceDefaults, labelColor: '#ffffff', pointerColor: '#222222', labelDirection: 'across', limitLabelSize: true, maxLabelSize: 20, resultTextSize: 12 },
    animation: { duration: 5000, alwaysFull: false },
    removeAfterDraw: false,
    sound: soundDefaults,
    result: { autoHide: false, seconds: 4 },
  },
  isValid: (settings): settings is WheelSettings =>
    isEntryList((settings as WheelSettings).entries) &&
    isWheelAppearance((settings as WheelSettings).appearance) &&
    isAnimationSettings((settings as WheelSettings).animation) &&
    typeof (settings as WheelSettings).removeAfterDraw === 'boolean' &&
    isSoundSettings((settings as WheelSettings).sound) &&
    isResultSettings((settings as WheelSettings).result),
};

function isResultSettings(value: unknown): value is WheelResultSettings {
  const { autoHide, seconds } = (value ?? {}) as Partial<WheelResultSettings>;
  return (
    typeof autoHide === 'boolean' &&
    typeof seconds === 'number' &&
    seconds >= RESULT_SECONDS_MIN &&
    seconds <= RESULT_SECONDS_MAX
  );
}

function isWeight(weight: unknown): weight is number {
  return typeof weight === 'number' && Number.isFinite(weight) && weight > 0 && weight <= MAX_WEIGHT;
}

function isEntry(value: unknown): value is WheelEntry {
  const { id, label, weight, color } = (value ?? {}) as Partial<WheelEntry>;
  return (
    typeof id === 'string' &&
    id !== '' &&
    typeof label === 'string' &&
    label.length <= MAX_LABEL_LENGTH &&
    isWeight(weight) &&
    isHexColor(color)
  );
}

function isEntryList(value: unknown): value is WheelEntry[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= MAX_ENTRIES &&
    value.every(isEntry) &&
    new Set(value.map((entry) => entry.id)).size === value.length
  );
}

function isWheelAppearance(value: unknown): value is WheelAppearance {
  const { labelColor, pointerColor, labelDirection, limitLabelSize, maxLabelSize, resultTextSize } = (value ??
    {}) as Partial<WheelAppearance>;
  return (
    isAppearance(value) &&
    isHexColor(labelColor) &&
    isHexColor(pointerColor) &&
    LABEL_DIRECTIONS.includes(labelDirection as LabelDirection) &&
    typeof limitLabelSize === 'boolean' &&
    typeof maxLabelSize === 'number' &&
    maxLabelSize >= LABEL_SIZE_LIMIT_MIN &&
    maxLabelSize <= LABEL_SIZE_LIMIT_MAX &&
    typeof resultTextSize === 'number' &&
    resultTextSize >= RESULT_TEXT_SIZE_MIN &&
    resultTextSize <= RESULT_TEXT_SIZE_MAX
  );
}

/** The sectors of the unrotated wheel, in entry order, each spanning weight / total of 360°. */
export function sectorsFor(entries: WheelEntry[]): Sector[] {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let start = 0;
  return entries.map((entry, index) => {
    // The last sector closes the circle exactly, whatever the rounding.
    const end = index === entries.length - 1 ? 360 : start + (entry.weight / total) * 360;
    const sector = { entry, start, end };
    start = end;
    return sector;
  });
}

/** A fraction in [0, 1) from one uint32. */
const fraction = (randomUint32: () => number) => randomUint32() / 2 ** 32;

/**
 * Headless wheel logic: no DOM, all outside-world access goes through env.
 * Settings carried by a Share link in env.url take priority over stored ones.
 */
export function createWheelController(
  env: Env,
  settingsOptions: SettingsStoreOptions = { readUrl: readShareLinkSettings },
): WheelController {
  const settings = createSettingsStore(env, wheelSettingsSchema, settingsOptions);
  /** Drawn entry ids by scope (see drawnScope). */
  let drawnByScope: Record<string, string[]> = readDrawn() ?? {};
  let drawn: string[] = drawnByScope[scope()] ?? [];
  let lastRemaining: WheelEntry[] = [];
  let state: WheelState = { ...fromSettings(), outcome: null, history: [], animating: false };
  const listeners = new Set<(state: WheelState) => void>();

  function scope() {
    return drawnScope(settings.getSnapshot().selectedPresetId);
  }

  /** The stored draws; null if storage cannot be read at all (then the in-memory ones stay). */
  function readDrawn(): Record<string, string[]> | null {
    let raw: string | null;
    try {
      raw = env.storage.getItem(WHEEL_STATE_KEY);
    } catch {
      return null;
    }
    try {
      const data: unknown = JSON.parse(raw ?? 'null');
      if (!isPlainObject(data)) return {};
      if (data.version !== STATE_VERSION || !isPlainObject(data.scopes)) return {};
      return Object.fromEntries(
        Object.entries(data.scopes).flatMap(([key, list]) => (Array.isArray(list) ? [[key, ids(list)]] : [])),
      );
    } catch {
      return {};
    }
  }

  /** Changes the drawn entries of the Settings in effect, re-reading storage first so draws made meanwhile in another tab survive. */
  function setDrawn(change: (current: string[]) => string[]) {
    const key = scope();
    const current = readDrawn() ?? drawnByScope;
    drawnByScope = { ...current, [key]: change(current[key] ?? []) };
    drawn = drawnByScope[key]!;
    writeDrawn();
  }

  function writeDrawn() {
    try {
      env.storage.setItem(WHEEL_STATE_KEY, JSON.stringify({ version: STATE_VERSION, scopes: drawnByScope }));
    } catch {
      // Storage full or unavailable: keep working from memory.
    }
  }

  // Another tab drew or reset. Mid-spin the wheel must not change; finishAnimation catches up.
  env.onStorageChange((key) => {
    if ((key !== WHEEL_STATE_KEY && key !== null) || state.animating) return;
    drawnByScope = readDrawn() ?? drawnByScope;
    update(fromSettings());
  });

  /** The Settings in effect plus the drawn State, reconciled with them. */
  function fromSettings() {
    const { settings: current, presets, selectedPresetId } = settings.getSnapshot();
    const { entries, removeAfterDraw } = current;
    drawn = drawnByScope[scope()] ?? [];
    // Entries removed from the Settings (edits, Preset switch, import) are dropped from the State.
    const known = new Set(entries.map((entry) => entry.id));
    if (drawn.some((id) => !known.has(id))) setDrawn((list) => list.filter((id) => known.has(id)));
    const remaining = removeAfterDraw ? entries.filter((entry) => !drawn.includes(entry.id)) : entries;
    // Keep the same array while nothing changed, so the view redraws the wheel only when needed.
    const same = remaining.length === lastRemaining.length && remaining.every((entry, i) => entry === lastRemaining[i]);
    const remainingEntries = same ? lastRemaining : (lastRemaining = remaining);
    return {
      entries,
      appearance: current.appearance,
      animationDuration: current.animation.duration,
      alwaysFullAnimation: current.animation.alwaysFull,
      removeAfterDraw,
      sound: current.sound,
      result: current.result,
      drawnEntryIds: drawn,
      remainingEntries,
      allDrawn: remainingEntries.length === 0,
      presets,
      selectedPresetId,
    };
  }

  function update(next: Partial<WheelState>) {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener(state));
  }

  /** Runs a Settings action, then publishes the resulting Settings and Presets. */
  function changeSettings(action: () => void) {
    action();
    update(fromSettings());
  }

  function updateSettings(next: Partial<WheelSettings>) {
    changeSettings(() => settings.update({ ...settings.getSnapshot().settings, ...next }));
  }

  /** Entries are fixed while the wheel spins, so the Outcome always matches what is shown. */
  function setEntries(entries: WheelEntry[]) {
    if (!state.animating && isEntryList(entries)) updateSettings({ entries });
  }

  function setAnimation(next: Partial<AnimationSettings>) {
    updateSettings({ animation: { ...settings.getSnapshot().settings.animation, ...next } });
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    addEntry(label) {
      const { entries } = state;
      // Deterministic ids, so no randomness is consumed outside spins.
      const id = String(Math.max(0, ...entries.map((entry) => Number(entry.id) || 0)) + 1);
      setEntries([...entries, { id, label, weight: 1, color: PALETTE[entries.length % PALETTE.length]! }]);
    },
    updateEntry(id, changes) {
      const { label, weight, color } = { ...state.entries.find((entry) => entry.id === id), ...changes };
      setEntries(state.entries.map((entry) => (entry.id === id ? { id, label, weight, color } as WheelEntry : entry)));
    },
    removeEntry(id) {
      setEntries(state.entries.filter((entry) => entry.id !== id));
    },
    setAppearance(appearance) {
      if (isWheelAppearance(appearance)) updateSettings({ appearance });
    },
    spin() {
      if (state.animating || state.allDrawn) return;
      const sectors = sectorsFor(state.remainingEntries);
      const target = fraction(env.randomUint32) * 360;
      const { entry, start, end } = sectors.find((sector) => target < sector.end) ?? sectors.at(-1)!;
      const angle = landingAngle({ start, end }, fraction(env.randomUint32));
      const outcome = { entryId: entry.id, label: entry.label, color: entry.color, angle };
      update({ outcome, history: [outcome, ...state.history].slice(0, HISTORY_LIMIT), animating: true });
    },
    finishAnimation() {
      if (!state.animating) return;
      const id = state.outcome?.entryId;
      if (state.removeAfterDraw && id !== undefined) setDrawn((list) => (list.includes(id) ? list : [...list, id]));
      update({ ...fromSettings(), animating: false });
    },
    reset() {
      if (state.animating) return;
      setDrawn(() => []);
      update({ ...fromSettings(), outcome: null, history: [] });
    },
    setRemoveAfterDraw(removeAfterDraw) {
      if (!state.animating) updateSettings({ removeAfterDraw });
    },
    setSound(next) {
      const sound = { ...settings.getSnapshot().settings.sound, ...next };
      if (isSoundSettings(sound)) updateSettings({ sound });
    },
    setAnimationDuration(ms) {
      if (isAnimationDuration(ms)) setAnimation({ duration: ms });
    },
    setAlwaysFullAnimation: (alwaysFull) => setAnimation({ alwaysFull }),
    setResult(next) {
      const result = { ...settings.getSnapshot().settings.result, ...next };
      if (isResultSettings(result)) updateSettings({ result });
    },
    restoreDefaults() {
      if (state.animating) return;
      settings.update(wheelSettingsSchema.defaults);
      // The drawn ids belonged to the replaced entries.
      setDrawn(() => []);
      update(fromSettings());
    },
    createPreset(name) {
      if (state.animating) return;
      settings.createPreset(name);
      // A new Preset starts with nothing drawn (its id may have belonged to a deleted Preset).
      setDrawn(() => []);
      update(fromSettings());
    },
    selectPreset(id) {
      if (!state.animating) changeSettings(() => settings.selectPreset(id));
    },
    renamePreset: (id, name) => changeSettings(() => settings.renamePreset(id, name)),
    deletePreset(id) {
      if (!state.animating) changeSettings(() => settings.deletePreset(id));
    },
    shareLink: (options) =>
      createShareLink(env.url, serializeSettings(wheelSettingsSchema, settings.getSnapshot().settings), options),
    exportSettings: () => settings.exportFile(),
    importSettings(text) {
      if (state.animating || !settings.importFile(text)) return false;
      // The imported Presets replace all others; none of the old draws belong to them.
      drawnByScope = {};
      writeDrawn();
      update(fromSettings());
      return true;
    },
  };
}

function ids(list: unknown[]): string[] {
  return list.filter((id): id is string => typeof id === 'string');
}

