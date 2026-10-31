import type { Env } from '../shared/env';
import { randomBelow } from '../shared/random';

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

export interface DiceState {
  diceSet: DiceSet;
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
}

export const MAX_DICE_PER_KIND = 99;
export const HISTORY_LIMIT = 20;

const DEFAULT_DICE_SET: DiceSet = { groups: [{ sides: 6, count: 1 }], modifier: 0 };

/** Headless dice logic: no DOM, all outside-world access goes through env. */
export function createDiceController(env: Env): DiceController {
  let state: DiceState = { diceSet: DEFAULT_DICE_SET, outcome: null, history: [] };
  const listeners = new Set<(state: DiceState) => void>();

  function update(next: Partial<DiceState>) {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener(state));
  }

  function setGroups(groups: DiceGroup[]) {
    if (groups.length === 0) return;
    update({ diceSet: { ...state.diceSet, groups } });
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
      update({ diceSet: { ...state.diceSet, modifier } });
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
  };
}

/** Total and breakdown, e.g. `17 = 12 + 3 + 2`; just the total when there is nothing to break down. */
export function formatOutcome({ rolls, modifier, total }: DiceOutcome): string {
  const [first, ...rest] = rolls.map((roll) => roll.value);
  const terms = [String(first), ...rest.map((value) => `+ ${value}`)];
  if (modifier !== 0) terms.push(`${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`);
  return terms.length === 1 ? String(total) : `${total} = ${terms.join(' ')}`;
}
