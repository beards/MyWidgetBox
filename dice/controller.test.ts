import { describe, expect, it } from 'vitest';
import { createBrowserRandom } from '../shared/env';
import { createTestEnv } from '../shared/test-env';
import { createDiceController } from './controller';

describe('dice controller', () => {
  it('has no Outcome before the first roll', () => {
    const dice = createDiceController(createTestEnv());
    expect(dice.getState().outcome).toBeNull();
  });

  it('rolls 1d6 from the injected random source', () => {
    const dice = createDiceController(createTestEnv({ random: [0, 5, 7] }));

    dice.roll();
    expect(dice.getState().outcome).toEqual({ rolls: [1], total: 1 });
    dice.roll();
    expect(dice.getState().outcome).toEqual({ rolls: [6], total: 6 });
    dice.roll();
    expect(dice.getState().outcome).toEqual({ rolls: [2], total: 2 });
  });

  it('redraws random values that would cause modulo bias', () => {
    // 2^32 % 6 === 4, so the top 4 uint32 values (>= 4294967292) must be rejected.
    const dice = createDiceController(createTestEnv({ random: [4294967295, 4294967292, 2] }));

    dice.roll();
    expect(dice.getState().outcome).toEqual({ rolls: [3], total: 3 });
  });

  it('notifies subscribers with the new Outcome after a roll', () => {
    const dice = createDiceController(createTestEnv({ random: [3] }));
    const seen: unknown[] = [];
    dice.subscribe((state) => seen.push(state.outcome));

    dice.roll();
    expect(seen).toEqual([{ rolls: [4], total: 4 }]);
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

  it('produces uniformly distributed 1d6 Outcomes with the production random source', () => {
    const dice = createDiceController(createBrowserEnvForNode());
    const rolls = 60_000;
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < rolls; i++) {
      dice.roll();
      const value = dice.getState().outcome!.total;
      counts[value - 1]!++;
    }

    expect(counts.every((count) => count > 0)).toBe(true);
    const expected = rolls / 6;
    const chiSquare = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
    // Critical value for 5 degrees of freedom at p = 0.001.
    expect(chiSquare).toBeLessThan(20.515);
  });
});

/** Production random source (crypto.getRandomValues) with test doubles for browser-only parts. */
function createBrowserEnvForNode() {
  return { ...createTestEnv(), randomUint32: createBrowserRandom() };
}
