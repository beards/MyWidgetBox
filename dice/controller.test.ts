import { describe, expect, it } from 'vitest';
import { createBrowserRandom } from '../shared/env';
import { createTestEnv } from '../shared/test-env';
import { type VersionedSettings, serializeSettings, settingsStorageKey } from '../shared/settings';
import {
  DIE_SIDES,
  type DiceAppearance,
  type DieSides,
  createDiceController,
  diceSettingsSchema,
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
    scale: 1.5,
    dieColor: '#ff0000',
    pipColor: '#00ff00',
  };

  it('opens with a solid white background, white dice with dark pips and no scaling', () => {
    expect(createDiceController(createTestEnv()).getState().appearance).toEqual({
      background: { kind: 'solid', color: '#ffffff', imageUrl: '' },
      fontFamily: '',
      fontSize: 20,
      scale: 1,
      dieColor: '#ffffff',
      pipColor: '#222222',
    });
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
    ['a scale above the maximum', { scale: 10 }],
    ['a scale of zero', { scale: 0 }],
    ['an overlong font family', { fontFamily: 'x'.repeat(201) }],
    ['a die color that is not #rrggbb', { dieColor: '#fff' }],
    ['a missing pip color', { pipColor: undefined }],
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
    env.storage.setItem(
      settingsStorageKey('dice'),
      JSON.stringify({
        version: 1,
        selectedPresetId: '1',
        presets: [{ id: '1', name: '', settings: { diceSet: { groups: [{ sides: 6, count: 1 }], modifier: 0 }, appearance: partial } }],
      }),
    );

    expect(createDiceController(env).getState().appearance).toEqual({ ...custom, scale: 1, pipColor: '#222222' });
  });

  it('opens a Share link with the same appearance, without writing it to storage', () => {
    const env = createTestEnv();
    const sharer = createDiceController(env);
    sharer.setAppearance(custom);
    const link = shareLinkFor(serializeSettings(diceSettingsSchema, { diceSet: sharer.getState().diceSet, appearance: custom }));

    const viewerEnv = createTestEnv({ url: link });
    const viewer = createDiceController(viewerEnv, { readUrl: readShareLink });
    expect(viewer.getState().appearance).toEqual(custom);
    expect(viewer.getState().selectedPresetId).toBeNull();
    viewer.setAppearance({ ...custom, scale: 2 });
    expect(viewerEnv.storage.getItem(settingsStorageKey('dice'))).toBeNull();
  });

  it('falls back to the stored appearance when a Share link carries an invalid one', () => {
    const env = createTestEnv({ url: shareLinkFor({ version: 1, settings: { appearance: { ...custom, scale: 99 } } }) });
    createDiceController({ ...env, url: new URL('https://example.test/') }).setAppearance(custom);

    expect(createDiceController(env, { readUrl: readShareLink }).getState().appearance).toEqual(custom);
  });
});

// Stand-in Share link encoding for these tests; the real one belongs to the Share link ticket.
function shareLinkFor(versioned: VersionedSettings): string {
  return `https://example.test/dice/?s=${encodeURIComponent(JSON.stringify(versioned))}`;
}

function readShareLink(url: URL): VersionedSettings | null {
  const raw = url.searchParams.get('s');
  return raw === null ? null : (JSON.parse(raw) as VersionedSettings);
}

/** Production random source (crypto.getRandomValues) with test doubles for browser-only parts. */
function createBrowserEnvForNode() {
  return { ...createTestEnv(), randomUint32: createBrowserRandom() };
}
