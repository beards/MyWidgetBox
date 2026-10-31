import { type Appearance, appearanceDefaults, isAppearance, isHexColor } from '../shared/appearance';
import type { Env } from '../shared/env';
import {
  type PresetSummary,
  type SettingsSchema,
  type SettingsStoreOptions,
  createSettingsStore,
  serializeSettings,
} from '../shared/settings';
import { type ShareLinkOptions, createShareLink, readShareLinkSettings } from '../shared/share-link';

/** One option on the wheel; its sector's angle is proportional to its weight. */
export interface WheelEntry {
  /** Stable within the Settings, so edits and (later) drawn-entry State can refer to it. */
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
}

export interface AnimationSettings {
  /** Length of a full spin in ms, MIN_ANIMATION_DURATION..MAX_ANIMATION_DURATION. */
  duration: number;
  /** Play the full animation even when the system asks for reduced motion. */
  alwaysFull: boolean;
}

/** What the wheel remembers and shares; one value per Preset. Add new fields with defaults here. */
export interface WheelSettings {
  entries: WheelEntry[];
  appearance: WheelAppearance;
  animation: AnimationSettings;
}

export interface WheelState {
  /** The entries of the Settings in effect. */
  entries: WheelEntry[];
  appearance: WheelAppearance;
  animationDuration: number;
  alwaysFullAnimation: boolean;
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
  /** Changes an entry's label, weight or color; invalid changes are ignored. */
  updateEntry(id: string, changes: Partial<Omit<WheelEntry, 'id'>>): void;
  /** The last remaining entry cannot be removed. */
  removeEntry(id: string): void;
  /** Replaces the appearance (applied live); invalid appearances are ignored. */
  setAppearance(appearance: WheelAppearance): void;
  /** Decides a new Outcome and starts animating it; ignored while animating. */
  spin(): void;
  /** Called by the view when the animation of the current Outcome has finished. */
  finishAnimation(): void;
  /** Clears the Outcome and history (entries are kept); ignored while animating. */
  reset(): void;
  /** Sets the full animation length in ms; values outside 1–10 seconds are ignored. */
  setAnimationDuration(ms: number): void;
  setAlwaysFullAnimation(always: boolean): void;
  /** Saves the current Settings as a new Preset and switches to it. */
  createPreset(name: string): void;
  selectPreset(id: string): void;
  renamePreset(id: string, name: string): void;
  /** The last remaining Preset cannot be deleted. */
  deletePreset(id: string): void;
  /** A Share link to this page carrying the Settings in effect. */
  shareLink(options?: ShareLinkOptions): string;
  /** JSON backup of every Preset. */
  exportSettings(): string;
  /** Replaces all Presets from an export file; returns false and changes nothing if it is invalid. */
  importSettings(text: string): boolean;
}

export const MAX_ENTRIES = 100;
export const MAX_LABEL_LENGTH = 100;
export const MAX_WEIGHT = 1_000_000;
export const HISTORY_LIMIT = 20;
export const MIN_ANIMATION_DURATION = 1000;
export const MAX_ANIMATION_DURATION = 10_000;
/** Duration of the quick reveal that replaces the spin under reduced motion. */
export const REDUCED_MOTION_DURATION = 300;
/** The pointer lands in this inner fraction of the winning sector, never right on a border. */
const LANDING_FRACTION = 0.8;

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
    appearance: { ...appearanceDefaults, labelColor: '#ffffff', pointerColor: '#222222' },
    animation: { duration: 5000, alwaysFull: false },
  },
  isValid: (settings): settings is WheelSettings =>
    isEntryList((settings as WheelSettings).entries) &&
    isWheelAppearance((settings as WheelSettings).appearance) &&
    isAnimationSettings((settings as WheelSettings).animation),
};

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
  const { labelColor, pointerColor } = (value ?? {}) as Partial<WheelAppearance>;
  return isAppearance(value) && isHexColor(labelColor) && isHexColor(pointerColor);
}

function isValidDuration(duration: unknown): duration is number {
  return typeof duration === 'number' && duration >= MIN_ANIMATION_DURATION && duration <= MAX_ANIMATION_DURATION;
}

function isAnimationSettings(value: unknown): value is AnimationSettings {
  const { duration, alwaysFull } = (value ?? {}) as Partial<AnimationSettings>;
  return isValidDuration(duration) && typeof alwaysFull === 'boolean';
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
  let state: WheelState = { ...fromSettings(), outcome: null, history: [], animating: false };
  const listeners = new Set<(state: WheelState) => void>();

  function fromSettings() {
    const { settings: current, presets, selectedPresetId } = settings.getSnapshot();
    return {
      entries: current.entries,
      appearance: current.appearance,
      animationDuration: current.animation.duration,
      alwaysFullAnimation: current.animation.alwaysFull,
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

  function setEntries(entries: WheelEntry[]) {
    if (isEntryList(entries)) updateSettings({ entries });
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
      if (state.animating) return;
      const sectors = sectorsFor(state.entries);
      const target = fraction(env.randomUint32) * 360;
      const { entry, start, end } = sectors.find((sector) => target < sector.end) ?? sectors.at(-1)!;
      const margin = (1 - LANDING_FRACTION) / 2;
      const angle = start + (end - start) * (margin + LANDING_FRACTION * fraction(env.randomUint32));
      const outcome = { entryId: entry.id, label: entry.label, color: entry.color, angle };
      update({ outcome, history: [outcome, ...state.history].slice(0, HISTORY_LIMIT), animating: true });
    },
    finishAnimation() {
      if (state.animating) update({ animating: false });
    },
    reset() {
      if (!state.animating) update({ outcome: null, history: [] });
    },
    setAnimationDuration(ms) {
      if (isValidDuration(ms)) setAnimation({ duration: ms });
    },
    setAlwaysFullAnimation: (alwaysFull) => setAnimation({ alwaysFull }),
    createPreset: (name) => changeSettings(() => settings.createPreset(name)),
    selectPreset: (id) => changeSettings(() => settings.selectPreset(id)),
    renamePreset: (id, name) => changeSettings(() => settings.renamePreset(id, name)),
    deletePreset: (id) => changeSettings(() => settings.deletePreset(id)),
    shareLink: (options) =>
      createShareLink(env.url, serializeSettings(wheelSettingsSchema, settings.getSnapshot().settings), options),
    exportSettings: () => settings.exportFile(),
    importSettings(text) {
      if (!settings.importFile(text)) return false;
      update(fromSettings());
      return true;
    },
  };
}

/** How the view should animate a spin, given whether the system asks for reduced motion. */
export function animationFor(
  { animationDuration, alwaysFullAnimation }: WheelState,
  prefersReducedMotion: boolean,
): { duration: number; reduced: boolean } {
  const reduced = prefersReducedMotion && !alwaysFullAnimation;
  return { duration: reduced ? REDUCED_MOTION_DURATION : animationDuration, reduced };
}
