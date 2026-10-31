// View layer: owns the DOM, subscribes to the controller, and calls its actions.
import type { Appearance } from '../shared/appearance';
import { applyAppearance, mountAppearancePanel } from '../shared/appearance-dom';
import { applyDisplayMode } from '../shared/display-mode';
import { createBrowserEnv } from '../shared/env';
import { createI18n } from '../shared/i18n';
import { bindStaticText, mountLanguageSwitcher } from '../shared/i18n-dom';
import { readDisplayOptions } from '../shared/share-link';
import { createSoundPlayer } from '../shared/sound';
import { createWakeLock } from '../shared/wake-lock';
import {
  MAX_DURATION,
  TIMER_MODES,
  type TimerMode,
  type TimerState,
  type TimerView,
  createTimerController,
  formatTimer,
  readAlert,
  readTimer,
  visibleTimers,
} from './controller';
import { messages } from './messages';

const env = createBrowserEnv();
const displayOptions = readDisplayOptions(env.url);
applyDisplayMode(displayOptions);
const timer = createTimerController(env);
const i18n = createI18n(env, messages, { browserLanguage: navigator.language });
bindStaticText(i18n);
mountLanguageSwitcher(i18n, document.querySelector<HTMLElement>('#language')!);
const t = i18n.t;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const list = $('#timers');
const presetSelect = $<HTMLSelectElement>('#preset');
const presetName = $<HTMLInputElement>('#preset-name');
const presetNew = $<HTMLButtonElement>('#preset-new');
const presetDelete = $<HTMLButtonElement>('#preset-delete');
const sharedNotice = $('#shared-notice');
const sharedSave = $<HTMLButtonElement>('#shared-save');
const shareDisplay = $<HTMLInputElement>('#share-display');
const shareTransparent = $<HTMLInputElement>('#share-transparent');
const shareTimer = $<HTMLSelectElement>('#share-timer');
const timerAdd = $<HTMLButtonElement>('#timer-add');
const showFraction = $<HTMLInputElement>('#show-fraction');
const shareCopy = $<HTMLButtonElement>('#share-copy');
const shareStatus = $('#share-status');
const shareUrl = $<HTMLInputElement>('#share-url');
const settingsExport = $<HTMLButtonElement>('#settings-export');
const settingsImport = $<HTMLInputElement>('#settings-import');
const importError = $('#settings-import-error');
const alertSoundSeconds = $<HTMLInputElement>('#alert-sound-seconds');
const alertEffectSeconds = $<HTMLInputElement>('#alert-effect-seconds');
const soundEnabledInput = $<HTMLInputElement>('#sound-enabled');
const soundVolumeInput = $<HTMLInputElement>('#sound-volume');
const soundUrlInput = $<HTMLInputElement>('#sound-url');

const sound = createSoundPlayer();
const wakeLock = createWakeLock();
/** Stop functions of the alert sounds playing now, by timer id. */
const alertSounds = new Map<string, () => void>();

const appearancePanel = mountAppearancePanel<Appearance>($('#appearance'), {
  i18n,
  onChange(appearance) {
    timer.setAppearance(appearance);
    appearancePanel.update(timer.getState().appearance);
  },
});

const MODE_LABELS = { countdown: 'modeCountdown', targetTime: 'modeTargetTime', stopwatch: 'modeStopwatch' } as const;

/** A timer's name, or a numbered fallback by its position (1-based). */
function timerLabel(view: TimerView, index: number) {
  return view.name || t('numberedTimer', { n: index + 1 });
}

/** The DOM of one timer; built once per timer id and updated in place. */
interface TimerCard {
  root: HTMLElement;
  /** Refreshes the clock-driven parts (value, status, start/pause label). */
  tick(timer: TimerView, now: number): void;
  /** Refreshes everything from the latest state. */
  update(timer: TimerView, now: number): void;
}

function createCard(id: string): TimerCard {
  const root = document.createElement('section');
  root.className = 'timer__card';
  const heading = document.createElement('h2');
  heading.className = 'timer__name';
  const value = document.createElement('p');
  value.className = 'timer__value';
  const status = document.createElement('p');
  status.className = 'timer__status';
  status.setAttribute('aria-live', 'polite');

  const actions = document.createElement('div');
  actions.className = 'timer__actions';
  actions.dataset.controls = '';
  const toggle = button(() => {
    const view = timer.getState().timers.find((entry) => entry.id === id);
    if (!view) return;
    if (readTimer(view, env.now()).status === 'running') timer.pause(id);
    else timer.start(id);
  });
  toggle.classList.add('timer__toggle');
  const reset = button(() => timer.reset(id));
  const stop = button(() => {
    alertSounds.get(id)?.();
    alertSounds.delete(id);
    timer.stopAlert(id);
  });
  actions.append(toggle, reset, stop);

  const settings = document.createElement('div');
  settings.className = 'timer__settings';
  settings.dataset.controls = '';
  const name = document.createElement('input');
  name.type = 'text';
  name.addEventListener('change', () => timer.renameTimer(id, name.value.trim()));
  const nameLabel = labelled(name);
  const mode = document.createElement('select');
  mode.addEventListener('change', () => timer.setMode(id, mode.value as TimerMode));
  const modeLabel = labelled(mode);
  const target = document.createElement('input');
  target.type = 'time';
  target.addEventListener('change', () => {
    timer.setTarget(id, target.value);
    // Snap back if the controller rejected the value (e.g. cleared).
    target.value = timer.getState().timers.find((entry) => entry.id === id)!.target;
  });
  const targetLabel = labelled(target);
  targetLabel.wrapper.classList.add('timer__target');
  const remove = button(() => timer.removeTimer(id));
  const durationRow = document.createElement('div');
  durationRow.className = 'timer__duration';
  const durationLabel = document.createElement('span');
  const parts = (['hours', 'minutes', 'seconds'] as const).map((key) => {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = key === 'hours' ? String(Math.floor(MAX_DURATION / 3_600_000)) : '59';
    input.step = '1';
    input.addEventListener('change', () => {
      const [h, m, s] = parts.map(({ input: part }) => Number(part.value) || 0);
      const ms = ((h! * 60 + m!) * 60 + s!) * 1000;
      // A zero total is a half-typed duration (e.g. minutes cleared before seconds set): leave it as typed.
      if (ms === 0) return;
      timer.setDuration(id, ms);
      // Snap the inputs back if the controller rejected the value.
      card.update(timer.getState().timers.find((entry) => entry.id === id)!, env.now());
    });
    return { key, input };
  });
  durationRow.append(durationLabel, ...parts.map(({ input }) => input));
  settings.append(nameLabel.wrapper, modeLabel.wrapper, durationRow, targetLabel.wrapper, remove);

  root.append(heading, value, status, actions, settings);

  let shownValue = '';
  const card: TimerCard = {
    root,
    tick(view, now) {
      const reading = readTimer(view, now);
      const text = formatTimer(view, now, { showFraction: timer.getState().showFraction });
      if (text !== shownValue) value.textContent = shownValue = text;
      root.dataset.status = reading.status;
      status.textContent = reading.status === 'timeUp' ? t('timeUp') : '';
      toggle.textContent = t(reading.status === 'running' ? 'pause' : reading.status === 'paused' ? 'resume' : 'start');
      toggle.disabled = reading.status === 'timeUp';
      const { effect } = readAlert(view, now, timer.getState().alert);
      if (effect) root.dataset.alert = '';
      else delete root.dataset.alert;
      stop.hidden = !effect && !alertSounds.has(id);
    },
    update(view, now) {
      const { timers } = timer.getState();
      heading.textContent = view.name;
      heading.hidden = view.name === '';
      nameLabel.text.textContent = t('timerName');
      if (document.activeElement !== name) name.value = view.name;
      name.placeholder = timerLabel(view, timers.indexOf(view));
      // targetTime timers follow the clock: nothing to start, pause or reset.
      toggle.hidden = reset.hidden = view.mode === 'targetTime';
      targetLabel.text.textContent = t('targetTime');
      targetLabel.wrapper.hidden = view.mode !== 'targetTime';
      if (document.activeElement !== target) target.value = view.target;
      remove.textContent = t('removeTimer');
      remove.hidden = timers.length <= 1;
      reset.textContent = t('reset');
      stop.textContent = t('stopAlert');
      modeLabel.text.textContent = t('mode');
      mode.replaceChildren(...TIMER_MODES.map((key) => new Option(t(MODE_LABELS[key]), key, false, key === view.mode)));
      durationLabel.textContent = t('duration');
      durationRow.hidden = view.mode !== 'countdown';
      const total = view.duration / 1000;
      const values = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
      parts.forEach(({ key, input }, index) => {
        input.value = String(values[index]);
        input.setAttribute('aria-label', t(key));
      });
      card.tick(view, now);
    },
  };
  return card;
}

function button(onClick: () => void) {
  const element = document.createElement('button');
  element.type = 'button';
  element.addEventListener('click', onClick);
  return element;
}

function labelled(input: HTMLElement) {
  const wrapper = document.createElement('label');
  const text = document.createElement('span');
  wrapper.append(text, input);
  return { wrapper, text };
}

const cards = new Map<string, TimerCard>();

function render(state: TimerState) {
  const { appearance, presets, selectedPresetId } = state;
  // Display mode can be limited to one timer (`?timer=<id>`); the others get no card.
  const timers = visibleTimers(state.timers, env.url);
  applyAppearance(appearance, { page: document.documentElement, display: list }, { forceTransparent: displayOptions.transparent });
  appearancePanel.update(appearance);

  // One card per timer, in Settings order; cards of removed timers are dropped.
  const now = env.now();
  for (const id of cards.keys()) if (!timers.some((view) => view.id === id)) cards.delete(id);
  const roots = timers.map((view) => {
    const card = cards.get(view.id) ?? createCard(view.id);
    cards.set(view.id, card);
    card.update(view, now);
    return card.root;
  });
  // Moving nodes would drop focus from the control being used, so only re-attach on change.
  if (roots.some((root, index) => list.children[index] !== root) || list.children.length !== roots.length) {
    list.replaceChildren(...roots);
  }

  presetSelect.replaceChildren(
    ...(selectedPresetId === null ? [new Option(t('sharedPreset'), '', false, true)] : []),
    ...presets.map(({ id, name }) => new Option(name || t('unnamedPreset'), id, false, id === selectedPresetId)),
  );
  sharedNotice.hidden = selectedPresetId !== null;
  const selected = presets.find((preset) => preset.id === selectedPresetId);
  presetName.value = selected?.name ?? '';
  presetName.disabled = !selected;
  presetDelete.disabled = !selected || presets.length === 1;
  alertSoundSeconds.value = String(state.alert.soundSeconds);
  alertEffectSeconds.value = String(state.alert.effectSeconds);
  soundEnabledInput.checked = state.sound.enabled;
  soundVolumeInput.value = String(Math.round(state.sound.volume * 100));
  soundVolumeInput.disabled = !state.sound.enabled;
  if (document.activeElement !== soundUrlInput) soundUrlInput.value = state.sound.url;
  showFraction.checked = state.showFraction;
  const sharedTimer = state.timers.some((view) => view.id === shareTimer.value) ? shareTimer.value : '';
  shareTimer.replaceChildren(
    new Option(t('shareAllTimers'), '', false, sharedTimer === ''),
    ...state.timers.map((view, index) => new Option(timerLabel(view, index), view.id, false, view.id === sharedTimer)),
  );
  shareTimer.disabled = !shareDisplay.checked;
  shareUrl.value = shareLink();
}

// The shown value is computed from the clock on every frame, so throttled or hidden tabs
// never drift; only the text that changed is touched.
function frame() {
  checkAlerts();
  const now = env.now();
  for (const view of timer.getState().timers) cards.get(view.id)?.tick(view, now);
  requestAnimationFrame(frame);
}

/** Starts the sound of new time ups and stops sounds whose timer was reset or stopped. */
function checkAlerts() {
  const shown = visibleTimers(timer.getState().timers, env.url);
  for (const { id, soundMs } of timer.takeDueAlerts()) {
    // A page showing one timer (an OBS source) only sounds for that timer.
    if (!shown.some((view) => view.id === id)) continue;
    alertSounds.get(id)?.();
    const stop = sound.repeat('alert', timer.getState().sound, { interval: 1000, duration: soundMs });
    alertSounds.set(id, stop);
    setTimeout(() => {
      if (alertSounds.get(id) === stop) alertSounds.delete(id);
    }, soundMs);
  }
  const { timers } = timer.getState();
  for (const [id, stop] of alertSounds) {
    const view = timers.find((entry) => entry.id === id);
    if (!view || view.run.alert !== 'fired' || readTimer(view, env.now()).status !== 'timeUp') {
      stop();
      alertSounds.delete(id);
    }
  }
  wakeLock.set(timers.some((view) => readTimer(view, env.now()).status === 'running'));
}

function shareLink() {
  return timer.shareLink({
    display: shareDisplay.checked,
    transparent: shareTransparent.checked,
    lang: i18n.getLocale(),
    timer: shareDisplay.checked && shareTimer.value ? shareTimer.value : undefined,
  });
}

timer.subscribe(render);
i18n.subscribe(() => render(timer.getState()));
render(timer.getState());
requestAnimationFrame(frame);
// rAF does not run in hidden tabs; this keeps time-up alerts sounding there (throttled to ~1 s).
setInterval(checkAlerts, 250);

presetSelect.addEventListener('change', () => timer.selectPreset(presetSelect.value));
presetName.addEventListener('change', () => {
  const id = timer.getState().selectedPresetId;
  if (id) timer.renamePreset(id, presetName.value.trim());
});
presetNew.addEventListener('click', () => timer.createPreset(t('newPresetName', { n: timer.getState().presets.length + 1 })));
presetDelete.addEventListener('click', () => {
  const id = timer.getState().selectedPresetId;
  if (id) timer.deletePreset(id);
});
sharedSave.addEventListener('click', () => timer.createPreset(t('sharedPresetName')));
for (const option of [shareDisplay, shareTransparent, shareTimer]) {
  option.addEventListener('change', () => {
    shareTimer.disabled = !shareDisplay.checked;
    shareUrl.value = shareLink();
  });
}
timerAdd.addEventListener('click', () => timer.addTimer());
showFraction.addEventListener('change', () => timer.setShowFraction(showFraction.checked));
shareCopy.addEventListener('click', async () => {
  const link = shareLink();
  shareUrl.value = link;
  try {
    await navigator.clipboard.writeText(link);
    shareStatus.textContent = t('copied');
  } catch {
    // Clipboard refused (insecure context, permission): let the user copy by hand.
    shareStatus.textContent = t('copyFailed');
    shareUrl.select();
  }
});
shareUrl.addEventListener('focus', () => shareUrl.select());
alertSoundSeconds.addEventListener('change', () => {
  timer.setAlert({ soundSeconds: Number(alertSoundSeconds.value) });
  alertSoundSeconds.value = String(timer.getState().alert.soundSeconds);
});
alertEffectSeconds.addEventListener('change', () => {
  timer.setAlert({ effectSeconds: Number(alertEffectSeconds.value) });
  alertEffectSeconds.value = String(timer.getState().alert.effectSeconds);
});
soundEnabledInput.addEventListener('change', () => timer.setSound({ enabled: soundEnabledInput.checked }));
soundVolumeInput.addEventListener('input', () => timer.setSound({ volume: Number(soundVolumeInput.value) / 100 }));
// Preview the volume once the slider is released.
soundVolumeInput.addEventListener('change', () => sound.play('alert', timer.getState().sound));
soundUrlInput.addEventListener('change', () => {
  timer.setSound({ url: soundUrlInput.value.trim() });
  soundUrlInput.value = timer.getState().sound.url;
});
settingsExport.addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([timer.exportSettings()], { type: 'application/json' }));
  link.download = 'mywidgetbox-timer-settings.json';
  link.click();
  URL.revokeObjectURL(link.href);
});
settingsImport.addEventListener('change', async () => {
  const file = settingsImport.files?.[0];
  if (!file) return;
  importError.textContent = timer.importSettings(await file.text()) ? '' : t('importError');
  settingsImport.value = '';
});
