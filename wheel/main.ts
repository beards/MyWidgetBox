// View layer: owns the DOM, subscribes to the controller, and calls its actions.
import { applyAppearance, mountAppearancePanel, orderAppearanceRows } from '../shared/appearance-dom';
import { applyDisplayMode } from '../shared/display-mode';
import { createBrowserEnv } from '../shared/env';
import { createI18n } from '../shared/i18n';
import { bindStaticText, mountLanguageSwitcher } from '../shared/i18n-dom';
import { mountPanelToggle } from '../shared/panel-toggle';
import { readDisplayOptions } from '../shared/share-link';
import { createSoundPlayer } from '../shared/sound';
import { mountPresetPanel, mountSettingsFilePanel, mountSharePanel, mountSoundInputs } from '../shared/widget-dom';
import {
  LABEL_DIRECTIONS,
  LABEL_SIZE_LIMIT_MAX,
  LABEL_SIZE_LIMIT_MIN,
  MAX_ENTRIES,
  MAX_LABEL_LENGTH,
  MAX_WEIGHT,
  RESULT_TEXT_SIZE_MAX,
  RESULT_TEXT_SIZE_MIN,
  type LabelDirection,
  type WheelAppearance,
  type WheelEntry,
  type WheelOutcome,
  type WheelState,
  animationFor,
  createWheelController,
} from './controller';
import { largestFitting } from './geometry';
import { messages } from './messages';
import { createWheelScene } from './scene';

const env = createBrowserEnv();
const displayOptions = readDisplayOptions(env.url);
applyDisplayMode(displayOptions);
const wheel = createWheelController(env);
const i18n = createI18n(env, messages, { browserLanguage: navigator.language });
bindStaticText(i18n);
mountLanguageSwitcher(i18n, document.querySelector<HTMLElement>('#language')!);
mountPanelToggle(document.querySelector<HTMLButtonElement>('#panel-toggle')!);
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
const durationInput = $<HTMLInputElement>('#duration');
const durationValue = $<HTMLOutputElement>('#duration-value');
const alwaysFullInput = $<HTMLInputElement>('#always-full');
const removeAfterDrawInput = $<HTMLInputElement>('#remove-after-draw');
const resultAutoHideInput = $<HTMLInputElement>('#result-auto-hide');
const resultSecondsRow = $('#result-seconds-row');
const resultSecondsInput = $<HTMLInputElement>('#result-seconds');
const resultSecondsValue = $<HTMLOutputElement>('#result-seconds-value');
const allDrawnNotice = $('#all-drawn');

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
    { key: 'labelColor', label: () => t('labelColor'), quickColors: true },
    { key: 'pointerColor', label: () => t('pointerColor') },
  ],
  // Entry text is sized to fit its sector and the result pop-up to the wheel (resultTextSize).
  fontSize: false,
  // Every text on the wheel follows the wheel's own text color instead.
  textColor: false,
  onChange(appearance) {
    wheel.setAppearance(appearance);
    appearancePanel.update(wheel.getState().appearance);
  },
});
const labelOptions = mountLabelOptions($('#appearance'));
// The text on the wheel first, then the pointer and the result pop-up, then the background.
orderAppearanceRows($('#appearance'), [
  'fontFamily',
  'labelColor',
  'labelDirection',
  'limitLabelSize',
  'maxLabelSize',
  'pointerColor',
  'resultTextSize',
  'background',
  'backgroundColor',
  'imageUrl',
]);
const presetPanel = mountPresetPanel(wheel, i18n);
const sharePanel = mountSharePanel(i18n, (options) => wheel.shareLink(options));
const settingsFilePanel = mountSettingsFilePanel(i18n, {
  fileName: 'mywidgetbox-wheel-settings.json',
  exportSettings: () => wheel.exportSettings(),
  importSettings: (text) => wheel.importSettings(text),
  restoreDefaults: () => wheel.restoreDefaults(),
});
const soundInputs = mountSoundInputs(wheel, sound, 'tick');

function showResult(outcome: WheelOutcome) {
  result.textContent = outcome.label;
  result.style.backgroundColor = outcome.color;
  result.style.color = wheel.getState().appearance.labelColor;
  result.hidden = false;
  // Restart the pop-in animation.
  result.classList.remove('wheel__result--in');
  void result.offsetWidth;
  result.classList.add('wheel__result--in');
  fitResult();
  clearTimeout(resultTimer);
  const { autoHide, seconds } = wheel.getState().result;
  if (autoHide) resultTimer = window.setTimeout(hideResult, seconds * 1000);
}

/**
 * Sizes the result pop-up text to its share of the wheel diameter, smaller when the pop-up
 * would not fit within the wheel's size (wider or taller than the wheel).
 */
function fitResult() {
  if (result.hidden) return;
  const diameter = scene.diameter();
  result.style.maxWidth = `${diameter}px`;
  const size = largestFitting((diameter * wheel.getState().appearance.resultTextSize) / 100, (candidate) => {
    result.style.fontSize = `${candidate}px`;
    return result.offsetHeight <= diameter && result.scrollWidth <= result.clientWidth;
  });
  result.style.fontSize = `${size}px`;
}

function hideResult() {
  clearTimeout(resultTimer);
  result.hidden = true;
}

function render(state: WheelState) {
  const { entries, appearance, outcome, history, animating, remainingEntries, allDrawn } = state;
  applyAppearance(appearance, { page: document.documentElement, display }, { forceTransparent: displayOptions.transparent });
  scene.setColors({ label: appearance.labelColor, pointer: appearance.pointerColor });
  result.style.color = appearance.labelColor;
  appearancePanel.update(appearance);
  labelOptions.update(appearance);
  // Font and size changes apply to a pop-up already shown.
  fitResult();

  // Drawn entries are hidden from the wheel (it shows only what can still be drawn) and marked in the editor.
  const drawnIds = state.removeAfterDraw ? state.drawnEntryIds : [];
  if (remainingEntries !== renderedWheel) {
    renderedWheel = remainingEntries;
    scene.setEntries(remainingEntries);
  }
  // After the entries, so a new wheel is laid out once with the right layout (an unchanged layout does nothing).
  scene.setLabelLayout({
    direction: appearance.labelDirection,
    sizeLimit: appearance.limitLabelSize ? appearance.maxLabelSize : null,
  });
  if (entries !== renderedEntries || drawnIds.join() !== renderedDrawn?.join()) {
    renderedEntries = entries;
    renderedDrawn = drawnIds;
    renderEntries(entries, new Set(drawnIds));
  }
  allDrawnNotice.hidden = !allDrawn;


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
  presetPanel.update(state, { locked: animating });
  settingsFilePanel.update({ locked: animating });
  removeAfterDrawInput.disabled = animating;
  durationInput.value = String(state.animationDuration / 1000);
  durationValue.textContent = t('seconds', { seconds: state.animationDuration / 1000 });
  alwaysFullInput.checked = state.alwaysFullAnimation;
  removeAfterDrawInput.checked = state.removeAfterDraw;
  resultAutoHideInput.checked = state.result.autoHide;
  resultSecondsRow.hidden = !state.result.autoHide;
  resultSecondsInput.value = String(state.result.seconds);
  resultSecondsValue.textContent = t('seconds', { seconds: state.result.seconds });
  soundInputs.update(state.sound);
  sharePanel.refresh();

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
new ResizeObserver(fitResult).observe(stage);
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
durationInput.addEventListener('input', () => wheel.setAnimationDuration(Number(durationInput.value) * 1000));
alwaysFullInput.addEventListener('change', () => wheel.setAlwaysFullAnimation(alwaysFullInput.checked));
removeAfterDrawInput.addEventListener('change', () => wheel.setRemoveAfterDraw(removeAfterDrawInput.checked));
resultAutoHideInput.addEventListener('change', () => wheel.setResult({ autoHide: resultAutoHideInput.checked }));
resultSecondsInput.addEventListener('input', () => wheel.setResult({ seconds: Number(resultSecondsInput.value) }));

/**
 * The entry text options, added to the appearance panel: the direction of its lines, and its size
 * limit (a checkbox, unchecked: text grows as far as its sector allows; and a slider for the
 * largest size, with its value shown beside it).
 */
function mountLabelOptions(container: HTMLElement) {
  const change = (changes: Partial<WheelAppearance>) => wheel.setAppearance({ ...wheel.getState().appearance, ...changes });

  const directionLabel = document.createElement('label');
  directionLabel.dataset.appearanceRow = 'labelDirection';
  const directionText = document.createElement('span');
  const direction = document.createElement('select');
  const directionOptions = LABEL_DIRECTIONS.map((value) => {
    const option = document.createElement('option');
    option.value = value;
    return option;
  });
  direction.append(...directionOptions);
  direction.addEventListener('change', () => change({ labelDirection: direction.value as LabelDirection }));
  directionLabel.append(directionText, direction);

  const toggleLabel = document.createElement('label');
  toggleLabel.dataset.appearanceRow = 'limitLabelSize';
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  const toggleText = document.createElement('span');
  toggle.addEventListener('change', () => change({ limitLabelSize: toggle.checked }));
  toggleLabel.append(toggle, toggleText);

  const sliderLabel = document.createElement('label');
  sliderLabel.dataset.appearanceRow = 'maxLabelSize';
  const sliderText = document.createElement('span');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(LABEL_SIZE_LIMIT_MIN);
  slider.max = String(LABEL_SIZE_LIMIT_MAX);
  slider.step = '1';
  const value = document.createElement('output');
  slider.addEventListener('input', () => change({ maxLabelSize: Number(slider.value) }));
  sliderLabel.append(sliderText, slider, value);

  const resultSizeLabel = document.createElement('label');
  resultSizeLabel.dataset.appearanceRow = 'resultTextSize';
  const resultSizeText = document.createElement('span');
  const resultSize = document.createElement('input');
  resultSize.type = 'range';
  resultSize.min = String(RESULT_TEXT_SIZE_MIN);
  resultSize.max = String(RESULT_TEXT_SIZE_MAX);
  resultSize.step = '1';
  const resultSizeValue = document.createElement('output');
  resultSize.addEventListener('input', () => change({ resultTextSize: Number(resultSize.value) }));
  resultSizeLabel.append(resultSizeText, resultSize, resultSizeValue);

  const relabel = () => {
    directionText.textContent = t('labelDirection');
    directionOptions[0]!.textContent = t('labelDirectionAcross');
    directionOptions[1]!.textContent = t('labelDirectionAlong');
    toggleText.textContent = t('limitLabelSize');
    sliderText.textContent = t('maxLabelSize');
    resultSizeText.textContent = t('resultTextSize');
  };
  relabel();
  i18n.subscribe(relabel);
  container.append(directionLabel, toggleLabel, sliderLabel, resultSizeLabel);

  return {
    update({ labelDirection, limitLabelSize, maxLabelSize, resultTextSize }: WheelAppearance) {
      if (document.activeElement !== resultSize) resultSize.value = String(resultTextSize);
      resultSizeValue.textContent = `${resultTextSize}%`;
      direction.value = labelDirection;
      toggle.checked = limitLabelSize;
      if (document.activeElement !== slider) slider.value = String(maxLabelSize);
      value.textContent = String(maxLabelSize);
      sliderLabel.hidden = !limitLabelSize;
    },
  };
}
