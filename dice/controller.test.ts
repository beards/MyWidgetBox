import { describe, expect, it } from 'vitest';
import { createBrowserRandom } from '../shared/env';
import { settingsStorageKey } from '../shared/settings';
import { createTestEnv } from '../shared/test-env';
import {
  DIE_SIDES,
  type DiceController,
  type DieSides,
  REDUCED_MOTION_DURATION,
  animationFor,
  createDiceController,
  formatOutcome,
} from './controller';

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

    rollAndFinish(dice);
    expect(dice.getState().outcome).toEqual({ rolls: [{ sides: 6, value: 1 }], modifier: 0, total: 1 });
    rollAndFinish(dice);
    expect(dice.getState().outcome!.total).toBe(6);
    rollAndFinish(dice);
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
    rollAndFinish(dice);
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
    for (let i = 0; i < 25; i++) rollAndFinish(dice);

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

  it('is animating after a roll until the view reports the animation finished', () => {
    const dice = createDiceController(createTestEnv({ random: [2] }));
    expect(dice.getState().animating).toBe(false);

    dice.roll();
    expect(dice.getState().animating).toBe(true);
    expect(dice.getState().outcome!.total).toBe(3);
    dice.finishAnimation();
    expect(dice.getState().animating).toBe(false);
  });

  it('ignores rolls while animating', () => {
    const dice = createDiceController(createTestEnv({ random: [2, 4] }));
    dice.roll();
    const first = dice.getState().outcome;

    dice.roll();
    expect(dice.getState().outcome).toBe(first);
    expect(dice.getState().history).toHaveLength(1);
    dice.finishAnimation();
    dice.roll();
    expect(dice.getState().outcome!.total).toBe(5);
  });

  it('reset clears the Outcome and history but keeps the dice set', () => {
    const dice = createDiceController(createTestEnv({ random: [2, 4] }));
    dice.setModifier(2);
    rollAndFinish(dice);
    rollAndFinish(dice);

    dice.reset();
    expect(dice.getState().outcome).toBeNull();
    expect(dice.getState().history).toEqual([]);
    expect(dice.getState().diceSet).toEqual({ groups: [{ sides: 6, count: 1 }], modifier: 2 });
  });

  it('ignores reset while animating', () => {
    const dice = createDiceController(createTestEnv({ random: [2] }));
    dice.roll();

    dice.reset();
    expect(dice.getState().outcome!.total).toBe(3);
    expect(dice.getState().animating).toBe(true);
  });

  it('plays a full-length animation of the chosen duration', () => {
    const dice = createDiceController(createTestEnv());
    expect(animationFor(dice.getState(), false)).toEqual({ duration: 3000, reduced: false });

    dice.setAnimationDuration(7500);
    expect(animationFor(dice.getState(), false)).toEqual({ duration: 7500, reduced: false });
  });

  it('keeps the animation duration between 1 and 10 seconds', () => {
    const dice = createDiceController(createTestEnv());
    dice.setAnimationDuration(999);
    dice.setAnimationDuration(10_001);
    dice.setAnimationDuration(Number.NaN);
    expect(dice.getState().animationDuration).toBe(3000);
    dice.setAnimationDuration(1000);
    expect(dice.getState().animationDuration).toBe(1000);
    dice.setAnimationDuration(10_000);
    expect(dice.getState().animationDuration).toBe(10_000);
  });

  it('shortens the animation when the system asks for reduced motion', () => {
    const dice = createDiceController(createTestEnv());
    dice.setAnimationDuration(7500);
    expect(animationFor(dice.getState(), true)).toEqual({ duration: REDUCED_MOTION_DURATION, reduced: true });
    expect(REDUCED_MOTION_DURATION).toBeLessThan(1000);
  });

  it('can be overridden to always play the full animation', () => {
    const dice = createDiceController(createTestEnv());
    expect(dice.getState().alwaysFullAnimation).toBe(false);

    dice.setAlwaysFullAnimation(true);
    expect(animationFor(dice.getState(), true)).toEqual({ duration: 3000, reduced: false });
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
      rollAndFinish(dice);
      const value = dice.getState().outcome!.rolls[0]!.value;
      counts[value - 1]!++;
    }

    expect(counts.every((count) => count > 0)).toBe(true);
    const chiSquare = counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
    expect(chiSquare).toBeLessThan(CRITICAL_VALUES[sides]);
  });
});

describe('dice Settings persistence and Presets', () => {
  it('keeps the dice set after a reload', () => {
    const env = createTestEnv();
    const before = createDiceController(env);
    before.addDie(20);
    before.setModifier(3);

    const after = createDiceController(env);
    expect(after.getState().diceSet).toEqual({
      groups: [
        { sides: 6, count: 1 },
        { sides: 20, count: 1 },
      ],
      modifier: 3,
    });
  });

  it('remembers the animation length and the full-animation override after a reload', () => {
    const env = createTestEnv();
    const before = createDiceController(env);
    before.setAnimationDuration(6500);
    before.setAlwaysFullAnimation(true);

    const after = createDiceController(env);
    expect(after.getState().animationDuration).toBe(6500);
    expect(after.getState().alwaysFullAnimation).toBe(true);
  });

  it('keeps animation settings per Preset', () => {
    const dice = createDiceController(createTestEnv());
    const first = dice.getState().selectedPresetId!;
    dice.createPreset('Slow');
    dice.setAnimationDuration(9000);

    dice.selectPreset(first);
    expect(dice.getState().animationDuration).toBe(3000);
  });

  it.each(['{not json', '"text"', '{"version":1,"presets":[]}', '{"version":99,"presets":[{"id":"1","name":"","settings":{}}]}'])(
    'opens with the default 1d6 when stored Settings are unreadable: %s',
    (stored) => {
      const env = createTestEnv();
      env.storage.setItem(settingsStorageKey('dice'), stored);

      const dice = createDiceController(env);
      expect(dice.getState().diceSet).toEqual({ groups: [{ sides: 6, count: 1 }], modifier: 0 });
      expect(dice.getState().presets).toHaveLength(1);
    },
  );

  it('opens with defaults when a stored dice set is invalid', () => {
    const env = createTestEnv();
    env.storage.setItem(
      settingsStorageKey('dice'),
      JSON.stringify({
        version: 1,
        selectedPresetId: '1',
        presets: [{ id: '1', name: 'Bad', settings: { diceSet: { groups: [{ sides: 7, count: 1 }], modifier: 0 } } }],
      }),
    );

    expect(createDiceController(env).getState().diceSet).toEqual({ groups: [{ sides: 6, count: 1 }], modifier: 0 });
  });

  it('fills missing fields with defaults and ignores unknown fields in stored Settings', () => {
    const env = createTestEnv();
    env.storage.setItem(
      settingsStorageKey('dice'),
      JSON.stringify({
        version: 1,
        selectedPresetId: 'a',
        presets: [
          { id: 'a', name: 'Empty', settings: { futureField: true } },
          { id: 'b', name: 'D20', settings: { diceSet: { groups: [{ sides: 20, count: 1 }], modifier: 2 } } },
        ],
      }),
    );

    const dice = createDiceController(env);
    expect(dice.getState().diceSet).toEqual({ groups: [{ sides: 6, count: 1 }], modifier: 0 });
    dice.selectPreset('b');
    expect(dice.getState().diceSet).toEqual({ groups: [{ sides: 20, count: 1 }], modifier: 2 });
  });

  it('starts with one Preset that is selected', () => {
    const { presets, selectedPresetId } = createDiceController(createTestEnv()).getState();
    expect(presets).toHaveLength(1);
    expect(selectedPresetId).toBe(presets[0]!.id);
  });

  it('creates a Preset from the current Settings and switches between Presets', () => {
    const dice = createDiceController(createTestEnv());
    const first = dice.getState().selectedPresetId!;
    dice.createPreset('Attack');
    const attack = dice.getState().selectedPresetId!;
    dice.addDie(20);
    dice.setModifier(5);

    expect(dice.getState().presets.map((preset) => preset.name)).toEqual(['', 'Attack']);
    expect(attack).not.toBe(first);

    dice.selectPreset(first);
    expect(dice.getState().diceSet).toEqual({ groups: [{ sides: 6, count: 1 }], modifier: 0 });
    dice.selectPreset(attack);
    expect(dice.getState().diceSet).toEqual({
      groups: [
        { sides: 6, count: 1 },
        { sides: 20, count: 1 },
      ],
      modifier: 5,
    });
  });

  it('renames and deletes Presets, keeping at least one', () => {
    const dice = createDiceController(createTestEnv());
    const first = dice.getState().selectedPresetId!;
    dice.createPreset('Damage');
    const damage = dice.getState().selectedPresetId!;

    dice.renamePreset(first, 'Basic');
    expect(dice.getState().presets).toEqual([
      { id: first, name: 'Basic' },
      { id: damage, name: 'Damage' },
    ]);

    dice.deletePreset(damage);
    expect(dice.getState().presets).toEqual([{ id: first, name: 'Basic' }]);
    expect(dice.getState().selectedPresetId).toBe(first);

    dice.deletePreset(first);
    expect(dice.getState().presets).toEqual([{ id: first, name: 'Basic' }]);
  });

  it('remembers Presets and the selected Preset after a reload', () => {
    const env = createTestEnv();
    const before = createDiceController(env);
    before.createPreset('Big');
    before.setCount(6, 4);
    before.createPreset('Bigger');
    before.setCount(6, 8);
    before.selectPreset(before.getState().presets[1]!.id);

    const after = createDiceController(env);
    expect(after.getState().presets.map((preset) => preset.name)).toEqual(['', 'Big', 'Bigger']);
    expect(after.getState().selectedPresetId).toBe(after.getState().presets[1]!.id);
    expect(after.getState().diceSet.groups).toEqual([{ sides: 6, count: 4 }]);
  });

  it('notifies subscribers when switching Presets', () => {
    const dice = createDiceController(createTestEnv());
    const first = dice.getState().selectedPresetId!;
    dice.createPreset('Two');
    dice.setCount(6, 2);
    const seen: number[] = [];
    dice.subscribe((state) => seen.push(state.diceSet.groups[0]!.count));

    dice.selectPreset(first);
    expect(seen).toEqual([1]);
  });
});

describe('dice Share link', () => {
  const page = 'https://example.test/MyWidgetBox/dice/';

  it('opens a Share link with the same Settings', () => {
    const sharer = createDiceController(createTestEnv({ url: page }));
    sharer.addDie(20);
    sharer.setCount(6, 3);
    sharer.setModifier(-2);

    const opened = createDiceController(createTestEnv({ url: sharer.shareLink() }));
    expect(opened.getState().diceSet).toEqual(sharer.getState().diceSet);
  });

  it('carries the animation settings in a Share link', () => {
    const sharer = createDiceController(createTestEnv({ url: page }));
    sharer.setAnimationDuration(1500);
    sharer.setAlwaysFullAnimation(true);

    const opened = createDiceController(createTestEnv({ url: sharer.shareLink() }));
    expect(opened.getState().animationDuration).toBe(1500);
    expect(opened.getState().alwaysFullAnimation).toBe(true);
  });

  function sharedD20Link() {
    const sharer = createDiceController(createTestEnv({ url: page }));
    sharer.setCount(20, 1);
    sharer.removeDie(6);
    return sharer.shareLink();
  }

  /** Storage with one saved Preset holding 4d6. */
  function envWithSaved4d6(url: string) {
    const env = createTestEnv({ url: page });
    createDiceController(env).setCount(6, 4);
    return { ...env, url: new URL(url) };
  }

  it('prefers the Share link Settings over stored Settings without writing to storage', () => {
    const env = envWithSaved4d6(sharedD20Link());
    const storedBefore = env.storage.getItem(settingsStorageKey('dice'));

    const opened = createDiceController(env);
    expect(opened.getState().diceSet.groups).toEqual([{ sides: 20, count: 1 }]);
    expect(opened.getState().selectedPresetId).toBeNull();
    opened.setModifier(7);
    expect(opened.getState().diceSet.modifier).toBe(7);

    expect(env.storage.getItem(settingsStorageKey('dice'))).toBe(storedBefore);
    const reloaded = createDiceController({ ...env, url: new URL(page) });
    expect(reloaded.getState().diceSet).toEqual({ groups: [{ sides: 6, count: 4 }], modifier: 0 });
  });

  it('saves the Share link Settings as a Preset only when asked', () => {
    const env = envWithSaved4d6(sharedD20Link());
    const opened = createDiceController(env);
    opened.createPreset('From stream');

    const reloaded = createDiceController({ ...env, url: new URL(page) });
    expect(reloaded.getState().presets.map((preset) => preset.name)).toEqual(['', 'From stream']);
    expect(reloaded.getState().diceSet.groups).toEqual([{ sides: 20, count: 1 }]);
  });

  it('still opens a Share link created by this version of the site', () => {
    // Frozen copy of a v1 Share link for 2d6 + 1d20 + 3: must keep opening after future changes.
    const link =
      `${page}?s=eyJ2ZXJzaW9uIjoxLCJzZXR0aW5ncyI6eyJkaWNlU2V0Ijp7Imdyb3VwcyI6W3sic2lkZXMiOjYsImNvdW50IjoyfSx7InNpZGVzIjoyMCwiY291bnQiOjF9XSwibW9kaWZpZXIiOjN9fX0` +
      '&display=1&lang=en';
    expect(createDiceController(createTestEnv({ url: link })).getState().diceSet).toEqual({
      groups: [
        { sides: 6, count: 2 },
        { sides: 20, count: 1 },
      ],
      modifier: 3,
    });
    // Links from before the animation settings existed open with the default animation.
    expect(createDiceController(createTestEnv({ url: link })).getState()).toMatchObject({
      animationDuration: 3000,
      alwaysFullAnimation: false,
    });
  });

  it('falls back to stored Settings when the Share link is damaged', () => {
    const env = envWithSaved4d6(`${page}?s=not-base64!`);
    expect(createDiceController(env).getState().diceSet.groups).toEqual([{ sides: 6, count: 4 }]);
  });

  it('adds Display mode, transparent background and language to the Share link', () => {
    const dice = createDiceController(createTestEnv({ url: `${page}?old=1#top` }));
    const link = new URL(dice.shareLink({ display: true, transparent: true, lang: 'zh-Hant' }));

    expect(link.origin + link.pathname).toBe(page);
    expect(link.hash).toBe('');
    expect(Object.fromEntries(link.searchParams)).toMatchObject({ display: '1', transparent: '1', lang: 'zh-Hant' });
    expect(link.searchParams.has('old')).toBe(false);
    expect(Object.fromEntries(new URL(dice.shareLink()).searchParams)).not.toHaveProperty('display');
  });
});

describe('dice Settings export / import', () => {
  it('restores exported Presets and publishes them', () => {
    const source = createDiceController(createTestEnv());
    source.setModifier(4);
    source.createPreset('Fireball');
    const file = source.exportSettings();

    const dice = createDiceController(createTestEnv());
    const seen: number[] = [];
    dice.subscribe((state) => seen.push(state.diceSet.modifier));
    expect(dice.importSettings(file)).toBe(true);
    expect(dice.getState().presets.map((preset) => preset.name)).toEqual(['', 'Fireball']);
    expect(seen).toEqual([4]);
  });

  it('keeps the current Settings when the file is invalid', () => {
    const dice = createDiceController(createTestEnv());
    dice.setModifier(2);
    const before = dice.getState();
    expect(dice.importSettings('{"namespace":"timer","version":1,"presets":[{"id":"1","name":"","settings":{}}]}')).toBe(false);
    expect(dice.getState()).toBe(before);
  });
});

/** Production random source (crypto.getRandomValues) with test doubles for browser-only parts. */
function createBrowserEnvForNode() {
  return { ...createTestEnv(), randomUint32: createBrowserRandom() };
}

/** One complete roll: decide the Outcome, then report the animation finished as the view would. */
function rollAndFinish(dice: DiceController) {
  dice.roll();
  dice.finishAnimation();
}
