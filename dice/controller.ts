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
  /** True from a roll until the view reports its animation finished; rolls are ignored meanwhile. */
  animating: boolean;
  /** Length of a full roll animation in ms, MIN_ANIMATION_DURATION..MAX_ANIMATION_DURATION. */
  animationDuration: number;
  /** Play the full animation even when the system asks for reduced motion. */
  alwaysFullAnimation: boolean;
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
  /** Decides a new Outcome and starts animating it; ignored while animating. */
  roll(): void;
  /** Called by the view when the animation of the current Outcome has finished. */
  finishAnimation(): void;
  /** Clears the Outcome and history (the dice set is kept); ignored while animating. */
  reset(): void;
  /** Sets the full animation length in ms; values outside 1–10 seconds are ignored. */
  setAnimationDuration(ms: number): void;
  setAlwaysFullAnimation(always: boolean): void;
}

export const MAX_DICE_PER_KIND = 99;
export const HISTORY_LIMIT = 20;
export const MIN_ANIMATION_DURATION = 1000;
export const MAX_ANIMATION_DURATION = 10_000;
/** Duration of the quick reveal that replaces the roll animation under reduced motion. */
export const REDUCED_MOTION_DURATION = 300;

const DEFAULT_DICE_SET: DiceSet = { groups: [{ sides: 6, count: 1 }], modifier: 0 };

/** Headless dice logic: no DOM, all outside-world access goes through env. */
export function createDiceController(env: Env): DiceController {
  let state: DiceState = {
    diceSet: DEFAULT_DICE_SET,
    outcome: null,
    history: [],
    animating: false,
    animationDuration: 3000,
    alwaysFullAnimation: false,
  };
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
      if (state.animating) return;
      const { groups, modifier } = state.diceSet;
      const rolls = groups.flatMap(({ sides, count }) =>
        Array.from({ length: count }, () => ({ sides, value: randomBelow(env.randomUint32, sides) + 1 })),
      );
      const total = rolls.reduce((sum, roll) => sum + roll.value, modifier);
      const outcome = { rolls, modifier, total };
      update({ outcome, history: [outcome, ...state.history].slice(0, HISTORY_LIMIT), animating: true });
    },
    finishAnimation() {
      if (state.animating) update({ animating: false });
    },
    reset() {
      if (!state.animating) update({ outcome: null, history: [] });
    },
    setAnimationDuration(ms) {
      if (!(ms >= MIN_ANIMATION_DURATION && ms <= MAX_ANIMATION_DURATION)) return;
      update({ animationDuration: ms });
    },
    setAlwaysFullAnimation: (always) => update({ alwaysFullAnimation: always }),
  };
}

/** How the view should animate a roll, given whether the system asks for reduced motion. */
export function animationFor(
  { animationDuration, alwaysFullAnimation }: DiceState,
  prefersReducedMotion: boolean,
): { duration: number; reduced: boolean } {
  const reduced = prefersReducedMotion && !alwaysFullAnimation;
  return { duration: reduced ? REDUCED_MOTION_DURATION : animationDuration, reduced };
}

/** Total and breakdown, e.g. `17 = 12 + 3 + 2`; just the total when there is nothing to break down. */
export function formatOutcome({ rolls, modifier, total }: DiceOutcome): string {
  const [first, ...rest] = rolls.map((roll) => roll.value);
  const terms = [String(first), ...rest.map((value) => `+ ${value}`)];
  if (modifier !== 0) terms.push(`${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`);
  return terms.length === 1 ? String(total) : `${total} = ${terms.join(' ')}`;
}
