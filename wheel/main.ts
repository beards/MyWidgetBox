// View layer: owns the DOM, subscribes to the controller, and calls its actions.
import { applyAppearance, mountAppearancePanel } from '../shared/appearance-dom';
import { applyDisplayMode } from '../shared/display-mode';
import { createBrowserEnv } from '../shared/env';
import { createI18n } from '../shared/i18n';
import { bindStaticText, mountLanguageSwitcher } from '../shared/i18n-dom';
import { readDisplayOptions } from '../shared/share-link';
import { createSoundPlayer } from '../shared/sound';
import {
  MAX_ENTRIES,
  MAX_LABEL_LENGTH,
  MAX_WEIGHT,
  type WheelAppearance,
  type WheelEntry,
  type WheelOutcome,
  type WheelState,
  animationFor,
  createWheelController,
} from './controller';
import { messages } from './messages';
import { createWheelScene } from './scene';

/** How long the result pop-up stays before it goes away by itself. */
const RESULT_MS = 4000;

const env = createBrowserEnv();
const displayOptions = readDisplayOptions(env.url);
applyDisplayMode(displayOptions);
const wheel = createWheelController(env);
const i18n = createI18n(env, messages, { browserLanguage: navigator.language });
bindStaticText(i18n);
mountLanguageSwitcher(i18n, document.querySelector<HTMLElement>('#language')!);
const t = i18n.t;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const stage = $<HTMLButtonElement>('#wheel');
const result = $<HTMLButtonElement>('#result');
const display = $('#display');
const spinButton = $<HTMLButtonElement>('#spin');
const resetButton = $<HTMLButtonElement>('#reset');
const entryList = $<HTMLOListElement>('#entries');
const addEntryButton = $<HTMLButtonElement>('#add-entry');
const historyList = $<HTMLOListElement>('#history');
const presetSelect = $<HTMLSelectElement>('#preset');
const presetName = $<HTMLInputElement>('#preset-name');
const presetNew = $<HTMLButtonElement>('#preset-new');
const presetDelete = $<HTMLButtonElement>('#preset-delete');
const sharedNotice = $('#shared-notice');
const sharedSave = $<HTMLButtonElement>('#shared-save');
const shareDisplay = $<HTMLInputElement>('#share-display');
const shareTransparent = $<HTMLInputElement>('#share-transparent');
const shareCopy = $<HTMLButtonElement>('#share-copy');
const shareStatus = $('#share-status');
const shareUrl = $<HTMLInputElement>('#share-url');
const settingsExport = $<HTMLButtonElement>('#settings-export');
const settingsImport = $<HTMLInputElement>('#settings-import');
const importError = $('#settings-import-error');
const durationInput = $<HTMLInputElement>('#duration');
const durationValue = $<HTMLOutputElement>('#duration-value');
const alwaysFullInput = $<HTMLInputElement>('#always-full');
const removeAfterDrawInput = $<HTMLInputElement>('#remove-after-draw');
const allDrawnNotice = $('#all-drawn');
const soundEnabledInput = $<HTMLInputElement>('#sound-enabled');
const soundVolumeInput = $<HTMLInputElement>('#sound-volume');
const soundUrlInput = $<HTMLInputElement>('#sound-url');

const scene = createWheelScene(stage);
const sound = createSoundPlayer();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
/** The Outcome currently being animated, so each spin starts its animation exactly once. */
let playing: WheelOutcome | null = null;
/** What the editor and the wheel were last rendered from, so they are rebuilt only when it changes. */
let renderedEntries: WheelEntry[] | null = null;
let renderedDrawn: string[] | null = null;
let renderedWheel: WheelEntry[] | null = null;
let resultTimer = 0;

const appearancePanel = mountAppearancePanel<WheelAppearance>($('#appearance'), {
  i18n,
  fields: [
    { key: 'labelColor', label: () => t('labelColor') },
    { key: 'pointerColor', label: () => t('pointerColor') },
  ],
  onChange(appearance) {
    wheel.setAppearance(appearance);
    appearancePanel.update(wheel.getState().appearance);
  },
});

function showResult(outcome: WheelOutcome) {
  result.textContent = outcome.label;
  result.style.backgroundColor = outcome.color;
  result.hidden = false;
  // Restart the pop-in animation.
  result.classList.remove('wheel__result--in');
  void result.offsetWidth;
  result.classList.add('wheel__result--in');
  clearTimeout(resultTimer);
  resultTimer = window.setTimeout(hideResult, RESULT_MS);
}

function hideResult() {
  clearTimeout(resultTimer);
  result.hidden = true;
}

function render(state: WheelState) {
  const { entries, appearance, presets, selectedPresetId, outcome, history, animating, remainingEntries, allDrawn } = state;
  applyAppearance(appearance, { page: document.documentElement, display }, { forceTransparent: displayOptions.transparent });
  scene.setColors({ label: appearance.labelColor, pointer: appearance.pointerColor });
  appearancePanel.update(appearance);

  // Drawn entries are hidden from the wheel (it shows only what can still be drawn) and marked in the editor.
  const drawnIds = state.removeAfterDraw ? state.drawnEntryIds : [];
  if (remainingEntries !== renderedWheel) {
    renderedWheel = remainingEntries;
    scene.setEntries(remainingEntries);
  }
  if (entries !== renderedEntries || drawnIds.join() !== renderedDrawn?.join()) {
    renderedEntries = entries;
    renderedDrawn = drawnIds;
    renderEntries(entries, new Set(drawnIds));
  }
  allDrawnNotice.hidden = !allDrawn;

  presetSelect.replaceChildren(
    ...(selectedPresetId === null ? [new Option(t('sharedPreset'), '', false, true)] : []),
    ...presets.map(({ id, name }) => new Option(name || t('unnamedPreset'), id, false, id === selectedPresetId)),
  );
  sharedNotice.hidden = selectedPresetId !== null;
  const selected = presets.find((preset) => preset.id === selectedPresetId);
  presetName.value = selected?.name ?? '';
  presetName.disabled = !selected;
  presetDelete.disabled = !selected || presets.length === 1 || animating;

  if (animating && outcome && outcome !== playing) {
    playing = outcome;
    hideResult();
    const onTick = () => sound.play('tick', wheel.getState().sound);
    scene.play(outcome.angle, { ...animationFor(state, reducedMotion.matches), onTick }, () => {
      wheel.finishAnimation();
      showResult(outcome);
    });
  }
  if (!outcome) hideResult();
  spinButton.disabled = animating || allDrawn;
  // The controller ignores these mid-spin (the Outcome must match the wheel shown); say so in the UI.
  addEntryButton.disabled = animating || entries.length >= MAX_ENTRIES;
  entryList.inert = animating;
  for (const control of [presetSelect, presetNew, sharedSave, settingsImport, removeAfterDrawInput]) {
    control.disabled = animating;
  }
  durationInput.value = String(state.animationDuration / 1000);
  durationValue.textContent = t('seconds', { seconds: state.animationDuration / 1000 });
  alwaysFullInput.checked = state.alwaysFullAnimation;
  removeAfterDrawInput.checked = state.removeAfterDraw;
  soundEnabledInput.checked = state.sound.enabled;
  soundVolumeInput.value = String(Math.round(state.sound.volume * 100));
  soundVolumeInput.disabled = !state.sound.enabled;
  if (document.activeElement !== soundUrlInput) soundUrlInput.value = state.sound.url;
  shareUrl.value = shareLink();

  // While spinning, the newest entry would give the Outcome away before the wheel stops.
  historyList.replaceChildren(
    ...history.slice(animating ? 1 : 0).map((entry) => {
      const item = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'wheel__swatch';
      swatch.style.backgroundColor = entry.color;
      item.append(swatch, entry.label);
      return item;
    }),
  );
}

function renderEntries(entries: WheelEntry[], drawn: Set<string>) {
  // Chances are over the entries still on the wheel.
  const total = entries.reduce((sum, entry) => sum + (drawn.has(entry.id) ? 0 : entry.weight), 0);
  entryList.replaceChildren(
    ...entries.map((entry, index) => {
      const n = index + 1;
      const item = document.createElement('li');
      const isDrawn = drawn.has(entry.id);
      item.classList.toggle('wheel__entry--drawn', isDrawn);
      const color = input('color', t('entryColor', { n }));
      color.value = entry.color;
      color.addEventListener('change', () => edit(() => wheel.updateEntry(entry.id, { color: color.value })));
      const label = input('text', t('entryLabel', { n }));
      label.maxLength = MAX_LABEL_LENGTH;
      label.value = entry.label;
      label.addEventListener('change', () => edit(() => wheel.updateEntry(entry.id, { label: label.value })));
      const weight = input('number', t('entryWeight', { n }));
      weight.min = '0';
      weight.max = String(MAX_WEIGHT);
      weight.step = 'any';
      weight.value = String(entry.weight);
      weight.addEventListener('change', () => edit(() => wheel.updateEntry(entry.id, { weight: weight.valueAsNumber })));
      const chance = document.createElement('span');
      chance.className = 'wheel__chance';
      chance.textContent = isDrawn ? t('drawn') : t('entryChance', { percent: formatPercent((entry.weight / total) * 100) });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', t('removeEntry', { n }));
      remove.disabled = entries.length === 1;
      remove.addEventListener('click', () => wheel.removeEntry(entry.id));
      item.append(color, label, weight, chance, remove);
      return item;
    }),
  );
}

function input(type: string, ariaLabel: string) {
  const element = document.createElement('input');
  element.type = type;
  element.setAttribute('aria-label', ariaLabel);
  return element;
}

function formatPercent(percent: number) {
  return percent >= 10 ? percent.toFixed(0) : percent.toFixed(1);
}

function shareLink() {
  return wheel.shareLink({
    display: shareDisplay.checked,
    transparent: shareTransparent.checked,
    lang: i18n.getLocale(),
  });
}

/** Runs an edit, then redraws the editor so inputs holding a value the controller rejected snap back. */
function edit(action: () => void) {
  action();
  renderedEntries = null;
  render(wheel.getState());
}

wheel.subscribe(render);
i18n.subscribe(() => {
  renderedEntries = null;
  render(wheel.getState());
});
render(wheel.getState());

stage.addEventListener('click', () => wheel.spin());
result.addEventListener('click', hideResult);
spinButton.addEventListener('click', () => wheel.spin());
resetButton.addEventListener('click', () => wheel.reset());
// Space spins and R resets from anywhere (also in Display mode), except while typing or on a focused control.
document.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof Element && event.target.closest('input, select, textarea, button')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    wheel.spin();
  } else if (event.key === 'r' || event.key === 'R') {
    wheel.reset();
  }
});
addEntryButton.addEventListener('click', () =>
  wheel.addEntry(t('newEntryLabel', { n: wheel.getState().entries.length + 1 })),
);
presetSelect.addEventListener('change', () => wheel.selectPreset(presetSelect.value));
presetName.addEventListener('change', () => {
  const id = wheel.getState().selectedPresetId;
  if (id) wheel.renamePreset(id, presetName.value.trim());
});
presetNew.addEventListener('click', () => wheel.createPreset(t('newPresetName', { n: wheel.getState().presets.length + 1 })));
presetDelete.addEventListener('click', () => {
  const id = wheel.getState().selectedPresetId;
  if (id) wheel.deletePreset(id);
});
sharedSave.addEventListener('click', () => wheel.createPreset(t('sharedPresetName')));
for (const option of [shareDisplay, shareTransparent]) {
  option.addEventListener('change', () => (shareUrl.value = shareLink()));
}
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
durationInput.addEventListener('input', () => wheel.setAnimationDuration(Number(durationInput.value) * 1000));
alwaysFullInput.addEventListener('change', () => wheel.setAlwaysFullAnimation(alwaysFullInput.checked));
removeAfterDrawInput.addEventListener('change', () => wheel.setRemoveAfterDraw(removeAfterDrawInput.checked));
soundEnabledInput.addEventListener('change', () => wheel.setSound({ enabled: soundEnabledInput.checked }));
soundVolumeInput.addEventListener('input', () => wheel.setSound({ volume: Number(soundVolumeInput.value) / 100 }));
// A sample tick once the volume is chosen.
soundVolumeInput.addEventListener('change', () => sound.play('tick', wheel.getState().sound));
soundUrlInput.addEventListener('change', () => {
  wheel.setSound({ url: soundUrlInput.value.trim() });
  // An invalid URL was ignored: show the one still in effect.
  soundUrlInput.value = wheel.getState().sound.url;
});
settingsExport.addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([wheel.exportSettings()], { type: 'application/json' }));
  link.download = 'mywidgetbox-wheel-settings.json';
  link.click();
  URL.revokeObjectURL(link.href);
});
settingsImport.addEventListener('change', async () => {
  const file = settingsImport.files?.[0];
  if (!file) return;
  importError.textContent = wheel.importSettings(await file.text()) ? '' : t('importError');
  settingsImport.value = '';
});
