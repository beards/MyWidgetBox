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
  TABLE_FINISHES,
  type DiceAppearance,
  type DiceOutcome,
  type DiceSet,
  type DiceState,
  type DieSides,
  type SpecialPips,
  type TableFinish,
  TABLE_BOUNCE_MAX,
  animationFor,
  createDiceController,
  formatOutcome,
} from './controller';
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
const FINISH_LABELS = { felt: 'finishFelt', wood: 'finishWood', plain: 'finishPlain' } as const;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const die = $<HTMLButtonElement>('#die');
const breakdown = $('#breakdown');
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
const display = $('#display');
const appearancePanel = mountAppearancePanel<DiceAppearance>(document.querySelector<HTMLElement>('#appearance')!, {
  i18n,
  fields: [
    { key: 'dieColor', label: () => t('dieColor') },
    { key: 'pipColor', label: () => t('pipColor') },
    { key: 'tableColor', label: () => t('tableColor') },
  ],
  onChange(appearance) {
    dice.setAppearance(appearance);
    appearancePanel.update(dice.getState().appearance);
  },
});
const tableFinishInput = mountTableFinish(document.querySelector<HTMLElement>('#appearance')!);
const tableBounce = mountTableBounce(document.querySelector<HTMLElement>('#appearance')!);
const specialPipsInputs = mountSpecialPips(document.querySelector<HTMLElement>('#appearance')!);
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
  applyAppearance(appearance, { page: document.documentElement, display }, { forceTransparent: displayOptions.transparent });
  const { specialPips } = appearance;
  scene.setColors({
    body: appearance.dieColor,
    label: appearance.pipColor,
    specialPips: specialPips.enabled ? { values: specialPips.values, color: specialPips.color } : null,
  });
  // With a transparent background only the dice and their shadows show (e.g. over a stream in OBS).
  const transparent = displayOptions.transparent || appearance.background.kind === 'transparent';
  scene.setTable({ color: appearance.tableColor, finish: appearance.tableFinish, visible: !transparent });
  appearancePanel.update(appearance);
  tableFinishInput.value = appearance.tableFinish;
  if (document.activeElement !== tableBounce.input) tableBounce.input.value = String(appearance.tableBounce);
  tableBounce.value.textContent = formatBounce(appearance.tableBounce);
  specialPipsInputs.update(appearance.specialPips);

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
  breakdown.textContent = outcome && !animating ? formatOutcome(outcome) : '';
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
  container.append(label);
  return { input, value };
}

function formatBounce(bounce: number): string {
  return bounce.toFixed(2);
}

/** The table finish choice, added to the appearance panel after its color items. */
function mountTableFinish(container: HTMLElement): HTMLSelectElement {
  const label = document.createElement('label');
  const text = document.createElement('span');
  const select = document.createElement('select');
  const relabel = () => {
    text.textContent = t('tableFinish');
    const selected = select.value;
    select.replaceChildren(...TABLE_FINISHES.map((finish) => new Option(t(FINISH_LABELS[finish]), finish)));
    select.value = selected || dice.getState().appearance.tableFinish;
  };
  relabel();
  i18n.subscribe(relabel);
  select.addEventListener('change', () =>
    dice.setAppearance({ ...dice.getState().appearance, tableFinish: select.value as TableFinish }),
  );
  label.append(text, select);
  container.append(label);
  return select;
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
