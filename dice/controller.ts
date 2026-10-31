import type { Env } from '../shared/env';
import { randomBelow } from '../shared/random';
import {
  type PresetSummary,
  type SettingsSchema,
  type SettingsStoreOptions,
  createSettingsStore,
  serializeSettings,
} from '../shared/settings';
import { type ShareLinkOptions, createShareLink, readShareLinkSettings } from '../shared/share-link';

export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export type DieSides = (typeof DIE_SIDES)[number];

/** N dice of one kind, e.g. 2d6. */
export interface DiceGroup {
  sides: DieSides;
  count: number;
}

export interface DiceSet {
  /** At most one group per die kind, in the order they were added. */
  groups: DiceGroup[];
  modifier: number;
}

export interface DieRoll {
  sides: DieSides;
  value: number;
}

export interface DiceOutcome {
  /** Face value of each die rolled, in dice set order. */
  rolls: DieRoll[];
  modifier: number;
  total: number;
}

/** What the dice remember and share; one value per Preset. Add new fields with defaults here. */
export interface DiceSettings {
  diceSet: DiceSet;
}

export interface DiceState {
  /** The dice set of the Settings in effect. */
  diceSet: DiceSet;
  presets: PresetSummary[];
  /** null while Settings opened from a Share link are in effect and not saved. */
  selectedPresetId: string | null;
  outcome: DiceOutcome | null;
  /** The most recent Outcomes, newest first, at most HISTORY_LIMIT; kept in memory only. */
  history: DiceOutcome[];
}

export interface DiceController {
  getState(): DiceState;
  /** Calls listener after every state change; returns an unsubscribe function. */
  subscribe(listener: (state: DiceState) => void): () => void;
  /** Adds one die of this kind (a new group, or one more in the existing group). */
  addDie(sides: DieSides): void;
  /** Removes the whole group of this kind; the last remaining group cannot be removed. */
  removeDie(sides: DieSides): void;
  /** Sets how many dice of this kind are rolled (0 removes the group); invalid counts are ignored. */
  setCount(sides: DieSides, count: number): void;
  /** Sets the fixed integer added to every total; non-integers are ignored. */
  setModifier(modifier: number): void;
  roll(): void;
  /** Saves the current Settings as a new Preset and switches to it. */
  createPreset(name: string): void;
  selectPreset(id: string): void;
  renamePreset(id: string, name: string): void;
  /** The last remaining Preset cannot be deleted. */
  deletePreset(id: string): void;
  /** A Share link to this page carrying the Settings in effect. */
  shareLink(options?: ShareLinkOptions): string;
}

export const MAX_DICE_PER_KIND = 99;
export const HISTORY_LIMIT = 20;

export const diceSettingsSchema: SettingsSchema<DiceSettings> = {
  namespace: 'dice',
  version: 1,
  defaults: { diceSet: { groups: [{ sides: 6, count: 1 }], modifier: 0 } },
  isValid: (settings): settings is DiceSettings => isDiceSet((settings as DiceSettings).diceSet),
};

function isDiceSet(value: unknown): value is DiceSet {
  const { groups, modifier } = (value ?? {}) as Partial<DiceSet>;
  return (
    Array.isArray(groups) &&
    groups.length > 0 &&
    new Set(groups.map((group) => group?.sides)).size === groups.length &&
    groups.every(
      (group) =>
        DIE_SIDES.includes(group?.sides) &&
        Number.isInteger(group.count) &&
        group.count >= 1 &&
        group.count <= MAX_DICE_PER_KIND,
    ) &&
    Number.isSafeInteger(modifier)
  );
}

/**
 * Headless dice logic: no DOM, all outside-world access goes through env.
 * Settings carried by a Share link in env.url take priority over stored ones.
 */
export function createDiceController(
  env: Env,
  settingsOptions: SettingsStoreOptions = { readUrl: readShareLinkSettings },
): DiceController {
  const settings = createSettingsStore(env, diceSettingsSchema, settingsOptions);
  let state: DiceState = { ...fromSettings(), outcome: null, history: [] };
  const listeners = new Set<(state: DiceState) => void>();

  function fromSettings() {
    const { settings: current, presets, selectedPresetId } = settings.getSnapshot();
    return { diceSet: current.diceSet, presets, selectedPresetId };
  }

  function update(next: Partial<DiceState>) {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener(state));
  }

  /** Runs a Settings action, then publishes the resulting Settings and Presets. */
  function changeSettings(action: () => void) {
    action();
    update(fromSettings());
  }

  function setDiceSet(diceSet: DiceSet) {
    changeSettings(() => settings.update({ ...settings.getSnapshot().settings, diceSet }));
  }

  function setGroups(groups: DiceGroup[]) {
    if (groups.length === 0) return;
    setDiceSet({ ...state.diceSet, groups });
  }

  function setCount(sides: DieSides, count: number) {
    if (!Number.isInteger(count) || count < 0 || count > MAX_DICE_PER_KIND) return;
    const { groups } = state.diceSet;
    if (count === 0) {
      setGroups(groups.filter((group) => group.sides !== sides));
    } else if (groups.some((group) => group.sides === sides)) {
      setGroups(groups.map((group) => (group.sides === sides ? { sides, count } : group)));
    } else {
      setGroups([...groups, { sides, count }]);
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    addDie(sides) {
      const current = state.diceSet.groups.find((group) => group.sides === sides)?.count ?? 0;
      setCount(sides, current + 1);
    },
    removeDie: (sides) => setCount(sides, 0),
    setCount,
    setModifier(modifier) {
      if (!Number.isSafeInteger(modifier)) return;
      setDiceSet({ ...state.diceSet, modifier });
    },
    roll() {
      const { groups, modifier } = state.diceSet;
      const rolls = groups.flatMap(({ sides, count }) =>
        Array.from({ length: count }, () => ({ sides, value: randomBelow(env.randomUint32, sides) + 1 })),
      );
      const total = rolls.reduce((sum, roll) => sum + roll.value, modifier);
      const outcome = { rolls, modifier, total };
      update({ outcome, history: [outcome, ...state.history].slice(0, HISTORY_LIMIT) });
    },
    createPreset: (name) => changeSettings(() => settings.createPreset(name)),
    selectPreset: (id) => changeSettings(() => settings.selectPreset(id)),
    renamePreset: (id, name) => changeSettings(() => settings.renamePreset(id, name)),
    deletePreset: (id) => changeSettings(() => settings.deletePreset(id)),
    shareLink: (options) =>
      createShareLink(env.url, serializeSettings(diceSettingsSchema, settings.getSnapshot().settings), options),
  };
}

/** Total and breakdown, e.g. `17 = 12 + 3 + 2`; just the total when there is nothing to break down. */
export function formatOutcome({ rolls, modifier, total }: DiceOutcome): string {
  const [first, ...rest] = rolls.map((roll) => roll.value);
  const terms = [String(first), ...rest.map((value) => `+ ${value}`)];
  if (modifier !== 0) terms.push(`${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`);
  return terms.length === 1 ? String(total) : `${total} = ${terms.join(' ')}`;
}
