// Opt-in sound module (ADR-0002). Built-in sounds are synthesized with Web Audio, so no file or network
// request is needed; a Widget may let the user replace them with a sound URL or a file from their device.
import { createStoredSoundFiles } from './sound-files';
import { isHttpUrlOrEmpty } from './url';

/** Built-in sounds: dice landing, one die hitting something (played per impact), a wheel tick, a timer alert. */
export type BuiltInSound = 'diceLand' | 'diceHit' | 'tick' | 'alert';

/** Where a custom sound comes from: a file picked from this device, or a URL. */
export const SOUND_SOURCES = ['file', 'url'] as const;
export type SoundSource = (typeof SOUND_SOURCES)[number];

/** Sound part of a Widget's Settings, e.g. `DiceSettings.sound`. */
export interface SoundSettings {
  enabled: boolean;
  /** 0 (silent) to 1 (full). */
  volume: number;
  /** Play the custom sound chosen by `source` instead of the built-in sound. */
  custom: boolean;
  source: SoundSource;
  /**
   * Id of a sound file picked from this device (see sound-files.ts), or ''. Only this browser has it:
   * elsewhere (another device, OBS opened from a Share link) `url` plays instead, if any.
   */
  file: string;
  /** http(s) URL of a sound file, or ''. */
  url: string;
}

export const soundDefaults: SoundSettings = { enabled: true, volume: 0.7, custom: false, source: 'file', file: '', url: '' };

const MAX_FILE_ID_LENGTH = 64;

export function isSoundSettings(value: unknown): value is SoundSettings {
  const { enabled, volume, custom, source, url, file } = (value ?? {}) as Partial<SoundSettings>;
  return (
    typeof enabled === 'boolean' &&
    typeof volume === 'number' &&
    volume >= 0 &&
    volume <= 1 &&
    typeof custom === 'boolean' &&
    SOUND_SOURCES.includes(source as SoundSource) &&
    isHttpUrlOrEmpty(url) &&
    typeof file === 'string' &&
    file.length <= MAX_FILE_ID_LENGTH
  );
}

/** Sound files picked from this device, by id. */
export interface SoundFileSource {
  /** A URL playing the file, or null while it is still loading or when this browser does not have it. */
  urlOf(id: string): string | null;
}

/** Where sounds actually come out; the Web Audio one is the default, tests pass a recording one. */
export interface SoundOutput {
  /**
   * Plays `url` if it is not '', with `sound` as the fallback when the file cannot be played.
   * A file is one voice: playing it again restarts it instead of layering another copy.
   */
  play(sound: BuiltInSound, volume: number, url: string): void;
  /** Plays the file at `url` over and over until stop(url); calls `failed` if it cannot be played. */
  loop(url: string, volume: number, failed: () => void): void;
  /** Stops the file at `url` if it is playing (built-in sounds are short and play out). */
  stop(url: string): void;
  /** Starts loading the file at `url`, so its first play is on time. */
  preload(url: string): void;
}

export interface SoundPlayer {
  /** Plays once with these Settings; silent when they turn sound off. Never throws (nor do the others). */
  play(sound: BuiltInSound, settings: SoundSettings): void;
  /**
   * Loops the custom sound file of these Settings until the returned function is called (e.g. while
   * the wheel turns). Does nothing without a file or with sound off; calls `failed` when the file
   * cannot be played, so the caller can use the built-in sound instead.
   */
  loop(settings: SoundSettings, failed: () => void): () => void;
  /** Loads the custom sound file of these Settings ahead of its first play; call it whenever they may have changed. */
  preload(settings: SoundSettings): void;
  /**
   * Sounds for `duration` ms on the clock (e.g. a timer alert): a custom file loops, the built-in sound
   * (also when the file cannot be played) plays now and then every `interval` ms. Returns a function
   * that stops it early.
   */
  repeat(sound: BuiltInSound, settings: SoundSettings, timing: { interval: number; duration: number }): () => void;
  /** Stops the custom sound file of these Settings if it is still playing (e.g. the wheel has stopped). */
  stop(settings: SoundSettings): void;
  /** Whether a custom sound file (picked here, or from the URL) plays with these Settings rather than the built-in sound. */
  hasFile(settings: SoundSettings): boolean;
}

export interface SoundPlayerOptions {
  /** Where sounds come out; Web Audio by default. */
  output?: SoundOutput;
  /** The clock `repeat` measures its duration with. */
  now?: () => number;
  /** Files picked from this device; IndexedDB by default. */
  files?: SoundFileSource;
}

export function createSoundPlayer({
  output = createWebAudioOutput(),
  now = Date.now,
  files = createStoredSoundFiles(),
}: SoundPlayerOptions = {}): SoundPlayer {
  /** The custom sound file to play ('' = the built-in sound); a picked file this browser lacks falls back to the URL. */
  function fileUrl({ custom, source, file, url }: SoundSettings): string {
    if (!custom) return '';
    return (source === 'file' && file && files.urlOf(file)) || url;
  }

  /** Sound is decoration: a blocked or broken output must never break the Widget. */
  function safely(action: () => void) {
    try {
      action();
    } catch {
      // Ignored on purpose.
    }
  }

  function play(sound: BuiltInSound, settings: SoundSettings) {
    if (settings.enabled && settings.volume > 0) safely(() => output.play(sound, settings.volume, fileUrl(settings)));
  }

  function loop(settings: SoundSettings, failed: () => void) {
    const url = fileUrl(settings);
    if (!settings.enabled || settings.volume <= 0 || !url) return () => {};
    safely(() => output.loop(url, settings.volume, failed));
    return () => safely(() => output.stop(url));
  }

  return {
    play,
    loop,
    stop(settings) {
      const url = fileUrl(settings);
      if (url) safely(() => output.stop(url));
    },
    hasFile: (settings) => fileUrl(settings) !== '',
    preload(settings) {
      const url = settings.enabled ? fileUrl(settings) : '';
      if (url) safely(() => output.preload(url));
    },
    repeat(sound, settings, { interval, duration }) {
      const builtIn = { ...settings, custom: false };
      let looping = fileUrl(settings) !== '';
      if (!looping) play(sound, builtIn);
      const stopFile = loop(settings, () => {
        looping = false;
        play(sound, builtIn);
      });
      // Measured by the clock, not by counting ticks: background tabs fire intervals late.
      const start = now();
      const id = setInterval(() => {
        if (now() - start >= duration) return end();
        if (!looping) play(sound, builtIn);
      }, interval);
      function end() {
        clearInterval(id);
        stopFile();
      }
      return end;
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

  /**
   * One media element per file, kept loaded: a media element plays cross-origin files without
   * CORS (unlike fetch + decodeAudioData), and reusing it means the file is fetched and decoded
   * once, so later plays start at once instead of piling up late.
   */
  const files = new Map<string, HTMLAudioElement>();
  function file(url: string) {
    let audio = files.get(url);
    if (!audio) {
      audio = new Audio(url);
      files.set(url, audio);
    }
    return audio;
  }

  /** Plays a file from the start; `failed` runs if it cannot be played. */
  function start(url: string, volume: number, loop: boolean, failed: () => void) {
    const audio = file(url);
    audio.loop = loop;
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch((error: unknown) => {
      // Only an unreachable or undecodable file fails (and is loaded afresh next time); blocked by
      // autoplay rules or cut short by stop(), it just stays silent.
      if (!audio.error && !(error instanceof DOMException && error.name === 'NotSupportedError')) return;
      files.delete(url);
      failed();
    });
  }

  return {
    play(sound, volume, url) {
      if (url) start(url, volume, false, () => synthesize(getContext(), sound, volume));
      else synthesize(getContext(), sound, volume);
    },
    loop: (url, volume, failed) => start(url, volume, true, failed),
    stop(url) {
      files.get(url)?.pause();
    },
    preload: (url) => void file(url),
  };
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
  } else if (sound === 'diceHit') {
    // One short clack with a little body.
    noiseBurst(context, out, t, 0.045, 0.9, 2400);
    tone(context, out, t, 0.06, 0.35, 190, 'sine');
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
