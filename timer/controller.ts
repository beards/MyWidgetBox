import { type Appearance, appearanceDefaults, isAppearance } from '../shared/appearance';
import type { Env } from '../shared/env';
import {
  type PresetSummary,
  type SettingsSchema,
  type SettingsStoreOptions,
  createSettingsStore,
  serializeSettings,
} from '../shared/settings';
import { type ShareLinkOptions, createShareLink, readShareLinkSettings } from '../shared/share-link';

export const TIMER_MODES = ['countdown', 'stopwatch'] as const;
/** `countdown`: counts a duration down to zero; `stopwatch`: counts up from zero. */
export type TimerMode = (typeof TIMER_MODES)[number];

/** One timer as the user set it up; part of the Settings. */
export interface TimerConfig {
  /** Stable id; links the timer to its run State. */
  id: string;
  /** May be empty; the view shows a localized fallback then. */
  name: string;
  mode: TimerMode;
  /** Countdown length in ms (whole seconds, MIN_DURATION..MAX_DURATION); kept while in stopwatch mode. */
  duration: number;
}

/** What the timer remembers and shares; one value per Preset. */
export interface TimerSettings {
  /** The timers on the page, in display order; always at least one. */
  timers: TimerConfig[];
  appearance: Appearance;
}

/**
 * How far a timer has run, as timestamps rather than ticks, so the shown value is computed
 * from the clock and never drifts (background tabs, reloads). Part of the State.
 */
export interface TimerRun {
  /** env.now() when the timer was last started or resumed; null while not running. */
  startedAt: number | null;
  /** Time run before startedAt (sum of the earlier running spans), in ms. */
  elapsed: number;
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'timeUp';

/** A timer as the view sees it: its Settings plus its run State. */
export interface TimerView extends TimerConfig {
  run: TimerRun;
}

export interface TimerState {
  timers: TimerView[];
  appearance: Appearance;
  presets: PresetSummary[];
  /** null while Settings opened from a Share link are in effect and not saved. */
  selectedPresetId: string | null;
}

export interface TimerReading {
  /** Remaining ms for a countdown (never below 0), elapsed ms for a stopwatch. */
  value: number;
  status: TimerStatus;
}

export interface TimerController {
  getState(): TimerState;
  /** Calls listener after every state change (not on clock ticks); returns an unsubscribe function. */
  subscribe(listener: (state: TimerState) => void): () => void;
  /** Starts or resumes; ignored while running or when the countdown is up. */
  start(id: string): void;
  /** Ignored unless running and not yet up. */
  pause(id: string): void;
  /** Back to zero (a countdown back to its full duration), not running. */
  reset(id: string): void;
  /** Switching mode resets the timer. */
  setMode(id: string, mode: TimerMode): void;
  /** Sets the countdown length (resets the timer); invalid values are ignored. */
  setDuration(id: string, ms: number): void;
  /** Replaces the appearance (applied live); invalid appearances are ignored. */
  setAppearance(appearance: Appearance): void;
  /** Saves the current Settings as a new Preset and switches to it. */
  createPreset(name: string): void;
  selectPreset(id: string): void;
  renamePreset(id: string, name: string): void;
  /** The last remaining Preset cannot be deleted. */
  deletePreset(id: string): void;
  /** A Share link to this page carrying the Settings in effect (never the State). */
  shareLink(options?: ShareLinkOptions): string;
  exportSettings(): string;
  importSettings(text: string): boolean;
}

export const MIN_DURATION = 1000;
/** 99:59:59. */
export const MAX_DURATION = (99 * 3600 + 59 * 60 + 59) * 1000;

/** Storage key of the State (running timers), separate from the Settings. */
export const TIMER_STATE_KEY = 'mywidgetbox:timer:state';
const STATE_VERSION = 1;

export const timerSettingsSchema: SettingsSchema<TimerSettings> = {
  namespace: 'timer',
  version: 1,
  // Note: fields inside `timers` entries are not filled from defaults (arrays are taken
  // whole), so adding a field to TimerConfig needs a version bump and a Migration.
  defaults: {
    timers: [{ id: '1', name: '', mode: 'countdown', duration: 5 * 60 * 1000 }],
    appearance: { ...appearanceDefaults, fontSize: 96 },
  },
  isValid: (settings): settings is TimerSettings =>
    isTimerList((settings as TimerSettings).timers) && isAppearance((settings as TimerSettings).appearance),
};

function isValidDuration(ms: unknown): ms is number {
  return Number.isInteger(ms) && (ms as number) % 1000 === 0 && (ms as number) >= MIN_DURATION && (ms as number) <= MAX_DURATION;
}

function isTimerList(value: unknown): value is TimerConfig[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    new Set(value.map((timer) => timer?.id)).size === value.length &&
    value.every(
      (timer) =>
        typeof timer?.id === 'string' &&
        timer.id !== '' &&
        typeof timer.name === 'string' &&
        TIMER_MODES.includes(timer.mode) &&
        isValidDuration(timer.duration),
    )
  );
}

const IDLE: TimerRun = { startedAt: null, elapsed: 0 };

/** The value to show and the status of a timer at time `now` (pass env.now()). */
export function readTimer({ mode, duration, run }: TimerView, now: number): TimerReading {
  const running = run.startedAt !== null;
  // A clock set backwards must not run the timer backwards.
  const elapsed = run.elapsed + (running ? Math.max(0, now - run.startedAt!) : 0);
  if (mode === 'countdown' && elapsed >= duration) return { value: 0, status: 'timeUp' };
  const status: TimerStatus = running ? 'running' : elapsed > 0 ? 'paused' : 'idle';
  return { value: mode === 'countdown' ? duration - elapsed : elapsed, status };
}

/**
 * The value of a timer at time `now`: `mm:ss` below an hour, `hh:mm:ss` from an hour on.
 * A countdown rounds up (it shows 00:00 only once time is up), a stopwatch rounds down.
 */
export function formatTimer(timer: TimerView, now: number): string {
  const { value } = readTimer(timer, now);
  const total = timer.mode === 'countdown' ? Math.ceil(value / 1000) : Math.floor(value / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const rest = `${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return hours > 0 ? `${pad(hours)}:${rest}` : rest;
}

/**
 * Headless timer logic: no DOM, all outside-world access goes through env.
 * Settings carried by a Share link in env.url take priority over stored ones; the State
 * (how far each timer has run) is stored under its own key and keyed by timer id.
 */
export function createTimerController(
  env: Env,
  settingsOptions: SettingsStoreOptions = { readUrl: readShareLinkSettings },
): TimerController {
  const settings = createSettingsStore(env, timerSettingsSchema, settingsOptions);
  let runs: Record<string, TimerRun> = loadRuns();
  let state = build();
  const listeners = new Set<(state: TimerState) => void>();

  function loadRuns(): Record<string, TimerRun> {
    try {
      const data: unknown = JSON.parse(env.storage.getItem(TIMER_STATE_KEY) ?? 'null');
      if (!isRecord(data) || data.version !== STATE_VERSION || !isRecord(data.timers)) return {};
      return Object.fromEntries(Object.entries(data.timers).filter(([, run]) => isTimerRun(run))) as Record<
        string,
        TimerRun
      >;
    } catch {
      return {};
    }
  }

  function saveRuns() {
    try {
      env.storage.setItem(TIMER_STATE_KEY, JSON.stringify({ version: STATE_VERSION, timers: runs }));
    } catch {
      // Storage full or unavailable: keep working from memory.
    }
  }

  function build(): TimerState {
    const { settings: current, presets, selectedPresetId } = settings.getSnapshot();
    return {
      timers: current.timers.map((timer) => ({ ...timer, run: runs[timer.id] ?? IDLE })),
      appearance: current.appearance,
      presets,
      selectedPresetId,
    };
  }

  function publish() {
    state = build();
    listeners.forEach((listener) => listener(state));
  }

  function setRun(id: string, run: TimerRun) {
    runs = { ...runs, [id]: run };
    saveRuns();
    publish();
  }

  const find = (id: string) => state.timers.find((timer) => timer.id === id);

  function changeSettings(action: () => void) {
    action();
    publish();
  }

  /** Replaces one timer's Settings and resets its run (its old progress no longer fits). */
  function editTimer(id: string, change: Partial<TimerConfig>) {
    const current = settings.getSnapshot().settings;
    if (!current.timers.some((timer) => timer.id === id)) return;
    const timers = current.timers.map((timer) => (timer.id === id ? { ...timer, ...change } : timer));
    settings.update({ ...current, timers });
    setRun(id, IDLE);
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start(id) {
      const timer = find(id);
      if (!timer) return;
      const { status } = readTimer(timer, env.now());
      if (status === 'running' || status === 'timeUp') return;
      setRun(id, { startedAt: env.now(), elapsed: timer.run.elapsed });
    },
    pause(id) {
      const timer = find(id);
      if (!timer || readTimer(timer, env.now()).status !== 'running') return;
      const now = env.now();
      setRun(id, { startedAt: null, elapsed: timer.run.elapsed + Math.max(0, now - timer.run.startedAt!) });
    },
    reset(id) {
      if (find(id)) setRun(id, IDLE);
    },
    setMode(id, mode) {
      if (TIMER_MODES.includes(mode)) editTimer(id, { mode });
    },
    setDuration(id, ms) {
      if (isValidDuration(ms)) editTimer(id, { duration: ms });
    },
    setAppearance(appearance) {
      if (!isAppearance(appearance)) return;
      changeSettings(() => settings.update({ ...settings.getSnapshot().settings, appearance }));
    },
    createPreset: (name) => changeSettings(() => settings.createPreset(name)),
    selectPreset: (id) => changeSettings(() => settings.selectPreset(id)),
    renamePreset: (id, name) => changeSettings(() => settings.renamePreset(id, name)),
    deletePreset: (id) => changeSettings(() => settings.deletePreset(id)),
    shareLink: (options) =>
      createShareLink(env.url, serializeSettings(timerSettingsSchema, settings.getSnapshot().settings), options),
    exportSettings: () => settings.exportFile(),
    importSettings(text) {
      if (!settings.importFile(text)) return false;
      publish();
      return true;
    },
  };
}

function isTimerRun(value: unknown): value is TimerRun {
  if (!isRecord(value)) return false;
  const { startedAt, elapsed } = value;
  return (
    (startedAt === null || (typeof startedAt === 'number' && Number.isFinite(startedAt))) &&
    typeof elapsed === 'number' &&
    Number.isFinite(elapsed) &&
    elapsed >= 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
