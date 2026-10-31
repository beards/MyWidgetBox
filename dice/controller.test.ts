import { describe, expect, it } from 'vitest';
import { createBrowserRandom } from '../shared/env';
import { createTestEnv } from '../shared/test-env';
import { DIE_SIDES, type DieSides, createDiceController, formatOutcome } from './controller';

describe('dice controller', () => {
  it('has no Outcome before the first roll', () => {
    const dice = createDiceController(createTestEnv());
    expect(dice.getState().outcome).toBeNull();
  });

  it('defaults to a 1d6 dice set with no modifier', () => {
    const dice = createDiceController(createTestEnv());
    expect(dice.getState().diceSet).toEqual({ groups: [{ sides: 6, count: 1 }], modifier: 0 });
  });

  it('rolls 1d6 from the injected random source', () => {
    const dice = createDiceController(createTestEnv({ random: [0, 5, 7] }));

    dice.roll();
    expect(dice.getState().outcome).toEqual({ rolls: [{ sides: 6, value: 1 }], modifier: 0, total: 1 });
    dice.roll();
    expect(dice.getState().outcome!.total).toBe(6);
    dice.roll();
    expect(dice.getState().outcome!.total).toBe(2);
  });

  it('redraws random values that would cause modulo bias', () => {
    // 2^32 % 6 === 4, so the top 4 uint32 values (>= 4294967292) must be rejected.
    const dice = createDiceController(createTestEnv({ random: [4294967295, 4294967292, 2] }));

    dice.roll();
    expect(dice.getState().outcome!.total).toBe(3);
  });

  it('notifies subscribers with the new Outcome after a roll', () => {
    const dice = createDiceController(createTestEnv({ random: [3] }));
    const seen: unknown[] = [];
    dice.subscribe((state) => seen.push(state.outcome?.total));

    dice.roll();
    expect(seen).toEqual([4]);
  });

  it('stops notifying after unsubscribe', () => {
    const dice = createDiceController(createTestEnv({ random: [0, 0] }));
    let calls = 0;
    const unsubscribe = dice.subscribe(() => calls++);

    dice.roll();
    unsubscribe();
    dice.roll();
    expect(calls).toBe(1);
  });

  it('rolls a mixed dice set with a modifier', () => {
    // 1d20 + 2d6 + 5, built through the composer.
    const dice = createDiceController(createTestEnv({ random: [2, 1, 11] }));
    dice.addDie(20);
    dice.setCount(6, 2);
    dice.setModifier(5);

    expect(dice.getState().diceSet).toEqual({
      groups: [
        { sides: 6, count: 2 },
        { sides: 20, count: 1 },
      ],
      modifier: 5,
    });
    dice.roll();
    expect(dice.getState().outcome).toEqual({
      rolls: [
        { sides: 6, value: 3 },
        { sides: 6, value: 2 },
        { sides: 20, value: 12 },
      ],
      modifier: 5,
      total: 22,
    });
  });

  it('supports negative modifiers', () => {
    const dice = createDiceController(createTestEnv({ random: [0] }));
    dice.setModifier(-3);

    dice.roll();
    expect(dice.getState().outcome).toEqual({ rolls: [{ sides: 6, value: 1 }], modifier: -3, total: -2 });
  });

  it('adds another die when adding a kind already in the set', () => {
    const dice = createDiceController(createTestEnv());
    dice.addDie(6);
    expect(dice.getState().diceSet.groups).toEqual([{ sides: 6, count: 2 }]);
  });

  it('removes a die kind from the set', () => {
    const dice = createDiceController(createTestEnv({ random: [9] }));
    dice.addDie(100);
    dice.removeDie(6);

    expect(dice.getState().diceSet.groups).toEqual([{ sides: 100, count: 1 }]);
    dice.roll();
    expect(dice.getState().outcome!.rolls).toEqual([{ sides: 100, value: 10 }]);
  });

  it('keeps at least one die in the set', () => {
    const dice = createDiceController(createTestEnv());
    dice.removeDie(6);
    dice.setCount(6, 0);
    expect(dice.getState().diceSet.groups).toEqual([{ sides: 6, count: 1 }]);
  });

  it('ignores invalid counts and modifiers', () => {
    const dice = createDiceController(createTestEnv());
    dice.setCount(6, 1.5);
    dice.setCount(6, 1000);
    dice.setModifier(Number.NaN);
    dice.setModifier(0.5);
    expect(dice.getState().diceSet).toEqual({ groups: [{ sides: 6, count: 1 }], modifier: 0 });
  });

  it('removes a die kind when its count is set to 0 and other kinds remain', () => {
    const dice = createDiceController(createTestEnv());
    dice.addDie(8);
    dice.setCount(6, 0);
    expect(dice.getState().diceSet.groups).toEqual([{ sides: 8, count: 1 }]);
  });

  it('starts with an empty history', () => {
    const dice = createDiceController(createTestEnv());
    expect(dice.getState().history).toEqual([]);
  });

  it('keeps the 20 most recent Outcomes, newest first', () => {
    const random = Array.from({ length: 25 }, (_, i) => i % 6);
    const dice = createDiceController(createTestEnv({ random }));
    for (let i = 0; i < 25; i++) dice.roll();

    const totals = dice.getState().history.map((outcome) => outcome.total);
    // Rolls 6..25 survive (values (i % 6) + 1 for i = 24 down to 5).
    expect(totals).toEqual([1, 6, 5, 4, 3, 2, 1, 6, 5, 4, 3, 2, 1, 6, 5, 4, 3, 2, 1, 6]);
    expect(dice.getState().history[0]).toBe(dice.getState().outcome);
  });

  it('formats an Outcome as total and breakdown', () => {
    expect(
      formatOutcome({
        rolls: [
          { sides: 20, value: 12 },
          { sides: 6, value: 3 },
          { sides: 4, value: 2 },
        ],
        modifier: 0,
        total: 17,
      }),
    ).toBe('17 = 12 + 3 + 2');
    expect(formatOutcome({ rolls: [{ sides: 20, value: 12 }], modifier: 5, total: 17 })).toBe('17 = 12 + 5');
    expect(formatOutcome({ rolls: [{ sides: 6, value: 1 }], modifier: -3, total: -2 })).toBe('-2 = 1 - 3');
    expect(formatOutcome({ rolls: [{ sides: 6, value: 4 }], modifier: 0, total: 4 })).toBe('4');
  });

  // Chi-square critical values at p = 0.001 for (sides - 1) degrees of freedom.
  const CRITICAL_VALUES: Record<DieSides, number> = {
    4: 16.266,
    6: 20.515,
    8: 24.322,
    10: 27.877,
    12: 31.264,
    20: 43.82,
    100: 148.23,
  };

  it.each(DIE_SIDES)('produces uniformly distributed d%i Outcomes with the production random source', (sides) => {
    const dice = createDiceController(createBrowserEnvForNode());
    dice.addDie(sides);
    if (sides !== 6) dice.removeDie(6);
    const expected = 2_000;
    const rolls = expected * sides;
    const counts = new Array<number>(sides).fill(0);
    for (let i = 0; i < rolls; i++) {
      dice.roll();
      const value = dice.getState().outcome!.rolls[0]!.value;
      counts[value - 1]!++;
    }

    expect(counts.every((count) => count > 0)).toBe(true);
    const chiSquare = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
    expect(chiSquare).toBeLessThan(CRITICAL_VALUES[sides]);
  });
});

/** Production random source (crypto.getRandomValues) with test doubles for browser-only parts. */
function createBrowserEnvForNode() {
  return { ...createTestEnv(), randomUint32: createBrowserRandom() };
}
