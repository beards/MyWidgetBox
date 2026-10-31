// View layer: owns the DOM, subscribes to the controller, and calls its actions.
import { applyAppearance, mountAppearancePanel } from '../shared/appearance-dom';
import { createBrowserEnv } from '../shared/env';
import { createI18n } from '../shared/i18n';
import { bindStaticText, mountLanguageSwitcher } from '../shared/i18n-dom';
import { applyDisplayMode } from '../shared/display-mode';
import { readDisplayOptions } from '../shared/share-link';
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
import { createDiceScene } from './scene';

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
const resetButton = $<HTMLButtonElement>('#reset');
const durationInput = $<HTMLInputElement>('#duration');
const durationValue = $<HTMLOutputElement>('#duration-value');
const alwaysFullInput = $<HTMLInputElement>('#always-full');

const scene = createDiceScene(die);
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

function renderAddSides() {
  const selected = addSides.value || '20';
  addSides.replaceChildren(
    ...DIE_SIDES.map((sides) => new Option(dieLabel(sides), String(sides), false, String(sides) === selected)),
  );
}

function render(state: DiceState) {
  const { diceSet, appearance, presets, selectedPresetId, outcome, history, animating } = state;
  applyAppearance(appearance, { page: document.documentElement, display }, { forceTransparent: displayOptions.transparent });
  scene.setColors({ body: appearance.dieColor, label: appearance.pipColor });
  appearancePanel.update(appearance);

  presetSelect.replaceChildren(
    ...(selectedPresetId === null ? [new Option(t('sharedPreset'), '', false, true)] : []),
    ...presets.map(({ id, name }) => new Option(name || t('unnamedPreset'), id, false, id === selectedPresetId)),
  );
  sharedNotice.hidden = selectedPresetId !== null;
  const selected = presets.find((preset) => preset.id === selectedPresetId);
  presetName.value = selected?.name ?? '';
  presetName.disabled = !selected;
  presetDelete.disabled = !selected || presets.length === 1;

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
  durationValue.textContent = t('seconds', { seconds: state.animationDuration / 1000 });
  alwaysFullInput.checked = state.alwaysFullAnimation;

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

  shareUrl.value = shareLink();

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

function shareLink() {
  return dice.shareLink({
    display: shareDisplay.checked,
    transparent: shareTransparent.checked,
    lang: i18n.getLocale(),
  });
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
sharedSave.addEventListener('click', () => dice.createPreset(t('sharedPresetName')));
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
resetButton.addEventListener('click', () => dice.reset());
durationInput.addEventListener('input', () => dice.setAnimationDuration(Number(durationInput.value) * 1000));
alwaysFullInput.addEventListener('change', () => dice.setAlwaysFullAnimation(alwaysFullInput.checked));
settingsExport.addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([dice.exportSettings()], { type: 'application/json' }));
  link.download = 'mywidgetbox-dice-settings.json';
  link.click();
  URL.revokeObjectURL(link.href);
});
settingsImport.addEventListener('change', async () => {
  const file = settingsImport.files?.[0];
  if (!file) return;
  importError.textContent = dice.importSettings(await file.text()) ? '' : t('importError');
  settingsImport.value = '';
});
