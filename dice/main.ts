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
  type DiceAppearance,
  type DiceOutcome,
  type DiceSet,
  type DiceState,
  type DieSides,
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
const durationInput = $<HTMLInputElement>('#duration');
const durationValue = $<HTMLOutputElement>('#duration-value');
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
  ],
  onChange(appearance) {
    dice.setAppearance(appearance);
    appearancePanel.update(dice.getState().appearance);
  },
});
const presetPanel = mountPresetPanel(dice, i18n);
const sharePanel = mountSharePanel(i18n, (options) => dice.shareLink(options));
mountSettingsFilePanel(i18n, {
  fileName: 'mywidgetbox-dice-settings.json',
  exportSettings: () => dice.exportSettings(),
  importSettings: (text) => dice.importSettings(text),
});
const soundInputs = mountSoundInputs(dice, sound, 'diceLand');

function renderAddSides() {
  const selected = addSides.value || '20';
  addSides.replaceChildren(
    ...DIE_SIDES.map((sides) => new Option(dieLabel(sides), String(sides), false, String(sides) === selected)),
  );
}

function render(state: DiceState) {
  const { diceSet, appearance, outcome, history, animating } = state;
  applyAppearance(appearance, { page: document.documentElement, display }, { forceTransparent: displayOptions.transparent });
  scene.setColors({ body: appearance.dieColor, label: appearance.pipColor });
  appearancePanel.update(appearance);

  presetPanel.update(state);

  if (animating && outcome && outcome !== playing) {
    playing = outcome;
    scene.play(outcome.rolls, animationFor(state, reducedMotion.matches), () => {
      sound.play('diceLand', dice.getState().sound);
      dice.finishAnimation();
    });
  } else if (!animating) {
    scene.show(outcome ? outcome.rolls : restingDice(diceSet));
  }
  // The Outcome is revealed once the dice have landed.
  breakdown.textContent = outcome && !animating ? formatOutcome(outcome) : '';
  modifierInput.value = String(diceSet.modifier);
  durationInput.value = String(state.animationDuration / 1000);
  durationValue.textContent = t('seconds', { seconds: state.animationDuration / 1000 });
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
durationInput.addEventListener('input', () => dice.setAnimationDuration(Number(durationInput.value) * 1000));
alwaysFullInput.addEventListener('change', () => dice.setAlwaysFullAnimation(alwaysFullInput.checked));

shakeInput.addEventListener('change', () => {
  // Called right in the gesture: iOS only grants motion access from one.
  if (shakeInput.checked) {
    shakesFailed = false;
    void startShakes();
  }
  dice.setShakeToRoll(shakeInput.checked);
});
