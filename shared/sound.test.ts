import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type SoundOutput, createSoundPlayer, isSoundSettings, soundDefaults } from './sound';

function createRecordingOutput() {
  const played: { sound: string; volume: number }[] = [];
  const output: SoundOutput = {
    play: (sound, volume, url) => void played.push({ sound: url || sound, volume }),
  };
  return { output, played };
}

describe('sound player', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays the built-in sound at the chosen volume', () => {
    const { output, played } = createRecordingOutput();
    createSoundPlayer(output).play('diceLand', { ...soundDefaults, volume: 0.5 });
    expect(played).toEqual([{ sound: 'diceLand', volume: 0.5 }]);
  });

  it('plays the custom sound URL instead of the built-in one', () => {
    const { output, played } = createRecordingOutput();
    createSoundPlayer(output).play('diceLand', { ...soundDefaults, url: 'https://example.test/clack.mp3' });
    expect(played.map((entry) => entry.sound)).toEqual(['https://example.test/clack.mp3']);
  });

  it('stays silent when sound is off or the volume is zero', () => {
    const { output, played } = createRecordingOutput();
    const player = createSoundPlayer(output);
    player.play('tick', { ...soundDefaults, enabled: false });
    player.play('tick', { ...soundDefaults, volume: 0 });
    player.repeat('alert', { ...soundDefaults, enabled: false }, { interval: 100, duration: 1000 });
    vi.advanceTimersByTime(2000);
    expect(played).toEqual([]);
  });

  it('never throws when the output fails (e.g. blocked by autoplay rules)', () => {
    const player = createSoundPlayer({
      play: () => {
        throw new Error('NotAllowedError');
      },
    });
    expect(() => player.play('diceLand', soundDefaults)).not.toThrow();
  });

  it('repeats a sound every interval for the given duration', () => {
    const { output, played } = createRecordingOutput();
    createSoundPlayer(output).repeat('alert', soundDefaults, { interval: 1000, duration: 3000 });
    expect(played).toHaveLength(1);
    vi.advanceTimersByTime(10_000);
    // At 0, 1 and 2 seconds; the one due at 3 s would start after the duration ended.
    expect(played).toHaveLength(3);
  });

  it('ends a repetition by the clock, also when intervals fire late (throttled background tab)', () => {
    const { output, played } = createRecordingOutput();
    let clock = 0;
    createSoundPlayer(output, () => clock).repeat('alert', soundDefaults, { interval: 1000, duration: 3000 });
    // The tab was throttled: the first interval only runs once the duration has passed.
    clock = 5000;
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(10_000);
    expect(played).toHaveLength(1);
  });

  it('stops a repetition early', () => {
    const { output, played } = createRecordingOutput();
    const stop = createSoundPlayer(output).repeat('alert', soundDefaults, { interval: 1000, duration: 10_000 });
    vi.advanceTimersByTime(1500);
    stop();
    vi.advanceTimersByTime(10_000);
    expect(played).toHaveLength(2);
  });
});

describe('sound Settings', () => {
  it('accepts the defaults and custom http(s) URLs', () => {
    expect(isSoundSettings(soundDefaults)).toBe(true);
    expect(isSoundSettings({ ...soundDefaults, url: 'https://example.test/a.ogg' })).toBe(true);
    expect(isSoundSettings({ ...soundDefaults, url: 'http://example.test/a.ogg' })).toBe(true);
  });

  it.each([
    { enabled: 'yes' },
    { volume: -0.1 },
    { volume: 1.1 },
    { volume: Number.NaN },
    { url: 'javascript:alert(1)' },
    { url: 'not a url' },
  ])('rejects %o', (bad) => {
    expect(isSoundSettings({ ...soundDefaults, ...bad })).toBe(false);
  });
});
