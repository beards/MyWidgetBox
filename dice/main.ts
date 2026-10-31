// View layer: owns the DOM, subscribes to the controller, and calls its actions.
import { createBrowserEnv } from '../shared/env';
import {
  DIE_SIDES,
  MAX_DICE_PER_KIND,
  type DiceOutcome,
  type DiceSet,
  type DiceState,
  type DieSides,
  animationFor,
  createDiceController,
  formatOutcome,
} from './controller';
import { createDiceScene } from './scene';
import { strings } from './strings';

const dice = createDiceController(createBrowserEnv());

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

const scene = createDiceScene(die);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
/** The Outcome currently being animated, so each roll starts its animation exactly once. */
let playing: DiceOutcome | null = null;

die.setAttribute('aria-label', strings.roll);
rollButton.textContent = strings.roll;
resetButton.textContent = strings.reset;
$('#duration-label').textContent = strings.animationDuration;
$('#always-full-label').textContent = strings.alwaysFullAnimation;
$('#dice-set-heading').textContent = strings.diceSet;
addButton.textContent = strings.addDie;
$('#modifier-label').textContent = strings.modifier;
$('#history-heading').textContent = strings.history;
addSides.replaceChildren(
  ...DIE_SIDES.map((sides) => new Option(strings.dieLabel(sides), String(sides), sides === 20, sides === 20)),
);

function render(state: DiceState) {
  const { diceSet, outcome, history, animating } = state;
  if (animating && outcome && outcome !== playing) {
    playing = outcome;
    scene.play(outcome.rolls, animationFor(state, reducedMotion.matches), () => dice.finishAnimation());
  } else if (!animating) {
    scene.show(outcome ? outcome.rolls : restingDice(diceSet));
  }
  // The Outcome is revealed once the dice have landed.
  breakdown.textContent = outcome && !animating ? formatOutcome(outcome) : '';
  modifierInput.value = String(diceSet.modifier);
  durationInput.value = String(state.animationDuration / 1000);
  durationValue.textContent = strings.seconds(state.animationDuration / 1000);
  alwaysFullInput.checked = state.alwaysFullAnimation;

  groupList.replaceChildren(
    ...diceSet.groups.map(({ sides, count }) => {
      const label = strings.dieLabel(sides);
      const item = document.createElement('li');
      const countInput = document.createElement('input');
      countInput.type = 'number';
      countInput.min = '1';
      countInput.max = String(MAX_DICE_PER_KIND);
      countInput.value = String(count);
      countInput.setAttribute('aria-label', strings.count(label));
      countInput.addEventListener('change', () => edit(() => dice.setCount(sides, Number(countInput.value))));
      const name = document.createElement('span');
      name.textContent = label;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', strings.removeDie(label));
      remove.disabled = diceSet.groups.length === 1;
      remove.addEventListener('click', () => dice.removeDie(sides));
      item.append(countInput, name, remove);
      return item;
    }),
  );

  // While animating, the newest entry would give the Outcome away before the dice land.
  historyList.replaceChildren(
    ...history.slice(animating ? 1 : 0).map((entry) => {
      const item = document.createElement('li');
      item.textContent = formatOutcome(entry);
      return item;
    }),
  );
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

dice.subscribe(render);
render(dice.getState());

die.addEventListener('click', () => dice.roll());
rollButton.addEventListener('click', () => dice.roll());
addButton.addEventListener('click', () => dice.addDie(Number(addSides.value) as DieSides));
modifierInput.addEventListener('change', () => edit(() => dice.setModifier(Number(modifierInput.value))));
resetButton.addEventListener('click', () => dice.reset());
durationInput.addEventListener('input', () => dice.setAnimationDuration(Number(durationInput.value) * 1000));
alwaysFullInput.addEventListener('change', () => dice.setAlwaysFullAnimation(alwaysFullInput.checked));

// Space rolls and R resets, unless the key belongs to a focused control
// (a focused button already handles Space itself, e.g. the dice).
document.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target as HTMLElement;
  if (target.closest('input, select, textarea, [contenteditable]')) return;
  if (event.code === 'Space') {
    if (target.closest('button')) return;
    event.preventDefault();
    dice.roll();
  } else if (event.key === 'r' || event.key === 'R') {
    dice.reset();
  }
});
