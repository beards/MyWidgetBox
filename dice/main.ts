// View layer: owns the DOM, subscribes to the controller, and calls its actions.
import { applyAppearance, mountAppearancePanel } from '../shared/appearance-dom';
import { createBrowserEnv } from '../shared/env';
import { createI18n } from '../shared/i18n';
import { bindStaticText, mountLanguageSwitcher } from '../shared/i18n-dom';
import { applyDisplayMode } from '../shared/display-mode';
import { readDisplayOptions } from '../shared/share-link';
import { createSoundPlayer } from '../shared/sound';
import { mountPresetPanel, mountSettingsFilePanel, mountSharePanel, mountSoundInputs } from '../shared/widget-dom';
import {
  DIE_SIDES,
  MAX_DICE_PER_KIND,
  DICE_BACKDROPS,
  DICE_SIZE_RANGE,
  RESULT_TEXT_SIZE_RANGE,
  type DiceAppearance,
  type DiceOutcome,
  type DiceSet,
  type DiceState,
  type DieSides,
  type SpecialPips,
  type DiceBackdrop,
  TABLE_BOUNCE_MAX,
  animationFor,
  createDiceController,
  formatOutcome,
  outcomeTerms,
} from './controller';
import { clearFelt, paintFelt } from './felt';
import { messages } from './messages';
import { createFallbackDiceScene } from './fallback-scene';
import { type DiceScene, createDiceScene } from './scene';
import { listenForShakes } from './shake';

const env = createBrowserEnv();
const displayOptions = readDisplayOptions(env.url);
applyDisplayMode(displayOptions);
const dice = createDiceController(env);
const i18n = createI18n(env, messages, { browserLanguage: navigator.language });
bindStaticText(i18n);
mountLanguageSwitcher(i18n, document.querySelector<HTMLElement>('#language')!);
const t = i18n.t;
const dieLabel = (sides: number) => t('dieLabel', { sides });
const BACKDROP_LABELS = {
  solid: 'backgroundSolid',
  transparent: 'backgroundTransparent',
  image: 'backgroundImage',
  felt: 'finishFelt',
} as const;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const die = $<HTMLButtonElement>('#die');
const breakdown = $('#breakdown');
/** The Outcome the result text shows (null: none), so it is rebuilt, and pops in, only when it changes. */
let shownResult: DiceOutcome | null = null;
const rollButton = $<HTMLButtonElement>('#roll');
const groupList = $<HTMLUListElement>('#groups');
const addSides = $<HTMLSelectElement>('#add-sides');
const addButton = $<HTMLButtonElement>('#add-die');
const modifierInput = $<HTMLInputElement>('#modifier');
const historyList = $<HTMLOListElement>('#history');
const resetButton = $<HTMLButtonElement>('#reset');
const skipInput = $<HTMLInputElement>('#skip-animation');
const alwaysFullInput = $<HTMLInputElement>('#always-full');
const shakeInput = $<HTMLInputElement>('#shake-to-roll');
const shakeStatus = $('#shake-status');

const scene = createSceneOrFallback(die);
const sound = createSoundPlayer();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
/** The Outcome currently being animated, so each roll starts its animation exactly once. */
let playing: DiceOutcome | null = null;
const appearancePanel = mountAppearancePanel<DiceAppearance>(document.querySelector<HTMLElement>('#appearance')!, {
  i18n,
  // The dice offer their own background choice (mountBackdrop), which includes the felt.
  background: false,
  fontSizeRange: RESULT_TEXT_SIZE_RANGE,
  textColorQuickColors: true,
  fields: [
    { key: 'dieColor', label: () => t('dieColor') },
    { key: 'pipColor', label: () => t('pipColor') },
  ],
  onChange(appearance) {
    dice.setAppearance(appearance);
    appearancePanel.update(dice.getState().appearance);
  },
});
const backdropInputs = mountBackdrop(document.querySelector<HTMLElement>('#appearance h2')!);
const tableBounce = mountTableBounce(document.querySelector<HTMLElement>('#appearance')!);
const showResultText = mountShowResultText(document.querySelector<HTMLElement>('#appearance')!);
const diceSize = mountDiceSize(document.querySelector<HTMLElement>('#appearance')!);
const specialPipsInputs = mountSpecialPips(document.querySelector<HTMLElement>('#appearance')!);
orderAppearanceRows(document.querySelector<HTMLElement>('#appearance')!);
const presetPanel = mountPresetPanel(dice, i18n);
const sharePanel = mountSharePanel(i18n, (options) => dice.shareLink(options));
mountSettingsFilePanel(i18n, {
  fileName: 'mywidgetbox-dice-settings.json',
  exportSettings: () => dice.exportSettings(),
  importSettings: (text) => dice.importSettings(text),
  restoreDefaults: () => dice.restoreDefaults(),
});
const soundInputs = mountSoundInputs(dice, sound, 'diceHit');

function renderAddSides() {
  const selected = addSides.value || '20';
  addSides.replaceChildren(
    ...DIE_SIDES.map((sides) => new Option(dieLabel(sides), String(sides), false, String(sides) === selected)),
  );
}

function render(state: DiceState) {
  const { diceSet, appearance, outcome, history, animating } = state;
  // The text settings apply to the result text; the dice size is the scene's own (no CSS zoom, which blurs the 3D stage).
  applyAppearance(appearance, { page: document.documentElement, display: breakdown }, { forceTransparent: displayOptions.transparent });
  scene.setDiceSize(appearance.diceSize);
  breakdown.hidden = !appearance.showResultText;
  breakdown.style.setProperty('--result-outline', resultOutline(appearance.textColor));
  showResultText.checked = appearance.showResultText;
  const { specialPips } = appearance;
  scene.setColors({
    body: appearance.dieColor,
    label: appearance.pipColor,
    specialPips: specialPips.enabled ? { values: specialPips.values, color: specialPips.color } : null,
  });
  // With a transparent background only the dice and their shadows show (e.g. over a stream in OBS).
  const transparent = displayOptions.transparent || appearance.background.kind === 'transparent';
  // The felt fills the whole page, so the dice area has no visible edge; the dice cast shadows on any background.
  if (!transparent && appearance.background.kind === 'felt') paintFelt(document.documentElement, appearance.background.color);
  else clearFelt(document.documentElement);
  appearancePanel.update(appearance);
  backdropInputs.update(appearance);
  if (document.activeElement !== tableBounce.input) tableBounce.input.value = String(appearance.tableBounce);
  tableBounce.value.textContent = formatBounce(appearance.tableBounce);
  specialPipsInputs.update(appearance.specialPips);
  if (document.activeElement !== diceSize.input) diceSize.input.value = String(appearance.diceSize);
  diceSize.value.textContent = formatDiceSize(appearance.diceSize);

  presetPanel.update(state);

  // Every new Outcome is played once; a skipped animation is already finished in the controller.
  if (outcome && outcome !== playing) {
    playing = outcome;
    scene.play(
      outcome.rolls,
      { animation: animationFor(state, reducedMotion.matches), bounce: appearance.tableBounce },
      () => dice.finishAnimation(),
      // Each impact is as loud as it was hard, relative to the volume setting.
      (volume) => {
        const settings = dice.getState().sound;
        sound.play('diceHit', { ...settings, volume: settings.volume * volume });
      },
    );
  } else if (!animating) {
    scene.show(outcome ? outcome.rolls : restingDice(diceSet));
  }
  // The Outcome is revealed once the dice have landed.
  showResult(outcome && !animating ? outcome : null);
  modifierInput.value = String(diceSet.modifier);
  skipInput.checked = state.skipAnimation;
  alwaysFullInput.checked = state.alwaysFullAnimation;
  soundInputs.update(state.sound);
  shakeInput.checked = state.shakeToRoll;
  // Follows the Settings in effect, so a Preset switch or an import turns listening on or off.
  syncShakes(state.shakeToRoll);

  groupList.replaceChildren(
    ...diceSet.groups.map(({ sides, count }) => {
      const label = dieLabel(sides);
      const item = document.createElement('li');
      const countInput = document.createElement('input');
      countInput.type = 'number';
      countInput.min = '1';
      countInput.max = String(MAX_DICE_PER_KIND);
      countInput.value = String(count);
      countInput.setAttribute('aria-label', t('count', { label }));
      countInput.addEventListener('change', () => edit(() => dice.setCount(sides, Number(countInput.value))));
      const name = document.createElement('span');
      name.textContent = label;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', t('removeDie', { label }));
      remove.disabled = diceSet.groups.length === 1;
      remove.addEventListener('click', () => dice.removeDie(sides));
      item.append(countInput, name, remove);
      return item;
    }),
  );

  sharePanel.refresh();

  // While animating, the newest entry would give the Outcome away before the dice land.
  historyList.replaceChildren(
    ...history.slice(animating ? 1 : 0).map((entry) => {
      const item = document.createElement('li');
      item.textContent = formatOutcome(entry);
      return item;
    }),
  );
}

/** The result text: the total on the first line, and the sum making it up below it in smaller type. */
function showResult(outcome: DiceOutcome | null) {
  if (outcome === shownResult) return;
  shownResult = outcome;
  if (!outcome) {
    breakdown.replaceChildren();
    return;
  }
  const total = document.createElement('span');
  total.className = 'dice__total';
  total.textContent = String(outcome.total);
  const terms = outcomeTerms(outcome);
  const detail = document.createElement('span');
  detail.className = 'dice__terms';
  detail.textContent = terms ? `( ${terms} )` : '';
  breakdown.replaceChildren(total, ...(terms ? [detail] : []));
  // Pops in once per Outcome (the spans are only rebuilt when the Outcome changes).
  breakdown.classList.remove('dice__breakdown--in');
  void breakdown.offsetWidth;
  breakdown.classList.add('dice__breakdown--in');
}

/**
 * The outline around the result text: dark around light text, light around dark text, so it reads over
 * the dice and any background.
 */
function resultOutline(textColor: string): string {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(textColor.slice(start, start + 2), 16) / 255);
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.5 ? 'rgb(0 0 0 / 0.8)' : 'rgb(255 255 255 / 0.9)';
}

/** The "show the result text" checkbox, first of the result text items. */
function mountShowResultText(container: HTMLElement): HTMLInputElement {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  const text = document.createElement('span');
  const relabel = () => (text.textContent = t('showResultText'));
  relabel();
  i18n.subscribe(relabel);
  input.addEventListener('change', () =>
    dice.setAppearance({ ...dice.getState().appearance, showResultText: input.checked }),
  );
  label.append(input, text);
  label.dataset.appearanceRow = 'showResultText';
  container.append(label);
  return input;
}

/** The dice size slider (DICE_SIZE_RANGE), shown with its value as a percentage. */
function mountDiceSize(container: HTMLElement): { input: HTMLInputElement; value: HTMLOutputElement } {
  const label = document.createElement('label');
  const text = document.createElement('span');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(DICE_SIZE_RANGE.min);
  input.max = String(DICE_SIZE_RANGE.max);
  input.step = '0.05';
  const value = document.createElement('output');
  const relabel = () => (text.textContent = t('diceSize'));
  relabel();
  i18n.subscribe(relabel);
  input.addEventListener('input', () => dice.setAppearance({ ...dice.getState().appearance, diceSize: Number(input.value) }));
  label.append(text, input, value);
  label.dataset.appearanceRow = 'diceSize';
  container.append(label);
  return { input, value };
}

function formatDiceSize(size: number): string {
  return `${Math.round(size * 100)}%`;
}

/** The table bounce slider (0..TABLE_BOUNCE_MAX), added to the appearance panel after the table finish. */
/** The special pips choice: whether to color some d6 faces' pips, which faces (1..6), and in what color. */
function mountSpecialPips(container: HTMLElement): { update(specialPips: SpecialPips): void } {
  const enabledLabel = document.createElement('label');
  const enabled = document.createElement('input');
  enabled.type = 'checkbox';
  const enabledText = document.createElement('span');
  enabledLabel.append(enabled, enabledText);

  const facesRow = document.createElement('div');
  facesRow.className = 'dice__special-pips';
  const facesText = document.createElement('span');
  const faces = [1, 2, 3, 4, 5, 6].map((value) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = String(value);
    label.append(input, String(value));
    return { label, input };
  });
  facesRow.append(facesText, ...faces.map(({ label }) => label));

  const colorLabel = document.createElement('label');
  const colorText = document.createElement('span');
  const color = document.createElement('input');
  color.type = 'color';
  colorLabel.append(colorText, color);

  const relabel = () => {
    enabledText.textContent = t('specialPips');
    facesText.textContent = t('specialPipsFaces');
    colorText.textContent = t('specialPipsColor');
  };
  relabel();
  i18n.subscribe(relabel);

  const change = (next: Partial<SpecialPips>) => {
    const { appearance } = dice.getState();
    dice.setAppearance({ ...appearance, specialPips: { ...appearance.specialPips, ...next } });
  };
  enabled.addEventListener('change', () => change({ enabled: enabled.checked }));
  for (const { input } of faces) {
    input.addEventListener('change', () =>
      change({ values: faces.filter(({ input: face }) => face.checked).map(({ input: face }) => Number(face.value)) }),
    );
  }
  color.addEventListener('input', () => change({ color: color.value }));
  enabledLabel.dataset.appearanceRow = 'specialPips';
  facesRow.dataset.appearanceRow = 'specialPipsFaces';
  colorLabel.dataset.appearanceRow = 'specialPipsColor';
  container.append(enabledLabel, facesRow, colorLabel);

  return {
    update(specialPips) {
      enabled.checked = specialPips.enabled;
      faces.forEach(({ input }) => (input.checked = specialPips.values.includes(Number(input.value))));
      color.value = specialPips.color;
      // The faces and color only matter while the option is on.
      facesRow.hidden = colorLabel.hidden = !specialPips.enabled;
    },
  };
}

function mountTableBounce(container: HTMLElement): { input: HTMLInputElement; value: HTMLOutputElement } {
  const label = document.createElement('label');
  const text = document.createElement('span');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = String(TABLE_BOUNCE_MAX);
  input.step = '0.05';
  input.value = String(dice.getState().appearance.tableBounce);
  // The current value, shown to the right of the slider.
  const value = document.createElement('output');
  value.textContent = formatBounce(dice.getState().appearance.tableBounce);
  const relabel = () => (text.textContent = t('tableBounce'));
  relabel();
  i18n.subscribe(relabel);
  input.addEventListener('input', () =>
    dice.setAppearance({ ...dice.getState().appearance, tableBounce: Number(input.value) }),
  );
  label.append(text, input, value);
  label.dataset.appearanceRow = 'tableBounce';
  container.append(label);
  return { input, value };
}

function formatBounce(bounce: number): string {
  return bounce.toFixed(2);
}

/**
 * The dice's background choice, placed right after the appearance heading: a solid color, transparent,
 * an image, or felt: a color row for solid and felt, a URL row for an image.
 */
function mountBackdrop(heading: HTMLElement): { update(appearance: DiceAppearance): void } {
  const row = (input: HTMLElement) => {
    const label = document.createElement('label');
    const text = document.createElement('span');
    label.append(text, input);
    return { label, text };
  };
  const select = document.createElement('select');
  const kind = row(select);
  const backgroundColor = document.createElement('input');
  backgroundColor.type = 'color';
  const background = row(backgroundColor);
  const imageUrl = document.createElement('input');
  imageUrl.type = 'url';
  imageUrl.placeholder = 'https://';
  imageUrl.spellcheck = false;
  const image = row(imageUrl);

  const relabel = () => {
    kind.text.textContent = t('background');
    background.text.textContent = t('backgroundColor');
    image.text.textContent = t('imageUrl');
    const selected = select.value;
    select.replaceChildren(...DICE_BACKDROPS.map((backdrop) => new Option(t(BACKDROP_LABELS[backdrop]), backdrop)));
    select.value = selected || dice.getState().appearance.background.kind;
  };
  relabel();
  i18n.subscribe(relabel);

  const appearance = () => dice.getState().appearance;
  select.addEventListener('change', () =>
    dice.setAppearance({ ...appearance(), background: { ...appearance().background, kind: select.value as DiceBackdrop } }),
  );
  backgroundColor.addEventListener('input', () =>
    dice.setAppearance({ ...appearance(), background: { ...appearance().background, color: backgroundColor.value } }),
  );
  // A non-http(s) URL is rejected by the controller; the field keeps what was typed until it is fixed.
  imageUrl.addEventListener('input', () =>
    dice.setAppearance({ ...appearance(), background: { ...appearance().background, imageUrl: imageUrl.value.trim() } }),
  );
  kind.label.dataset.appearanceRow = 'backdrop';
  background.label.dataset.appearanceRow = 'backdropColor';
  image.label.dataset.appearanceRow = 'backdropImageUrl';
  heading.after(kind.label, background.label, image.label);

  return {
    update(next) {
      const backdrop = next.background.kind;
      select.value = backdrop;
      backgroundColor.value = next.background.color;
      if (document.activeElement !== imageUrl) imageUrl.value = next.background.imageUrl;
      background.label.hidden = backdrop !== 'solid' && backdrop !== 'felt';
      image.label.hidden = backdrop !== 'image';
    },
  };
}

/**
 * Puts the appearance rows in their reading order: the dice themselves first, then the result text,
 * then the background (with the table bounce, which belongs to the surface).
 */
function orderAppearanceRows(container: HTMLElement) {
  const order = [
    'diceSize',
    'dieColor',
    'pipColor',
    'specialPips',
    'specialPipsFaces',
    'specialPipsColor',
    'showResultText',
    'fontFamily',
    'fontSize',
    'textColor',
    'backdrop',
    'backdropColor',
    'backdropImageUrl',
    'tableBounce',
  ];
  const rows = order.map((name) => container.querySelector<HTMLElement>(`[data-appearance-row="${name}"]`)!);
  container.append(...rows);
}

/** three.js throws when no WebGL context can be created; the dice then roll as flat tiles. */
function createSceneOrFallback(container: HTMLElement): DiceScene {
  try {
    return createDiceScene(container);
  } catch {
    container.replaceChildren();
    return createFallbackDiceScene(container);
  }
}

/** Before the first roll, show the dice set with every die on its highest face. */
function restingDice({ groups }: DiceSet) {
  return groups.flatMap(({ sides, count }) => Array.from({ length: count }, () => ({ sides, value: sides })));
}

/** Runs an edit, then re-renders so inputs holding a value the controller rejected snap back. */
function edit(action: () => void) {
  action();
  render(dice.getState());
}

// Shake to roll: roll() already ignores shakes while animating.
let stopShakes: (() => void) | null = null;
/** Set while listenForShakes is pending, so overlapping starts never add a second listener. */
let startingShakes = false;
let motionGranted = false;
let waitingForGesture = false;
/** The last start failed (denied, unsupported): not retried until the setting is toggled again. */
let shakesFailed = false;
/** iOS only grants motion access from a user gesture. */
const needsGesture = typeof DeviceMotionEvent !== 'undefined' && 'requestPermission' in DeviceMotionEvent;

async function startShakes() {
  if (stopShakes || startingShakes) return;
  startingShakes = true;
  // Gate on the setting too, as a last guard between a Preset switch and the next render.
  const result = await listenForShakes(() => dice.getState().shakeToRoll && dice.roll());
  startingShakes = false;
  if (typeof result !== 'function') {
    shakesFailed = true;
    shakeStatus.textContent = t(result === 'denied' ? 'shakeDenied' : 'shakeUnsupported');
    return;
  }
  motionGranted = true;
  shakeStatus.textContent = '';
  // Turned off while permission was being asked for.
  if (dice.getState().shakeToRoll) stopShakes = result;
  else result();
}

function syncShakes(wanted: boolean) {
  if (!wanted) {
    stopShakes?.();
    stopShakes = null;
    shakesFailed = false;
    shakeStatus.textContent = '';
  } else if (!stopShakes && !startingShakes && !shakesFailed) {
    if (!needsGesture || motionGranted) {
      void startShakes();
    } else if (!waitingForGesture) {
      // Outside a gesture (page load, import): ask on the next tap.
      waitingForGesture = true;
      document.addEventListener(
        'click',
        () => {
          waitingForGesture = false;
          if (dice.getState().shakeToRoll) void startShakes();
        },
        { once: true },
      );
    }
  }
}

dice.subscribe(render);
i18n.subscribe(() => {
  renderAddSides();
  render(dice.getState());
});
renderAddSides();
render(dice.getState());

die.addEventListener('click', () => dice.roll());
// Space rolls and R resets from anywhere (also in Display mode), except while typing or on a focused control.
document.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof Element && event.target.closest('input, select, textarea, button')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    dice.roll();
  } else if (event.key === 'r' || event.key === 'R') {
    dice.reset();
  }
});
rollButton.addEventListener('click', () => dice.roll());
addButton.addEventListener('click', () => dice.addDie(Number(addSides.value) as DieSides));
modifierInput.addEventListener('change', () => edit(() => dice.setModifier(Number(modifierInput.value))));
resetButton.addEventListener('click', () => dice.reset());
skipInput.addEventListener('change', () => dice.setSkipAnimation(skipInput.checked));
alwaysFullInput.addEventListener('change', () => dice.setAlwaysFullAnimation(alwaysFullInput.checked));

shakeInput.addEventListener('change', () => {
  // Called right in the gesture: iOS only grants motion access from one.
  if (shakeInput.checked) {
    shakesFailed = false;
    void startShakes();
  }
  dice.setShakeToRoll(shakeInput.checked);
});
