import { describe, expect, it } from 'vitest';
import { type Env, createBrowserRandom } from '../shared/env';
import { settingsStorageKey } from '../shared/settings';
import { createTestEnv } from '../shared/test-env';
import {
  MAX_ENTRIES,
  REDUCED_MOTION_DURATION,
  WHEEL_STATE_KEY,
  type WheelAppearance,
  type WheelController,
  type WheelState,
  animationFor,
  createWheelController,
  sectorsFor,
} from './controller';

/** The uint32 value that maps to the fraction `f` of the random range. */
const at = (f: number) => Math.floor(f * 2 ** 32);

/** A wheel holding exactly these entries (the defaults removed), built through the public actions. */
function wheelWith(env: Env, entries: { label: string; weight: number }[]): WheelController {
  const wheel = createWheelController(env);
  const defaults = wheel.getState().entries.map((entry) => entry.id);
  for (const { label, weight } of entries) {
    wheel.addEntry(label);
    const added = wheel.getState().entries.at(-1)!;
    wheel.updateEntry(added.id, { weight });
  }
  defaults.forEach((id) => wheel.removeEntry(id));
  return wheel;
}

describe('wheel controller', () => {
  it('has no Outcome before the first spin', () => {
    expect(createWheelController(createTestEnv()).getState().outcome).toBeNull();
  });

  it('decides the Outcome from the injected random source, by weight', () => {
    const wheel = wheelWith(createTestEnv({ random: [at(0.6), at(0.5)] }), [
      { label: 'Pizza', weight: 1 },
      { label: 'Sushi', weight: 1 },
      { label: 'Ramen', weight: 2 },
    ]);
    const ramen = wheel.getState().entries[2]!;

    wheel.spin();
    // Weights 1 + 1 + 2: 0.6 of the total weight falls in Ramen, whose sector is 180°–360°;
    // the pointer lands in the middle of the sector's inner 80%.
    expect(wheel.getState().outcome).toEqual({ entryId: ramen.id, label: 'Ramen', color: ramen.color, angle: 270 });
  });

  it('lands the pointer inside the winning sector, away from its borders', () => {
    const wheel = wheelWith(createTestEnv({ random: [0, 0, 2 ** 32 - 1, 2 ** 32 - 1] }), [
      { label: 'Small', weight: 1 },
      { label: 'Big', weight: 3 },
    ]);

    spinAndFinish(wheel);
    // Small spans 0°–90°; its inner 80% starts at 9°.
    expect(wheel.getState().outcome!.label).toBe('Small');
    expect(wheel.getState().outcome!.angle).toBeCloseTo(9, 6);
    wheel.spin();
    // Big spans 90°–360°; its inner 80% ends at 333°.
    expect(wheel.getState().outcome!.label).toBe('Big');
    expect(wheel.getState().outcome!.angle).toBeCloseTo(333, 2);
  });

  it('gives each entry a sector angle proportional to its weight', () => {
    const wheel = wheelWith(createTestEnv(), [
      { label: 'a', weight: 1 },
      { label: 'b', weight: 2 },
      { label: 'c', weight: 0.5 },
      { label: 'd', weight: 4.5 },
    ]);

    expect(sectorsFor(wheel.getState().entries).map(({ start, end }) => [start, end])).toEqual([
      [0, 45],
      [45, 135],
      [135, 157.5],
      [157.5, 360],
    ]);
  });

  it('opens with a few equal-weight entries in different colors', () => {
    const { entries } = createWheelController(createTestEnv()).getState();
    expect(entries.length).toBeGreaterThan(1);
    expect(entries.every((entry) => entry.weight === 1)).toBe(true);
    expect(new Set(entries.map((entry) => entry.color)).size).toBe(entries.length);
  });

  it('adds, edits and removes entries', () => {
    const wheel = wheelWith(createTestEnv(), [{ label: 'Tea', weight: 1 }]);
    wheel.addEntry('Coffee');
    const [tea, coffee] = wheel.getState().entries;
    expect(coffee).toMatchObject({ label: 'Coffee', weight: 1 });
    expect(coffee!.id).not.toBe(tea!.id);
    expect(coffee!.color).not.toBe(tea!.color);

    wheel.updateEntry(coffee!.id, { label: 'Latte', weight: 2.5, color: '#123456' });
    expect(wheel.getState().entries[1]).toEqual({ id: coffee!.id, label: 'Latte', weight: 2.5, color: '#123456' });

    wheel.removeEntry(tea!.id);
    expect(wheel.getState().entries.map((entry) => entry.label)).toEqual(['Latte']);
  });

  it('keeps at least one entry', () => {
    const wheel = wheelWith(createTestEnv(), [{ label: 'Only', weight: 1 }]);
    wheel.removeEntry(wheel.getState().entries[0]!.id);
    expect(wheel.getState().entries.map((entry) => entry.label)).toEqual(['Only']);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('ignores the non-positive or invalid weight %s', (weight) => {
    const wheel = wheelWith(createTestEnv(), [{ label: 'x', weight: 2 }]);
    wheel.updateEntry(wheel.getState().entries[0]!.id, { weight });
    expect(wheel.getState().entries[0]!.weight).toBe(2);
  });

  it('ignores invalid colors and caps the number of entries', () => {
    const wheel = createWheelController(createTestEnv());
    const first = wheel.getState().entries[0]!;
    wheel.updateEntry(first.id, { color: 'red' });
    expect(wheel.getState().entries[0]!.color).toBe(first.color);

    for (let i = 0; i < MAX_ENTRIES + 5; i++) wheel.addEntry(`n${i}`);
    expect(wheel.getState().entries).toHaveLength(MAX_ENTRIES);
  });

  it('is animating after a spin and ignores spins until the view reports the animation finished', () => {
    const wheel = wheelWith(createTestEnv({ random: [0, 0, at(0.9), 0] }), [
      { label: 'a', weight: 1 },
      { label: 'b', weight: 1 },
    ]);

    wheel.spin();
    expect(wheel.getState().animating).toBe(true);
    wheel.spin();
    expect(wheel.getState().history).toHaveLength(1);
    wheel.finishAnimation();
    expect(wheel.getState().animating).toBe(false);
    wheel.spin();
    expect(wheel.getState().outcome!.label).toBe('b');
  });

  it('keeps the 20 most recent Outcomes, newest first, and reset clears them', () => {
    // Spins alternate a, b, a, ...; the 25th (newest) lands on a.
    const random = Array.from({ length: 25 }, (_, i) => [at(i % 2 ? 0.75 : 0.25), 0]).flat();
    const wheel = wheelWith(createTestEnv({ random }), [
      { label: 'a', weight: 1 },
      { label: 'b', weight: 1 },
    ]);
    for (let i = 0; i < 25; i++) spinAndFinish(wheel);

    const { history } = wheel.getState();
    expect(history).toHaveLength(20);
    expect(history.slice(0, 2).map((outcome) => outcome.label)).toEqual(['a', 'b']);
    wheel.reset();
    expect(wheel.getState()).toMatchObject({ outcome: null, history: [] });
    expect(wheel.getState().entries).toHaveLength(2);
  });

  it('keeps the Outcome label as it was when spun after the entry is edited', () => {
    const wheel = wheelWith(createTestEnv({ random: [0, 0] }), [{ label: 'Old', weight: 1 }]);
    spinAndFinish(wheel);
    wheel.updateEntry(wheel.getState().entries[0]!.id, { label: 'New' });
    expect(wheel.getState().history[0]!.label).toBe('Old');
  });

  it('shortens the animation under reduced motion unless overridden', () => {
    const wheel = createWheelController(createTestEnv());
    wheel.setAnimationDuration(8000);
    expect(animationFor(wheel.getState(), false)).toEqual({ duration: 8000, reduced: false });
    expect(animationFor(wheel.getState(), true)).toEqual({ duration: REDUCED_MOTION_DURATION, reduced: true });
    wheel.setAlwaysFullAnimation(true);
    expect(animationFor(wheel.getState(), true)).toEqual({ duration: 8000, reduced: false });
    wheel.setAnimationDuration(20_000);
    expect(wheel.getState().animationDuration).toBe(8000);
  });
});

describe('wheel fairness', () => {
  it('picks entries in proportion to their weights (chi-square, real random source)', () => {
    const weights = [1, 2, 3, 4];
    const env = { ...createTestEnv(), randomUint32: createBrowserRandom() };
    const wheel = wheelWith(
      env,
      weights.map((weight) => ({ label: String(weight), weight })),
    );
    const spins = 20_000;
    const counts = new Map(weights.map((weight) => [String(weight), 0]));
    for (let i = 0; i < spins; i++) {
      spinAndFinish(wheel);
      const { label } = wheel.getState().outcome!;
      counts.set(label, counts.get(label)! + 1);
    }

    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const chiSquare = weights.reduce((sum, weight) => {
      const expected = (spins * weight) / total;
      return sum + (counts.get(String(weight))! - expected) ** 2 / expected;
    }, 0);
    // df = 3, p = 0.001.
    expect(chiSquare).toBeLessThan(16.266);
  });
});

describe('wheel Settings, Presets and Share link', () => {
  const page = 'https://example.test/MyWidgetBox/wheel/';
  const custom: WheelAppearance = {
    background: { kind: 'solid', color: '#102030', imageUrl: '' },
    fontFamily: 'Georgia, serif',
    fontSize: 28,
    textColor: '#eeeeee',
    scale: 1.25,
    labelColor: '#000000',
    pointerColor: '#ff0000',
  };

  function customized(env: Env) {
    const wheel = wheelWith(env, [
      { label: '今晚吃什麼', weight: 3 },
      { label: 'Sushi', weight: 0.5 },
    ]);
    wheel.setAppearance(custom);
    wheel.setAnimationDuration(2500);
    return wheel;
  }

  const settingsOf = ({ entries, appearance, animationDuration, alwaysFullAnimation }: WheelState) => ({
    entries,
    appearance,
    animationDuration,
    alwaysFullAnimation,
  });

  it('remembers entries, appearance and animation after a reload', () => {
    const env = createTestEnv();
    const before = customized(env);
    expect(settingsOf(createWheelController(env).getState())).toEqual(settingsOf(before.getState()));
    expect(createWheelController(env).getState().appearance).toEqual(custom);
  });

  it('keeps entries per Preset', () => {
    const wheel = createWheelController(createTestEnv());
    const first = wheel.getState().selectedPresetId!;
    const defaults = wheel.getState().entries;
    wheel.createPreset('Viewers');
    wheel.addEntry('alice');

    wheel.selectPreset(first);
    expect(wheel.getState().entries).toEqual(defaults);
  });

  it('opens with defaults when stored Settings are unreadable or invalid', () => {
    const env = createTestEnv();
    const defaults = createWheelController(createTestEnv()).getState().entries;
    env.storage.setItem(
      settingsStorageKey('wheel'),
      JSON.stringify({
        version: 1,
        selectedPresetId: '1',
        presets: [{ id: '1', name: 'Bad', settings: { entries: [{ id: '1', label: 'x', weight: -1, color: '#000000' }] } }],
      }),
    );
    expect(createWheelController(env).getState().entries).toEqual(defaults);
    env.storage.setItem(settingsStorageKey('wheel'), '{not json');
    expect(createWheelController(env).getState().entries).toEqual(defaults);
  });

  it('opens a Share link with the same Settings, without writing them to storage', () => {
    const sharer = customized(createTestEnv({ url: page }));
    const env = createTestEnv({ url: sharer.shareLink({ display: true }) });

    const opened = createWheelController(env);
    expect(settingsOf(opened.getState())).toEqual(settingsOf(sharer.getState()));
    expect(opened.getState().selectedPresetId).toBeNull();
    opened.addEntry('more');
    expect(env.storage.getItem(settingsStorageKey('wheel'))).toBeNull();
  });

  it('round-trips Settings through export and import', () => {
    const source = customized(createTestEnv());
    const target = createWheelController(createTestEnv());
    expect(target.importSettings(source.exportSettings())).toBe(true);
    expect(settingsOf(target.getState())).toEqual(settingsOf(source.getState()));
    expect(target.importSettings('{"namespace":"dice"}')).toBe(false);
  });
});

describe('wheel remove after draw', () => {

  it('takes a drawn entry off the wheel once its spin is revealed, so it cannot be drawn again', () => {
    // Weights 1 + 1 + 1: 0.5 falls in b; then with b gone (a + c), 0.5 falls in c.
    const wheel = wheelWith(createTestEnv({ random: [at(0.5), at(0.5), at(0.5), at(0.5)] }), [
      { label: 'a', weight: 1 },
      { label: 'b', weight: 1 },
      { label: 'c', weight: 1 },
    ]);
    wheel.setRemoveAfterDraw(true);

    wheel.spin();
    // The wheel keeps the drawn sector until the animation has landed on it.
    expect(labels(wheel.getState().remainingEntries)).toEqual(['a', 'b', 'c']);
    wheel.finishAnimation();
    expect(wheel.getState().outcome!.label).toBe('b');
    expect(labels(wheel.getState().remainingEntries)).toEqual(['a', 'c']);
    expect(wheel.getState().drawnEntryIds).toEqual([wheel.getState().entries[1]!.id]);
    // The Settings keep every entry; only the State marks b as drawn.
    expect(labels(wheel.getState().entries)).toEqual(['a', 'b', 'c']);

    spinAndFinish(wheel);
    expect(wheel.getState().outcome!.label).toBe('c');
    expect(labels(wheel.getState().remainingEntries)).toEqual(['a']);
  });

  it('reports when every entry has been drawn, ignores spins then, and reset restores the full wheel', () => {
    const wheel = wheelWith(createTestEnv({ random: [0, 0, 0, 0, 0, 0] }), [
      { label: 'a', weight: 1 },
      { label: 'b', weight: 1 },
    ]);
    wheel.setRemoveAfterDraw(true);
    spinAndFinish(wheel);
    expect(wheel.getState().allDrawn).toBe(false);
    spinAndFinish(wheel);
    expect(wheel.getState()).toMatchObject({ allDrawn: true, remainingEntries: [] });

    wheel.spin();
    expect(wheel.getState()).toMatchObject({ animating: false, history: [{ label: 'b' }, { label: 'a' }] });

    wheel.reset();
    expect(wheel.getState()).toMatchObject({ allDrawn: false, drawnEntryIds: [], outcome: null, history: [] });
    expect(labels(wheel.getState().remainingEntries)).toEqual(['a', 'b']);
    spinAndFinish(wheel);
    expect(wheel.getState().outcome!.label).toBe('a');
  });

  it('becomes spinnable again when an entry is added after everything was drawn', () => {
    const wheel = wheelWith(createTestEnv({ random: [0, 0, 0, 0] }), [{ label: 'a', weight: 1 }]);
    wheel.setRemoveAfterDraw(true);
    spinAndFinish(wheel);
    expect(wheel.getState().allDrawn).toBe(true);
    wheel.addEntry('late');
    expect(wheel.getState().allDrawn).toBe(false);
    spinAndFinish(wheel);
    expect(wheel.getState().outcome!.label).toBe('late');
  });

  it('leaves the wheel whole and records nothing while the toggle is off', () => {
    const wheel = wheelWith(createTestEnv({ random: [0, 0, 0, 0] }), [
      { label: 'a', weight: 1 },
      { label: 'b', weight: 1 },
    ]);
    spinAndFinish(wheel);
    spinAndFinish(wheel);
    expect(wheel.getState()).toMatchObject({ drawnEntryIds: [], allDrawn: false });
    expect(wheel.getState().history.map((outcome) => outcome.label)).toEqual(['a', 'a']);
  });

  it('drops a deleted entry from the drawn State; edited entries stay drawn', () => {
    const wheel = wheelWith(createTestEnv({ random: [0, 0, at(0.9), 0] }), [
      { label: 'a', weight: 1 },
      { label: 'b', weight: 1 },
      { label: 'c', weight: 1 },
    ]);
    wheel.setRemoveAfterDraw(true);
    const [a, b, c] = wheel.getState().entries;
    spinAndFinish(wheel);
    spinAndFinish(wheel);
    expect(wheel.getState().drawnEntryIds).toEqual([a!.id, c!.id]);

    wheel.updateEntry(a!.id, { label: 'A', weight: 5 });
    wheel.removeEntry(c!.id);
    expect(wheel.getState().drawnEntryIds).toEqual([a!.id]);
    expect(labels(wheel.getState().remainingEntries)).toEqual(['b']);
    // A new entry may reuse the deleted entry's id; it must start undrawn.
    wheel.addEntry('d');
    expect(labels(wheel.getState().remainingEntries)).toEqual(['b', 'd']);
    expect(wheel.getState().remainingEntries[0]).toBe(b);
  });

  it('keeps the drawn entries after a reload', () => {
    const env = createTestEnv({ random: [at(0.5), 0] });
    const wheel = wheelWith(env, [
      { label: 'a', weight: 1 },
      { label: 'b', weight: 1 },
    ]);
    wheel.setRemoveAfterDraw(true);
    spinAndFinish(wheel);

    const reloaded = createWheelController(env);
    expect(reloaded.getState()).toMatchObject({ removeAfterDraw: true, drawnEntryIds: wheel.getState().drawnEntryIds });
    expect(labels(reloaded.getState().remainingEntries)).toEqual(['a']);
    reloaded.reset();
    expect(labels(createWheelController(env).getState().remainingEntries)).toEqual(['a', 'b']);
  });

  it('opens with nothing drawn when the stored State is unreadable', () => {
    const env = createTestEnv();
    env.storage.setItem(WHEEL_STATE_KEY, '{not json');
    expect(createWheelController(env).getState().drawnEntryIds).toEqual([]);
  });

  it('shares the toggle but not the drawn entries', () => {
    const page = 'https://example.test/MyWidgetBox/wheel/';
    const sharer = wheelWith(createTestEnv({ url: page, random: [0, 0] }), [
      { label: 'a', weight: 1 },
      { label: 'b', weight: 1 },
    ]);
    sharer.setRemoveAfterDraw(true);
    spinAndFinish(sharer);

    const opened = createWheelController(createTestEnv({ url: sharer.shareLink() }));
    expect(opened.getState()).toMatchObject({ removeAfterDraw: true, drawnEntryIds: [], allDrawn: false });
    expect(labels(opened.getState().remainingEntries)).toEqual(['a', 'b']);
  });

  it('remembers and shares the sound Settings, ignoring invalid ones', () => {
    const page = 'https://example.test/MyWidgetBox/wheel/';
    const env = createTestEnv({ url: page });
    const wheel = createWheelController(env);
    wheel.setSound({ volume: 0.3, url: 'https://example.test/tick.mp3' });
    wheel.setSound({ volume: 2 });
    wheel.setSound({ url: 'ftp://example.test/tick.mp3' });
    const expected = { enabled: true, volume: 0.3, url: 'https://example.test/tick.mp3' };
    expect(wheel.getState().sound).toEqual(expected);
    expect(createWheelController(env).getState().sound).toEqual(expected);
    expect(createWheelController(createTestEnv({ url: wheel.shareLink() })).getState().sound).toEqual(expected);
  });
});

describe('wheel drawn State scope', () => {
  const twoEntries = [
    { label: 'a', weight: 1 },
    { label: 'b', weight: 1 },
  ];

  it('keeps the drawn entries per Preset', () => {
    const env = createTestEnv({ random: [0, 0] });
    const wheel = wheelWith(env, twoEntries);
    wheel.setRemoveAfterDraw(true);
    const first = wheel.getState().selectedPresetId!;
    spinAndFinish(wheel);
    expect(labels(wheel.getState().remainingEntries)).toEqual(['b']);

    wheel.createPreset('Copy');
    expect(wheel.getState()).toMatchObject({ drawnEntryIds: [], allDrawn: false });
    expect(labels(wheel.getState().remainingEntries)).toEqual(['a', 'b']);
    wheel.selectPreset(first);
    expect(labels(wheel.getState().remainingEntries)).toEqual(['b']);
  });

  it("a Share link opened in the same browser does not show the stored Preset's draws", () => {
    const env = createTestEnv({ random: [0, 0] });
    const wheel = wheelWith(env, twoEntries);
    wheel.setRemoveAfterDraw(true);
    spinAndFinish(wheel);
    const opened = createWheelController({ ...env, url: new URL(wheel.shareLink()) });
    expect(opened.getState()).toMatchObject({ drawnEntryIds: [], selectedPresetId: null });
  });

  it('keeps draws stored before they were kept per Preset', () => {
    const env = createTestEnv();
    env.storage.setItem(WHEEL_STATE_KEY, JSON.stringify({ version: 1, drawn: ['2'] }));
    const wheel = createWheelController(env);
    wheel.setRemoveAfterDraw(true);
    expect(wheel.getState().drawnEntryIds).toEqual(['2']);
  });

  it('a tab picks up draws made in another tab', () => {
    const env = createTestEnv({ random: [0, 0] });
    const wheel = wheelWith(env, twoEntries);
    wheel.setRemoveAfterDraw(true);
    const otherTab = createTestEnv({ storage: env.storage });
    const other = createWheelController(otherTab);
    spinAndFinish(wheel);
    otherTab.notifyStorageChange(WHEEL_STATE_KEY);
    expect(labels(other.getState().remainingEntries)).toEqual(['b']);
  });

  it("tabs do not overwrite each other's draws", () => {
    const env = createTestEnv({ random: [0, 0] });
    const wheel = wheelWith(env, twoEntries);
    wheel.setRemoveAfterDraw(true);
    const other = createWheelController({ ...createTestEnv({ storage: env.storage }), randomUint32: () => at(0.9) });
    spinAndFinish(wheel);
    // The other tab has not heard of the first draw when it records its own.
    spinAndFinish(other);
    expect(createWheelController(env).getState().allDrawn).toBe(true);
  });
});

describe('wheel while spinning', () => {
  it('ignores entry edits, the remove-after-draw toggle, Preset changes and imports until the spin ends', () => {
    const env = createTestEnv({ random: [0, 0] });
    const wheel = wheelWith(env, [
      { label: 'a', weight: 1 },
      { label: 'b', weight: 1 },
    ]);
    const file = wheel.exportSettings();
    const first = wheel.getState().selectedPresetId!;
    wheel.createPreset('Other');
    const other = wheel.getState().selectedPresetId!;
    const [a, b] = wheel.getState().entries;

    wheel.spin();
    const before = wheel.getState();
    wheel.addEntry('c');
    wheel.updateEntry(a!.id, { label: 'A', weight: 9 });
    wheel.removeEntry(b!.id);
    wheel.setRemoveAfterDraw(true);
    wheel.selectPreset(first);
    wheel.deletePreset(other);
    wheel.createPreset('Third');
    expect(wheel.importSettings(file)).toBe(false);
    expect(wheel.getState()).toMatchObject({
      entries: before.entries,
      removeAfterDraw: false,
      selectedPresetId: other,
      presets: before.presets,
      animating: true,
    });

    wheel.finishAnimation();
    wheel.addEntry('c');
    expect(labels(wheel.getState().entries)).toEqual(['a', 'b', 'c']);
  });
});

function spinAndFinish(wheel: WheelController) {
  wheel.spin();
  wheel.finishAnimation();
}

function labels(entries: { label: string }[]) {
  return entries.map((entry) => entry.label);
}
