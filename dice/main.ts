// View layer: owns the DOM, subscribes to the controller, and calls its actions.
import { createBrowserEnv } from '../shared/env';
import { createI18n } from '../shared/i18n';
import { bindStaticText, mountLanguageSwitcher } from '../shared/i18n-dom';
import { DIE_SIDES, MAX_DICE_PER_KIND, type DiceState, type DieSides, createDiceController, formatOutcome } from './controller';
import { messages } from './messages';

const env = createBrowserEnv();
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
const presetSelect = $<HTMLSelectElement>('#preset');
const presetName = $<HTMLInputElement>('#preset-name');
const presetNew = $<HTMLButtonElement>('#preset-new');
const presetDelete = $<HTMLButtonElement>('#preset-delete');

function renderAddSides() {
  const selected = addSides.value || '20';
  addSides.replaceChildren(
    ...DIE_SIDES.map((sides) => new Option(dieLabel(sides), String(sides), false, String(sides) === selected)),
  );
}

function render({ diceSet, presets, selectedPresetId, outcome, history }: DiceState) {
  presetSelect.replaceChildren(
    ...presets.map(({ id, name }) => new Option(name || t('unnamedPreset'), id, false, id === selectedPresetId)),
  );
  const selected = presets.find((preset) => preset.id === selectedPresetId);
  presetName.value = selected?.name ?? '';
  presetName.disabled = !selected;
  presetDelete.disabled = !selected || presets.length === 1;

  die.textContent = outcome ? String(outcome.total) : '?';
  breakdown.textContent = outcome ? formatOutcome(outcome) : '';
  modifierInput.value = String(diceSet.modifier);

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

  historyList.replaceChildren(
    ...history.map((entry) => {
      const item = document.createElement('li');
      item.textContent = formatOutcome(entry);
      return item;
    }),
  );
}

/** Runs an edit, then re-renders so inputs holding a value the controller rejected snap back. */
function edit(action: () => void) {
  action();
  render(dice.getState());
}

dice.subscribe(render);
i18n.subscribe(() => {
  renderAddSides();
  render(dice.getState());
});
renderAddSides();
render(dice.getState());

die.addEventListener('click', () => dice.roll());
rollButton.addEventListener('click', () => dice.roll());
addButton.addEventListener('click', () => dice.addDie(Number(addSides.value) as DieSides));
presetSelect.addEventListener('change', () => dice.selectPreset(presetSelect.value));
presetName.addEventListener('change', () => {
  const id = dice.getState().selectedPresetId;
  if (id) dice.renamePreset(id, presetName.value.trim());
});
presetNew.addEventListener('click', () => dice.createPreset(t('newPresetName', { n: dice.getState().presets.length + 1 })));
presetDelete.addEventListener('click', () => {
  const id = dice.getState().selectedPresetId;
  if (id) dice.deletePreset(id);
});
modifierInput.addEventListener('change', () => edit(() => dice.setModifier(Number(modifierInput.value))));
