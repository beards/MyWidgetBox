import { describe, expect, it } from 'vitest';
import { type Env, createBrowserRandom } from '../shared/env';
import { settingsStorageKey } from '../shared/settings';
import { createShareLink } from '../shared/share-link';
import { createTestEnv } from '../shared/test-env';
import {
  DIE_SIDES,
  type DiceAppearance,
  type DiceController,
  type DieSides,
  TABLE_FINISHES,
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

  it('plays the full animation by default', () => {
    const dice = createDiceController(createTestEnv());
    expect(dice.getState()).toMatchObject({ skipAnimation: false, alwaysFullAnimation: false });
    expect(animationFor(dice.getState(), false)).toBe('full');
  });

  it('shows a quick reveal when the system asks for reduced motion', () => {
    const dice = createDiceController(createTestEnv());
    expect(animationFor(dice.getState(), true)).toBe('reduced');
  });

  it('can be overridden to always play the full animation', () => {
    const dice = createDiceController(createTestEnv());
    dice.setAlwaysFullAnimation(true);
    expect(animationFor(dice.getState(), true)).toBe('full');
  });

  it('skipping the animation wins over reduced motion and the full-animation override', () => {
    const dice = createDiceController(createTestEnv());
    dice.setSkipAnimation(true);
    expect(animationFor(dice.getState(), false)).toBe('skip');
    expect(animationFor(dice.getState(), true)).toBe('skip');
    dice.setAlwaysFullAnimation(true);
    expect(animationFor(dice.getState(), true)).toBe('skip');
  });

  it('with the animation skipped, a roll is finished at once', () => {
    const dice = createDiceController(createTestEnv({ random: [2, 4] }));
    dice.setSkipAnimation(true);

    dice.roll();
    expect(dice.getState().animating).toBe(false);
    expect(dice.getState().outcome!.total).toBe(3);
    dice.roll();
    expect(dice.getState().history.map((outcome) => outcome.total)).toEqual([5, 3]);
  });

  it('has sound on at a moderate volume with the built-in sound by default', () => {
    const dice = createDiceController(createTestEnv());
    expect(dice.getState().sound).toEqual({ enabled: true, volume: 0.7, url: '' });
  });

  it('can turn sound off, change the volume and use a custom sound URL', () => {
    const dice = createDiceController(createTestEnv());
    dice.setSound({ enabled: false });
    dice.setSound({ volume: 0.25 });
    dice.setSound({ url: 'https://example.test/clack.mp3' });
    expect(dice.getState().sound).toEqual({ enabled: false, volume: 0.25, url: 'https://example.test/clack.mp3' });
  });

  it('ignores invalid sound changes', () => {
    const dice = createDiceController(createTestEnv());
    dice.setSound({ volume: 2 });
    dice.setSound({ url: 'javascript:alert(1)' });
    expect(dice.getState().sound).toEqual({ enabled: true, volume: 0.7, url: '' });
  });

  it('has shake-to-roll off by default and remembers it after a reload', () => {
    const env = createTestEnv();
    const before = createDiceController(env);
    expect(before.getState().shakeToRoll).toBe(false);

    before.setShakeToRoll(true);
    expect(createDiceController(env).getState().shakeToRoll).toBe(true);
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

  // A seeded pseudo-random stream makes these deterministic: they check the mapping from
  // uint32 to faces (rejection sampling) is unbiased, and can never fail at random in CI.
  it.each(DIE_SIDES)('produces uniformly distributed d%i Outcomes from a uniform random source', (sides) => {
    const counts = rollCounts(sides, createTestEnv({ seed: sides }));
    expect(chiSquare(counts)).toBeLessThan(CRITICAL_VALUES[sides]);
  });

  it('rolls fair d6 Outcomes with the production random source (smoke test)', () => {
    // p = 1e-6 for 5 degrees of freedom: a fair source fails this about once in a million runs.
    expect(chiSquare(rollCounts(6, createBrowserEnvForNode()))).toBeLessThan(35.888);
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

  it('remembers the skip and full-animation options after a reload', () => {
    const env = createTestEnv();
    const before = createDiceController(env);
    before.setSkipAnimation(true);
    before.setAlwaysFullAnimation(true);

    const after = createDiceController(env);
    expect(after.getState().skipAnimation).toBe(true);
    expect(after.getState().alwaysFullAnimation).toBe(true);
  });

  it('opens a Preset stored with the former animation length, dropping the length', () => {
    const env = createTestEnv();
    env.storage.setItem(
      settingsStorageKey('dice'),
      JSON.stringify({
        version: 1,
        presets: [
          {
            id: '1',
            name: 'Old',
            settings: { diceSet: { groups: [{ sides: 20, count: 2 }], modifier: 1 }, animation: { duration: 6500, alwaysFull: true } },
          },
        ],
        selectedPresetId: '1',
      }),
    );

    const dice = createDiceController(env);
    expect(dice.getState().diceSet).toEqual({ groups: [{ sides: 20, count: 2 }], modifier: 1 });
    expect(dice.getState()).toMatchObject({ skipAnimation: false, alwaysFullAnimation: true });
    expect(dice.getState()).not.toHaveProperty('animationDuration');
    dice.setModifier(2);
    expect(JSON.parse(env.storage.getItem(settingsStorageKey('dice'))!).presets[0].settings.animation).toEqual({
      skip: false,
      alwaysFull: true,
    });
  });

  it('remembers sound settings after a reload and per Preset', () => {
    const env = createTestEnv();
    const before = createDiceController(env);
    const first = before.getState().selectedPresetId!;
    before.setSound({ volume: 0.3, url: 'https://example.test/clack.mp3' });
    before.createPreset('Quiet');
    before.setSound({ enabled: false });

    const after = createDiceController(env);
    expect(after.getState().sound.enabled).toBe(false);
    after.selectPreset(first);
    expect(after.getState().sound).toEqual({ enabled: true, volume: 0.3, url: 'https://example.test/clack.mp3' });
  });

  it('keeps animation settings per Preset', () => {
    const dice = createDiceController(createTestEnv());
    const first = dice.getState().selectedPresetId!;
    dice.createPreset('Instant');
    dice.setSkipAnimation(true);

    dice.selectPreset(first);
    expect(dice.getState().skipAnimation).toBe(false);
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

describe('dice appearance Settings', () => {
  const custom: DiceAppearance = {
    background: { kind: 'image', color: '#102030', imageUrl: 'https://example.test/bg.png' },
    fontFamily: 'Georgia, serif',
    fontSize: 32,
    textColor: '#eeeeee',
    scale: 1.5,
    dieColor: '#ff0000',
    pipColor: '#00ff00',
    tableColor: '#5a3a20',
    tableFinish: 'wood',
    tableBounce: 0.9,
  };

  it('opens with a solid white background, ivory dice with dark pips on a green felt table and no scaling', () => {
    expect(createDiceController(createTestEnv()).getState().appearance).toEqual({
      background: { kind: 'solid', color: '#ffffff', imageUrl: '' },
      fontFamily: '',
      fontSize: 20,
      textColor: '#222222',
      scale: 1,
      dieColor: '#f7f3e8',
      pipColor: '#1f1f1f',
      tableColor: '#2e6b4f',
      tableFinish: 'felt',
      tableBounce: 0.6,
    });
  });

  it.each(TABLE_FINISHES)('offers a %s table finish', (tableFinish) => {
    const dice = createDiceController(createTestEnv());
    dice.setAppearance({ ...custom, tableFinish });
    expect(dice.getState().appearance.tableFinish).toBe(tableFinish);
  });

  it('applies a new appearance and notifies subscribers', () => {
    const dice = createDiceController(createTestEnv());
    const seen: unknown[] = [];
    dice.subscribe((state) => seen.push(state.appearance));

    dice.setAppearance(custom);
    expect(dice.getState().appearance).toEqual(custom);
    expect(seen).toEqual([custom]);
  });

  it('keeps the appearance after a reload', () => {
    const env = createTestEnv();
    createDiceController(env).setAppearance(custom);
    expect(createDiceController(env).getState().appearance).toEqual(custom);
  });

  it('saves the appearance with each Preset', () => {
    const dice = createDiceController(createTestEnv());
    const first = dice.getState().selectedPresetId!;
    const defaults = dice.getState().appearance;
    dice.createPreset('Stream');
    const stream = dice.getState().selectedPresetId!;
    dice.setAppearance(custom);

    dice.selectPreset(first);
    expect(dice.getState().appearance).toEqual(defaults);
    dice.selectPreset(stream);
    expect(dice.getState().appearance).toEqual(custom);
  });

  it.each([
    ['an unknown background kind', { background: { ...custom.background, kind: 'video' } }],
    ['a background color that is not #rrggbb', { background: { ...custom.background, color: 'red' } }],
    ['a non-http image URL', { background: { ...custom.background, imageUrl: 'javascript:alert(1)' } }],
    ['a relative image URL', { background: { ...custom.background, imageUrl: 'bg.png' } }],
    ['a font size below the minimum', { fontSize: 2 }],
    ['a font size that is not a number', { fontSize: '20px' }],
    ['a text color that is not #rrggbb', { textColor: 'white' }],
    ['a scale above the maximum', { scale: 10 }],
    ['a scale of zero', { scale: 0 }],
    ['an overlong font family', { fontFamily: 'x'.repeat(201) }],
    ['a die color that is not #rrggbb', { dieColor: '#fff' }],
    ['a missing pip color', { pipColor: undefined }],
    ['a table color that is not #rrggbb', { tableColor: 'green' }],
    ['an unknown table finish', { tableFinish: 'glass' }],
    ['a table bounce above the maximum', { tableBounce: 1.55 }],
    ['a negative table bounce', { tableBounce: -0.1 }],
    ['a table bounce that is not a number', { tableBounce: '0.5' }],
  ])('ignores an appearance with %s', (_, change) => {
    const dice = createDiceController(createTestEnv());
    dice.setAppearance(custom);

    dice.setAppearance({ ...custom, ...change } as unknown as DiceAppearance);
    expect(dice.getState().appearance).toEqual(custom);
  });

  it('accepts a transparent background and an empty image URL', () => {
    const dice = createDiceController(createTestEnv());
    const transparent = { ...custom, background: { kind: 'transparent', color: '#000000', imageUrl: '' } } as const;

    dice.setAppearance(transparent);
    expect(dice.getState().appearance).toEqual(transparent);
  });

  it('gives Settings saved before appearance existed the default appearance', () => {
    const env = createTestEnv();
    env.storage.setItem(
      settingsStorageKey('dice'),
      JSON.stringify({
        version: 1,
        selectedPresetId: '1',
        presets: [{ id: '1', name: 'Old', settings: { diceSet: { groups: [{ sides: 20, count: 2 }], modifier: 1 } } }],
      }),
    );

    const { diceSet, appearance } = createDiceController(env).getState();
    expect(diceSet).toEqual({ groups: [{ sides: 20, count: 2 }], modifier: 1 });
    expect(appearance).toEqual(createDiceController(createTestEnv()).getState().appearance);
  });

  it('fills appearance items added later from defaults, keeping the stored ones', () => {
    const env = createTestEnv();
    const partial: Partial<DiceAppearance> = { ...custom };
    delete partial.scale;
    delete partial.pipColor;
    delete partial.tableColor;
    delete partial.tableFinish;
    delete partial.tableBounce;
    env.storage.setItem(
      settingsStorageKey('dice'),
      JSON.stringify({
        version: 1,
        selectedPresetId: '1',
        presets: [{ id: '1', name: '', settings: { diceSet: { groups: [{ sides: 6, count: 1 }], modifier: 0 }, appearance: partial } }],
      }),
    );

    expect(createDiceController(env).getState().appearance).toEqual({
      ...custom,
      scale: 1,
      pipColor: '#1f1f1f',
      tableColor: '#2e6b4f',
      tableFinish: 'felt',
      tableBounce: 0.6,
    });
  });

  it('opens a Share link with the same appearance, without writing it to storage', () => {
    const sharer = createDiceController(createTestEnv({ url: 'https://example.test/dice/' }));
    sharer.setAppearance(custom);

    const viewerEnv = createTestEnv({ url: sharer.shareLink() });
    const viewer = createDiceController(viewerEnv);
    expect(viewer.getState().appearance).toEqual(custom);
    expect(viewer.getState().selectedPresetId).toBeNull();
    viewer.setAppearance({ ...custom, scale: 2 });
    expect(viewerEnv.storage.getItem(settingsStorageKey('dice'))).toBeNull();
  });

  it('falls back to the stored appearance when a Share link carries an invalid one', () => {
    const page = new URL('https://example.test/dice/');
    const invalid = { version: 1, settings: { appearance: { ...custom, scale: 99 } } };
    const env = { ...createTestEnv(), url: new URL(createShareLink(page, invalid)) };
    createDiceController({ ...env, url: page }).setAppearance(custom);

    expect(createDiceController(env).getState().appearance).toEqual(custom);
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
    sharer.setSkipAnimation(true);
    sharer.setAlwaysFullAnimation(true);

    const opened = createDiceController(createTestEnv({ url: sharer.shareLink() }));
    expect(opened.getState().skipAnimation).toBe(true);
    expect(opened.getState().alwaysFullAnimation).toBe(true);
  });

  it('carries the sound settings in a Share link', () => {
    const sharer = createDiceController(createTestEnv({ url: page }));
    sharer.setSound({ enabled: false, volume: 0.4, url: 'https://example.test/clack.mp3' });

    const opened = createDiceController(createTestEnv({ url: sharer.shareLink() }));
    expect(opened.getState().sound).toEqual({ enabled: false, volume: 0.4, url: 'https://example.test/clack.mp3' });
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
      skipAnimation: false,
      alwaysFullAnimation: false,
    });
    // ...and links from before the table existed with the default table.
    expect(createDiceController(createTestEnv({ url: link })).getState().appearance).toMatchObject({
      tableColor: '#2e6b4f',
      tableFinish: 'felt',
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

/** How often each face of one d`sides` came up in 2000 * sides rolls. */
function rollCounts(sides: DieSides, env: Env): number[] {
  const dice = createDiceController(env);
  dice.addDie(sides);
  if (sides !== 6) dice.removeDie(6);
  const counts = new Array<number>(sides).fill(0);
  for (let i = 0; i < 2_000 * sides; i++) {
    rollAndFinish(dice);
    counts[dice.getState().outcome!.rolls[0]!.value - 1]!++;
  }
  return counts;
}

/** Pearson's chi-square statistic of counts against a uniform expectation. */
function chiSquare(counts: number[]): number {
  const expected = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  return counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
}

/** One complete roll: decide the Outcome, then report the animation finished as the view would. */
function rollAndFinish(dice: DiceController) {
  dice.roll();
  dice.finishAnimation();
}
