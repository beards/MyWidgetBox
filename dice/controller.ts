import type { Env } from '../shared/env';
import { randomBelow } from '../shared/random';

export interface DiceOutcome {
  /** Face value of each die rolled. */
  rolls: number[];
  total: number;
}

export interface DiceState {
  outcome: DiceOutcome | null;
}

export interface DiceController {
  getState(): DiceState;
  /** Calls listener after every state change; returns an unsubscribe function. */
  subscribe(listener: (state: DiceState) => void): () => void;
  roll(): void;
}

const SIDES = 6;

/** Headless dice logic: no DOM, all outside-world access goes through env. */
export function createDiceController(env: Env): DiceController {
  let state: DiceState = { outcome: null };
  const listeners = new Set<(state: DiceState) => void>();

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    roll() {
      const value = randomBelow(env.randomUint32, SIDES) + 1;
      state = { outcome: { rolls: [value], total: value } };
      listeners.forEach((listener) => listener(state));
    },
  };
}
