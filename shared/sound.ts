// Opt-in sound module (ADR-0002). Built-in sounds are synthesized with Web Audio, so no file or network
// request is needed; a Widget may let the user replace them with a sound URL.

/** Built-in sounds: dice landing, a wheel tick, a timer alert. */
export type BuiltInSound = 'diceLand' | 'tick' | 'alert';

/** Sound part of a Widget's Settings, e.g. `DiceSettings.sound`. */
export interface SoundSettings {
  enabled: boolean;
  /** 0 (silent) to 1 (full). */
  volume: number;
  /** '' plays the built-in sound; otherwise an http(s) URL of a sound file played instead. */
  url: string;
}

export const soundDefaults: SoundSettings = { enabled: true, volume: 0.7, url: '' };

export function isSoundUrl(url: unknown): url is string {
  if (url === '') return true;
  if (typeof url !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function isSoundSettings(value: unknown): value is SoundSettings {
  const { enabled, volume, url } = (value ?? {}) as Partial<SoundSettings>;
  return typeof enabled === 'boolean' && typeof volume === 'number' && volume >= 0 && volume <= 1 && isSoundUrl(url);
}

/** Where sounds actually come out; the Web Audio one is the default, tests pass a recording one. */
export interface SoundOutput {
  /** Plays `url` if it is not '', with `sound` as the fallback when the file cannot be played. */
  play(sound: BuiltInSound, volume: number, url: string): void;
}

export interface SoundPlayer {
  /** Plays once with these Settings; silent when they turn sound off. Never throws. */
  play(sound: BuiltInSound, settings: SoundSettings): void;
  /**
   * Plays now and then every `interval` ms while less than `duration` ms have passed on the clock (e.g. a timer alert).
   * Returns a function that stops it early.
   */
  repeat(sound: BuiltInSound, settings: SoundSettings, timing: { interval: number; duration: number }): () => void;
}

/** `now` is the clock `repeat` measures its duration with (injectable for tests). */
export function createSoundPlayer(output: SoundOutput = createWebAudioOutput(), now: () => number = Date.now): SoundPlayer {
  function play(sound: BuiltInSound, { enabled, volume, url }: SoundSettings) {
    if (!enabled || volume <= 0) return;
    try {
      output.play(sound, volume, url);
    } catch {
      // Sound is decoration: a blocked or broken output must never break the Widget.
    }
  }

  return {
    play,
    repeat(sound, settings, { interval, duration }) {
      // Measured by the clock, not by counting ticks: background tabs fire intervals late.
      const start = now();
      play(sound, settings);
      const id = setInterval(() => {
        if (now() - start >= duration) return clearInterval(id);
        play(sound, settings);
      }, interval);
      return () => clearInterval(id);
    },
  };
}

/**
 * Plays through one lazily created AudioContext. Browsers may keep it suspended until the user
 * interacts with the page (autoplay rules); playing then just stays silent instead of failing.
 * OBS Browser Sources allow autoplay and capture the page's audio.
 */
export function createWebAudioOutput(): SoundOutput {
  let context: AudioContext | null = null;

  function getContext() {
    context ??= new AudioContext();
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  }

  return {
    play(sound, volume, url) {
      if (url) playUrl(url, volume, () => synthesize(getContext(), sound, volume));
      else synthesize(getContext(), sound, volume);
    },
  };
}

/** A media element plays cross-origin files without CORS, unlike fetch + decodeAudioData. */
function playUrl(url: string, volume: number, fallback: () => void) {
  const audio = new Audio(url);
  audio.volume = volume;
  audio.play().catch((error: unknown) => {
    // Blocked by autoplay rules: stay silent. Unreachable or undecodable file: fall back to the built-in sound.
    if (!(error instanceof DOMException && error.name === 'NotAllowedError')) fallback();
  });
}

function synthesize(context: AudioContext, sound: BuiltInSound, volume: number) {
  const out = context.createGain();
  out.gain.value = volume;
  out.connect(context.destination);
  const t = context.currentTime;
  if (sound === 'diceLand') {
    // A hit and a smaller bounce: filtered noise clacks over a short low thud.
    noiseBurst(context, out, t, 0.06, 0.9, 2200);
    noiseBurst(context, out, t + 0.09, 0.04, 0.4, 2600);
    tone(context, out, t, 0.12, 0.5, 140, 'sine');
  } else if (sound === 'tick') {
    tone(context, out, t, 0.025, 0.6, 1800, 'square');
  } else {
    tone(context, out, t, 0.15, 0.6, 880, 'sine');
    tone(context, out, t + 0.22, 0.15, 0.6, 880, 'sine');
  }
}

/** A tone with an instant attack and exponential decay. */
function tone(
  context: AudioContext,
  out: AudioNode,
  start: number,
  length: number,
  peak: number,
  frequency: number,
  type: OscillatorType,
) {
  const oscillator = new OscillatorNode(context, { type, frequency });
  oscillator.connect(envelope(context, out, start, length, peak));
  oscillator.start(start);
  oscillator.stop(start + length);
}

function noiseBurst(context: AudioContext, out: AudioNode, start: number, length: number, peak: number, frequency: number) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = new AudioBufferSourceNode(context, { buffer });
  const filter = new BiquadFilterNode(context, { type: 'bandpass', frequency, Q: 0.8 });
  source.connect(filter).connect(envelope(context, out, start, length, peak));
  source.start(start);
}

function envelope(context: AudioContext, out: AudioNode, start: number, length: number, peak: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + length);
  gain.connect(out);
  return gain;
}
