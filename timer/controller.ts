import { type Appearance, appearanceDefaults, isAppearance } from '../shared/appearance';
import type { Env } from '../shared/env';
import {
  type PresetSummary,
  type SettingsSchema,
  type SettingsStoreOptions,
  createSettingsStore,
  isPlainObject,
  serializeSettings,
} from '../shared/settings';
import {
  type ShareLinkOptions,
  createShareLink,
  readDisplayOptions,
  readShareLinkSettings,
} from '../shared/share-link';
import { type SoundSettings, isSoundSettings, soundDefaults } from '../shared/sound';

export const TIMER_MODES = ['countdown', 'targetTime', 'stopwatch'] as const;
/**
 * `countdown`: counts a duration down to zero; `targetTime`: counts down to a time of day
 * (follows the clock, no start/pause, see targetDeadline); `stopwatch`: counts up from zero.
 */
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
  /** Local time of day `HH:MM` (24 h) for `targetTime` mode; kept in the other modes. */
  target: string;
}

/** What happens when a countdown runs out; shared by all timers on the page. */
export interface TimerAlertSettings {
  /** How long the alert sound repeats, in whole seconds (1..MAX_ALERT_SOUND_SECONDS). */
  soundSeconds: number;
  /** How long the screen effect lasts, in whole seconds (0..MAX_ALERT_EFFECT_SECONDS); 0 = until stopped. */
  effectSeconds: number;
}

/** What the timer remembers and shares; one value per Preset. */
export interface TimerSettings {
  /** The timers on the page, in display order; always at least one. */
  timers: TimerConfig[];
  /** Show hundredths of a second on every timer. */
  showFraction: boolean;
  appearance: Appearance;
  alert: TimerAlertSettings;
  sound: SoundSettings;
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
  /**
   * The time-up alert of this run: `fired` once it has been handed to the view (so a reload
   * never replays it), `stopped` once the user stopped it. Absent before time is up.
   */
  alert?: 'fired' | 'stopped';
  /** The time-up moment `alert` refers to; set (and only checked) for `targetTime` timers. */
  alertUpAt?: number;
}

export type TimerStatus = 'idle' | 'running' | 'paused' | 'timeUp';

/** A timer as the view sees it: its Settings plus its run State. */
export interface TimerView extends TimerConfig {
  run: TimerRun;
}

export interface TimerState {
  timers: TimerView[];
  showFraction: boolean;
  appearance: Appearance;
  alert: TimerAlertSettings;
  sound: SoundSettings;
  presets: PresetSummary[];
  /** null while Settings opened from a Share link are in effect and not saved. */
  selectedPresetId: string | null;
}

export interface TimerReading {
  /** Remaining ms for a countdown (never below 0), elapsed ms for a stopwatch. */
  value: number;
  status: TimerStatus;
}

/** URL parameter naming the one timer (by id) that Display mode shows. */
export const ONLY_TIMER_PARAM = 'timer';

export interface TimerShareLinkOptions extends ShareLinkOptions {
  /** Id of the only timer to show in Display mode; all timers when omitted. */
  timer?: string;
}

/**
 * The timers the page shows: in Display mode with `?timer=<id>` naming an existing timer,
 * only that one; otherwise all of them.
 */
export function visibleTimers<T extends { id: string }>(timers: T[], url: URL): T[] {
  const only = url.searchParams.get(ONLY_TIMER_PARAM);
  if (!readDisplayOptions(url).display || only === null) return timers;
  const match = timers.filter((timer) => timer.id === only);
  return match.length > 0 ? match : timers;
}

/** A time-up alert the view should play now. */
export interface DueAlert {
  id: string;
  /** How long the sound should still repeat, in ms (the time up may have been a moment ago). */
  soundMs: number;
}

export interface TimerController {
  getState(): TimerState;
  /** Calls listener after every state change (not on clock ticks); returns an unsubscribe function. */
  subscribe(listener: (state: TimerState) => void): () => void;
  /** Starts or resumes; ignored while running, when the countdown is up, and in `targetTime` mode. */
  start(id: string): void;
  /** Ignored unless running and not yet up, and in `targetTime` mode. */
  pause(id: string): void;
  /** Back to zero (a countdown back to its full duration), not running; ignored in `targetTime` mode. */
  reset(id: string): void;
  /** Switching mode resets the timer. */
  setMode(id: string, mode: TimerMode): void;
  /** Sets the countdown length (resets the timer); invalid values are ignored. */
  setDuration(id: string, ms: number): void;
  /** Sets the `targetTime` time of day (`HH:MM`, 24 h); invalid values are ignored. */
  setTarget(id: string, target: string): void;
  /** Appends a new idle timer (default Settings) and returns its id. */
  addTimer(): string;
  /** Removes a timer; the last remaining one cannot be removed. */
  removeTimer(id: string): void;
  /** Sets a timer's name (may be empty); keeps its run. */
  renameTimer(id: string, name: string): void;
  /**
   * The timers whose time is up and whose alert has not fired yet, marked as fired (in the State)
   * so each time up alerts once, also across reloads. A time up whose sound time has already
   * passed (e.g. it ran out while the page was closed) is marked without being returned.
   */
  takeDueAlerts(): DueAlert[];
  /** Stops the alert (sound and effect) of a timer whose time is up. */
  stopAlert(id: string): void;
  /** Changes some alert Settings; ignored if the result is invalid. */
  setAlert(next: Partial<TimerAlertSettings>): void;
  /** Changes some sound Settings; ignored if the result is invalid (volume outside 0–1, non-http(s) URL). */
  setSound(next: Partial<SoundSettings>): void;
  /** Replaces the appearance (applied live); invalid appearances are ignored. */
  setAppearance(appearance: Appearance): void;
  setShowFraction(on: boolean): void;
  /** Saves the current Settings as a new Preset and switches to it. */
  createPreset(name: string): void;
  selectPreset(id: string): void;
  renamePreset(id: string, name: string): void;
  /** The last remaining Preset cannot be deleted. */
  deletePreset(id: string): void;
  /** A Share link to this page carrying the Settings in effect (never the State). */
  shareLink(options?: TimerShareLinkOptions): string;
  exportSettings(): string;
  importSettings(text: string): boolean;
}

export const MIN_DURATION = 1000;
/** 99:59:59. */
export const MAX_DURATION = (99 * 3600 + 59 * 60 + 59) * 1000;

export const MAX_ALERT_SOUND_SECONDS = 60;
export const MAX_ALERT_EFFECT_SECONDS = 3600;

/** Storage key of the State (running timers), separate from the Settings. */
export const TIMER_STATE_KEY = 'mywidgetbox:timer:state';
const STATE_VERSION = 2;

/** A run as stored, with the timer configuration it was started for (see runConfig). */
interface StoredRun extends TimerRun {
  config: string;
}

/** Stored runs by scope (see runScope), then by timer id. */
type ScopedRuns = Record<string, Record<string, StoredRun>>;

/**
 * Runs are kept per Preset (and one scope for Settings opened from a Share link), so a timer
 * id reused in another Preset or Share link never shows someone else's progress.
 */
function runScope(selectedPresetId: string | null): string {
  return selectedPresetId === null ? 'shared' : `preset:${selectedPresetId}`;
}

/** What a run depends on; a run started for another value of this is treated as idle. */
function runConfig({ mode, duration, target }: TimerConfig): string {
  if (mode === 'countdown') return `countdown:${duration}`;
  return mode === 'targetTime' ? `targetTime:${target}` : mode;
}

/**
 * How long a `targetTime` timer stays time up after its target before counting down to the
 * next day's occurrence. Stateless on purpose: an OBS source opened (or reloaded) any day
 * shows the right thing without anyone pressing start.
 */
export const TARGET_TIME_UP_SPAN = 60 * 60 * 1000;
const DEFAULT_TARGET = '21:00';

export const timerSettingsSchema: SettingsSchema<TimerSettings> = {
  namespace: 'timer',
  version: 2,
  // Note: fields inside `timers` entries are not filled from defaults (arrays are taken
  // whole), so adding a field to TimerConfig needs a version bump and a Migration.
  defaults: {
    timers: [{ id: '1', name: '', mode: 'countdown', duration: 5 * 60 * 1000, target: DEFAULT_TARGET }],
    showFraction: false,
    appearance: { ...appearanceDefaults, fontSize: 96 },
    alert: { soundSeconds: 5, effectSeconds: 10 },
    sound: soundDefaults,
  },
  migrations: {
    // Ticket 13 added `target` to every timer.
    1: (settings) => ({
      ...settings,
      timers: Array.isArray(settings.timers)
        ? settings.timers.map((timer: unknown) => (isPlainObject(timer) ? { target: DEFAULT_TARGET, ...timer } : timer))
        : settings.timers,
    }),
  },
  isValid: (settings): settings is TimerSettings =>
    isTimerList((settings as TimerSettings).timers) &&
    typeof (settings as TimerSettings).showFraction === 'boolean' &&
    isAppearance((settings as TimerSettings).appearance) &&
    isAlertSettings((settings as TimerSettings).alert) &&
    isSoundSettings((settings as TimerSettings).sound),
};

function isWholeSeconds(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isAlertSettings(value: unknown): value is TimerAlertSettings {
  const { soundSeconds, effectSeconds } = (value ?? {}) as Partial<TimerAlertSettings>;
  return isWholeSeconds(soundSeconds, 1, MAX_ALERT_SOUND_SECONDS) && isWholeSeconds(effectSeconds, 0, MAX_ALERT_EFFECT_SECONDS);
}

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
        isValidDuration(timer.duration) &&
        isValidTarget(timer.target),
    )
  );
}

function isValidTarget(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * The moment a `targetTime` timer counts down to at `now`: the first local occurrence of
 * `target` later than TARGET_TIME_UP_SPAN before now. So a target that passed less than that
 * span ago shows time up; an earlier one means the next day (local time, DST-aware).
 */
export function targetDeadline(target: string, now: number): number {
  const [hours, minutes] = target.split(':').map(Number);
  const day = new Date(now);
  for (const offset of [-1, 0, 1]) {
    const candidate = new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset, hours, minutes).getTime();
    if (candidate > now - TARGET_TIME_UP_SPAN) return candidate;
  }
  // Unreachable: tomorrow's occurrence is always later than now - span.
  return now;
}

const IDLE: TimerRun = { startedAt: null, elapsed: 0 };

/** The value to show and the status of a timer at time `now` (pass env.now()). */
export function readTimer({ mode, duration, target, run }: TimerView, now: number): TimerReading {
  if (mode === 'targetTime') {
    const remaining = targetDeadline(target, now) - now;
    return remaining > 0 ? { value: remaining, status: 'running' } : { value: 0, status: 'timeUp' };
  }
  const running = run.startedAt !== null;
  // A clock set backwards must not run the timer backwards.
  const elapsed = run.elapsed + (running ? Math.max(0, now - run.startedAt!) : 0);
  if (mode === 'countdown' && elapsed >= duration) return { value: 0, status: 'timeUp' };
  const status: TimerStatus = running ? 'running' : elapsed > 0 ? 'paused' : 'idle';
  return { value: mode === 'countdown' ? duration - elapsed : elapsed, status };
}

/**
 * env.now() at which a running countdown runs (or ran) out; null if it is not counting towards one.
 * For `targetTime`, the deadline in effect at `now` (see targetDeadline): the one that just
 * passed while time is up, else the next one.
 */
export function timeUpAt({ mode, duration, target, run }: TimerView, now: number): number | null {
  if (mode === 'targetTime') return targetDeadline(target, now);
  if (mode !== 'countdown' || run.startedAt === null) return null;
  return run.startedAt + duration - run.elapsed;
}

/**
 * The alert marker of the run that applies to the time up at `upAt`. A `targetTime` timer
 * recurs daily, so its marker only counts for the deadline it was set for.
 */
function alertMarker(timer: TimerView, upAt: number): TimerRun['alert'] {
  if (timer.mode === 'targetTime' && timer.run.alertUpAt !== upAt) return undefined;
  return timer.run.alert;
}

/** Whether a timer's time-up screen effect shows at time `now`. */
export function readAlert(timer: TimerView, now: number, alert: TimerAlertSettings): { effect: boolean } {
  const upAt = timeUpAt(timer, now);
  if (upAt === null || now < upAt || alertMarker(timer, upAt) === 'stopped') return { effect: false };
  return { effect: alert.effectSeconds === 0 || now < upAt + alert.effectSeconds * 1000 };
}

/**
 * The value of a timer at time `now`: `mm:ss` below an hour, `hh:mm:ss` from an hour on.
 * A countdown rounds up (it shows 00:00 only once time is up), a stopwatch rounds down.
 */
export function formatTimer(timer: TimerView, now: number, options: { showFraction?: boolean } = {}): string {
  const { value } = readTimer(timer, now);
  // Rounded in the unit of the last digit shown: seconds, or hundredths with showFraction.
  const unit = options.showFraction ? 10 : 1000;
  const units = timer.mode !== 'stopwatch' ? Math.ceil(value / unit) : Math.floor(value / unit);
  const total = Math.floor((units * unit) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  const rest = `${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  const fraction = options.showFraction ? `.${pad(units % 100)}` : '';
  return (hours > 0 ? `${pad(hours)}:${rest}` : rest) + fraction;
}

/**
 * Headless timer logic: no DOM, all outside-world access goes through env.
 * Settings carried by a Share link in env.url take priority over stored ones; the State
 * (how far each timer has run) is stored under its own key, by Preset (runScope) and timer id,
 * and kept in step with other tabs.
 */
export function createTimerController(
  env: Env,
  settingsOptions: SettingsStoreOptions = { readUrl: readShareLinkSettings },
): TimerController {
  const settings = createSettingsStore(env, timerSettingsSchema, settingsOptions);
  let runs: ScopedRuns = readRuns() ?? {};
  let state = build();
  const listeners = new Set<(state: TimerState) => void>();

  function scope() {
    return runScope(settings.getSnapshot().selectedPresetId);
  }

  function configOf(id: string) {
    return settings.getSnapshot().settings.timers.find((timer) => timer.id === id);
  }

  /** The stored runs; null if storage cannot be read at all (then the in-memory ones stay). */
  function readRuns(): ScopedRuns | null {
    let raw: string | null;
    try {
      raw = env.storage.getItem(TIMER_STATE_KEY);
    } catch {
      return null;
    }
    try {
      const data: unknown = JSON.parse(raw ?? 'null');
      if (!isPlainObject(data)) return {};
      if (data.version === 1 && isPlainObject(data.timers)) return fromVersion1(data.timers);
      if (data.version !== STATE_VERSION || !isPlainObject(data.scopes)) return {};
      return Object.fromEntries(
        Object.entries(data.scopes)
          .filter(([, byId]) => isPlainObject(byId))
          .map(([key, byId]) => [key, validRuns(byId as Record<string, unknown>, (run) => isStoredRun(run))]),
      );
    } catch {
      return {};
    }
  }

  /** Version 1 kept runs by timer id only; they belonged to whatever Settings were in effect. */
  function fromVersion1(timers: Record<string, unknown>): ScopedRuns {
    const byId: Record<string, StoredRun> = {};
    for (const [id, run] of Object.entries(validRuns(timers, isTimerRun))) {
      const config = configOf(id);
      if (config) byId[id] = { ...run, config: runConfig(config) };
    }
    return { [scope()]: byId };
  }

  /** Re-reads the stored runs before writing, so changes made meanwhile in another tab survive. */
  function writeRuns(change: (current: ScopedRuns) => ScopedRuns) {
    runs = change(readRuns() ?? runs);
    try {
      env.storage.setItem(TIMER_STATE_KEY, JSON.stringify({ version: STATE_VERSION, scopes: runs }));
    } catch {
      // Storage full or unavailable: keep working from memory.
    }
  }

  /** Sets runs of the Settings in effect, each tagged with the configuration it applies to. */
  function writeScopeRuns(changes: Record<string, TimerRun>) {
    const key = scope();
    writeRuns((current) => {
      const byId = { ...current[key] };
      for (const [id, run] of Object.entries(changes)) {
        const config = configOf(id);
        if (config) byId[id] = { ...run, config: runConfig(config) };
      }
      return { ...current, [key]: byId };
    });
  }

  /** The run of a timer of the Settings in effect, if it was started for its current configuration. */
  function runOf(timer: TimerConfig): TimerRun {
    const stored = runs[scope()]?.[timer.id];
    if (!stored || stored.config !== runConfig(timer)) return IDLE;
    const { startedAt, elapsed, alert, alertUpAt } = stored;
    return { startedAt, elapsed, ...(alert && { alert }), ...(alertUpAt !== undefined && { alertUpAt }) };
  }

  // Another tab started, paused or stopped a timer.
  env.onStorageChange((key) => {
    if (key !== TIMER_STATE_KEY && key !== null) return;
    runs = readRuns() ?? runs;
    publish();
  });

  function build(): TimerState {
    const { settings: current, presets, selectedPresetId } = settings.getSnapshot();
    return {
      timers: current.timers.map((timer) => ({ ...timer, run: runOf(timer) })),
      showFraction: current.showFraction,
      appearance: current.appearance,
      alert: current.alert,
      sound: current.sound,
      presets,
      selectedPresetId,
    };
  }

  function publish() {
    state = build();
    listeners.forEach((listener) => listener(state));
  }

  function setRun(id: string, run: TimerRun) {
    writeScopeRuns({ [id]: run });
    publish();
  }

  /** A timer that start/pause/reset apply to (`targetTime` timers follow the clock instead). */
  const find = (id: string) => state.timers.find((timer) => timer.id === id && timer.mode !== 'targetTime');

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
    setTarget(id, target) {
      if (isValidTarget(target)) editTimer(id, { target });
    },
    addTimer() {
      const current = settings.getSnapshot().settings;
      // Also skip ids with a stored run (a removed timer, or one in another Preset), so a new
      // timer never picks up someone else's progress.
      const used = [...current.timers.map((entry) => entry.id), ...Object.keys(runs[scope()] ?? {})];
      const id = String(Math.max(0, ...used.map(Number).filter(Number.isInteger)) + 1);
      const template = timerSettingsSchema.defaults.timers[0]!;
      settings.update({ ...current, timers: [...current.timers, { ...template, id }] });
      setRun(id, IDLE);
      return id;
    },
    removeTimer(id) {
      const current = settings.getSnapshot().settings;
      if (current.timers.length <= 1 || !current.timers.some((entry) => entry.id === id)) return;
      changeSettings(() => settings.update({ ...current, timers: current.timers.filter((entry) => entry.id !== id) }));
    },
    renameTimer(id, name) {
      const current = settings.getSnapshot().settings;
      if (typeof name !== 'string' || !current.timers.some((entry) => entry.id === id)) return;
      const timers = current.timers.map((entry) => (entry.id === id ? { ...entry, name } : entry));
      changeSettings(() => settings.update({ ...current, timers }));
    },
    takeDueAlerts() {
      const now = env.now();
      const due: DueAlert[] = [];
      const fired: Record<string, TimerRun> = {};
      for (const view of state.timers) {
        const upAt = timeUpAt(view, now);
        if (upAt === null || now < upAt || alertMarker(view, upAt)) continue;
        fired[view.id] = { ...view.run, alert: 'fired', alertUpAt: upAt };
        const soundMs = upAt + state.alert.soundSeconds * 1000 - now;
        if (soundMs > 0) due.push({ id: view.id, soundMs });
      }
      if (Object.keys(fired).length > 0) {
        writeScopeRuns(fired);
        publish();
      }
      return due;
    },
    stopAlert(id) {
      const now = env.now();
      const view = state.timers.find((timer) => timer.id === id);
      const upAt = view && timeUpAt(view, now);
      if (!view || !upAt || readTimer(view, now).status !== 'timeUp' || alertMarker(view, upAt) === 'stopped') return;
      setRun(id, { ...view.run, alert: 'stopped', alertUpAt: upAt });
    },
    setAlert(next) {
      const current = settings.getSnapshot().settings;
      const alert = { ...current.alert, ...next };
      if (isAlertSettings(alert)) changeSettings(() => settings.update({ ...current, alert }));
    },
    setSound(next) {
      const current = settings.getSnapshot().settings;
      const sound = { ...current.sound, ...next };
      if (isSoundSettings(sound)) changeSettings(() => settings.update({ ...current, sound }));
    },
    setAppearance(appearance) {
      if (!isAppearance(appearance)) return;
      changeSettings(() => settings.update({ ...settings.getSnapshot().settings, appearance }));
    },
    setShowFraction(on) {
      if (typeof on !== 'boolean') return;
      changeSettings(() => settings.update({ ...settings.getSnapshot().settings, showFraction: on }));
    },
    createPreset(name) {
      // The new Preset holds the same timers, so it takes over their runs.
      const from = scope();
      const id = settings.createPreset(name);
      writeRuns((current) => ({ ...current, [runScope(id)]: { ...current[from] } }));
      publish();
    },
    selectPreset: (id) => changeSettings(() => settings.selectPreset(id)),
    renamePreset: (id, name) => changeSettings(() => settings.renamePreset(id, name)),
    deletePreset(id) {
      const before = settings.getSnapshot().presets.length;
      settings.deletePreset(id);
      if (settings.getSnapshot().presets.length < before) {
        writeRuns((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== runScope(id))));
      }
      publish();
    },
    shareLink({ timer: only, ...options } = {}) {
      const link = new URL(
        createShareLink(env.url, serializeSettings(timerSettingsSchema, settings.getSnapshot().settings), options),
      );
      if (only) link.searchParams.set(ONLY_TIMER_PARAM, only);
      return link.href;
    },
    exportSettings: () => settings.exportFile(),
    importSettings(text) {
      if (!settings.importFile(text)) return false;
      // The imported Presets replace all others; none of the old runs belong to them.
      writeRuns(() => ({}));
      publish();
      return true;
    },
  };
}

function validRuns<R>(byId: Record<string, unknown>, isValid: (run: unknown) => run is R): Record<string, R> {
  return Object.fromEntries(Object.entries(byId).filter(([, run]) => isValid(run))) as Record<string, R>;
}

function isStoredRun(value: unknown): value is StoredRun {
  return isTimerRun(value) && typeof (value as Partial<StoredRun>).config === 'string';
}

function isTimerRun(value: unknown): value is TimerRun {
  if (!isPlainObject(value)) return false;
  const { startedAt, elapsed, alert, alertUpAt } = value;
  return (
    (alertUpAt === undefined || (typeof alertUpAt === 'number' && Number.isFinite(alertUpAt))) &&
    (startedAt === null || (typeof startedAt === 'number' && Number.isFinite(startedAt))) &&
    typeof elapsed === 'number' &&
    Number.isFinite(elapsed) &&
    elapsed >= 0 &&
    (alert === undefined || alert === 'fired' || alert === 'stopped')
  );
}
