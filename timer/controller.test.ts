import { describe, expect, it } from 'vitest';
import type { Env } from '../shared/env';
import { createTestEnv } from '../shared/test-env';
import { MAX_DURATION, createTimerController, formatTimer, readTimer, visibleTimers } from './controller';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

function setup(options: Parameters<typeof createTestEnv>[0] = {}) {
  const env = createTestEnv({ now: 1_700_000_000_000, ...options });
  return { env, ...open(env) };
}

/** A controller on env, as a page load would create it (call again to simulate a reload). */
function open(env: Env) {
  const timer = createTimerController(env);
  const first = () => timer.getState().timers[0]!;
  return {
    timer,
    first,
    id: first().id,
    read: () => readTimer(first(), env.now()),
    shown: () => formatTimer(first(), env.now()),
  };
}

function view(timer: ReturnType<typeof createTimerController>, id: string) {
  return timer.getState().timers.find((entry) => entry.id === id)!;
}

describe('stopwatch', () => {
  it('counts up from zero while running', () => {
    const { env, timer, read, shown, id } = setup();
    timer.setMode(id, 'stopwatch');
    expect(read()).toEqual({ value: 0, status: 'idle' });
    expect(shown()).toBe('00:00');
    timer.start(id);
    env.advance(65 * SECOND + 999);
    expect(read()).toEqual({ value: 65 * SECOND + 999, status: 'running' });
    expect(shown()).toBe('01:05');
  });

  it('switches to hh:mm:ss from one hour on', () => {
    const { env, timer, shown, id } = setup();
    timer.setMode(id, 'stopwatch');
    timer.start(id);
    env.advance(HOUR - SECOND);
    expect(shown()).toBe('59:59');
    env.advance(SECOND);
    expect(shown()).toBe('01:00:00');
    env.advance(25 * HOUR + 2 * MINUTE + 3 * SECOND);
    expect(shown()).toBe('26:02:03');
  });

  it('pauses and resumes without counting the paused time', () => {
    const { env, timer, read, id } = setup();
    timer.setMode(id, 'stopwatch');
    timer.start(id);
    env.advance(10 * SECOND);
    timer.pause(id);
    env.advance(MINUTE);
    expect(read()).toEqual({ value: 10 * SECOND, status: 'paused' });
    timer.start(id);
    env.advance(5 * SECOND);
    expect(read()).toEqual({ value: 15 * SECOND, status: 'running' });
  });

  it('resets to zero, not running', () => {
    const { env, timer, read, id } = setup();
    timer.setMode(id, 'stopwatch');
    timer.start(id);
    env.advance(10 * SECOND);
    timer.reset(id);
    env.advance(10 * SECOND);
    expect(read()).toEqual({ value: 0, status: 'idle' });
  });

  it('does not run backwards when the clock is set back', () => {
    const { env, timer, read, id } = setup();
    timer.setMode(id, 'stopwatch');
    timer.start(id);
    env.advance(-MINUTE);
    expect(read().value).toBe(0);
  });
});

describe('countdown', () => {
  it('is the default mode, five minutes long', () => {
    const { first, shown } = setup();
    expect(first().mode).toBe('countdown');
    expect(shown()).toBe('05:00');
  });

  it('counts the duration down, rounding up to the second', () => {
    const { env, timer, read, shown, id } = setup();
    timer.setDuration(id, 90 * SECOND);
    timer.start(id);
    env.advance(1);
    expect(read()).toEqual({ value: 90 * SECOND - 1, status: 'running' });
    expect(shown()).toBe('01:30');
    env.advance(30 * SECOND);
    expect(shown()).toBe('01:00');
  });

  it('shows hh:mm:ss for durations of an hour or more', () => {
    const { timer, shown, id } = setup();
    timer.setDuration(id, 2 * HOUR + 5 * SECOND);
    expect(shown()).toBe('02:00:05');
  });

  it('enters the time-up state at zero and stays there', () => {
    const { env, timer, read, shown, id } = setup();
    timer.setDuration(id, 10 * SECOND);
    timer.start(id);
    env.advance(10 * SECOND - 1);
    expect(read().status).toBe('running');
    expect(shown()).toBe('00:01');
    env.advance(1);
    expect(read()).toEqual({ value: 0, status: 'timeUp' });
    expect(shown()).toBe('00:00');
    env.advance(HOUR);
    expect(read()).toEqual({ value: 0, status: 'timeUp' });
  });

  it('ignores start and pause once time is up; reset starts over', () => {
    const { env, timer, read, id } = setup();
    timer.setDuration(id, 10 * SECOND);
    timer.start(id);
    env.advance(20 * SECOND);
    timer.pause(id);
    timer.start(id);
    expect(read().status).toBe('timeUp');
    timer.reset(id);
    expect(read()).toEqual({ value: 10 * SECOND, status: 'idle' });
    timer.start(id);
    env.advance(4 * SECOND);
    expect(read()).toEqual({ value: 6 * SECOND, status: 'running' });
  });

  it('pauses and resumes', () => {
    const { env, timer, read, id } = setup();
    timer.setDuration(id, MINUTE);
    timer.start(id);
    env.advance(20 * SECOND);
    timer.pause(id);
    env.advance(HOUR);
    expect(read()).toEqual({ value: 40 * SECOND, status: 'paused' });
    timer.start(id);
    env.advance(40 * SECOND);
    expect(read().status).toBe('timeUp');
  });

  it('ignores invalid durations', () => {
    const { timer, first, id } = setup();
    for (const ms of [0, -SECOND, 1500, MAX_DURATION + SECOND, Number.NaN]) timer.setDuration(id, ms);
    expect(first().duration).toBe(5 * MINUTE);
  });

  it('changing the duration or mode resets the timer', () => {
    const { env, timer, read, id } = setup();
    timer.start(id);
    env.advance(10 * SECOND);
    timer.setDuration(id, 2 * MINUTE);
    expect(read()).toEqual({ value: 2 * MINUTE, status: 'idle' });
    timer.start(id);
    env.advance(10 * SECOND);
    timer.setMode(id, 'stopwatch');
    expect(read()).toEqual({ value: 0, status: 'idle' });
  });

  it('keeps the countdown duration while in stopwatch mode', () => {
    const { timer, first, id } = setup();
    timer.setDuration(id, 2 * MINUTE);
    timer.setMode(id, 'stopwatch');
    timer.setMode(id, 'countdown');
    expect(first().duration).toBe(2 * MINUTE);
  });
});

describe('reload', () => {
  it('a running timer carries on with the time that passed meanwhile', () => {
    const { env, timer, id } = setup();
    timer.setDuration(id, 10 * MINUTE);
    timer.start(id);
    env.advance(MINUTE);

    env.advance(30 * SECOND); // the page is closed and reopened
    const reopened = open(env);
    expect(reopened.read()).toEqual({ value: 8 * MINUTE + 30 * SECOND, status: 'running' });
    env.advance(30 * SECOND);
    expect(reopened.shown()).toBe('08:00');
  });

  it('a paused timer stays paused at the same value', () => {
    const { env, timer, id } = setup();
    timer.setMode(id, 'stopwatch');
    timer.start(id);
    env.advance(42 * SECOND);
    timer.pause(id);
    env.advance(HOUR);
    const reopened = open(env);
    expect(reopened.read()).toEqual({ value: 42 * SECOND, status: 'paused' });
    reopened.timer.start(id);
    env.advance(SECOND);
    expect(reopened.read()).toEqual({ value: 43 * SECOND, status: 'running' });
  });

  it('a countdown that ran out while closed opens as time up', () => {
    const { env, timer, id } = setup();
    timer.setDuration(id, MINUTE);
    timer.start(id);
    env.advance(2 * MINUTE);
    expect(open(env).read().status).toBe('timeUp');
  });

  it('a reset survives a reload', () => {
    const { env, timer, id } = setup();
    timer.start(id);
    env.advance(MINUTE);
    timer.reset(id);
    expect(open(env).read()).toEqual({ value: 5 * MINUTE, status: 'idle' });
  });

  it('opens idle when the stored State is corrupt', () => {
    for (const raw of ['not json', '{"version":1,"timers":{"1":{"startedAt":"x","elapsed":-1}}}', '[]']) {
      const env = createTestEnv({ now: 1000 });
      env.storage.setItem('mywidgetbox:timer:state', raw);
      expect(open(env).read()).toEqual({ value: 5 * MINUTE, status: 'idle' });
    }
  });
});

describe('Settings', () => {
  it('remembers the mode and duration across reloads', () => {
    const { env, timer, id } = setup();
    timer.setDuration(id, 3 * MINUTE);
    timer.setMode(id, 'stopwatch');
    const { first } = open(env);
    expect(first()).toMatchObject({ mode: 'stopwatch', duration: 3 * MINUTE });
  });

  it('a Share link carries the Settings but not the State', () => {
    const { env, timer, id } = setup();
    timer.setDuration(id, 7 * MINUTE);
    timer.start(id);
    env.advance(MINUTE);
    const link = timer.shareLink({ display: true });

    const elsewhere = createTestEnv({ now: env.now(), url: link });
    const opened = open(elsewhere);
    expect(opened.first().duration).toBe(7 * MINUTE);
    expect(opened.read()).toEqual({ value: 7 * MINUTE, status: 'idle' });
    expect(opened.timer.getState().selectedPresetId).toBeNull();
  });

  it('switching Presets keeps the timer running', () => {
    const { env, timer, read, id } = setup();
    timer.setMode(id, 'stopwatch');
    const original = timer.getState().selectedPresetId!;
    timer.createPreset('Other');
    timer.start(id);
    env.advance(5 * SECOND);
    timer.selectPreset(original);
    expect(read()).toEqual({ value: 5 * SECOND, status: 'running' });
  });

  it('exports and imports the Presets', () => {
    const { env, timer, id } = setup();
    timer.setDuration(id, 9 * MINUTE);
    const file = timer.exportSettings();
    const other = open(createTestEnv({ now: env.now() }));
    expect(other.timer.importSettings('garbage')).toBe(false);
    expect(other.timer.importSettings(file)).toBe(true);
    expect(other.first().duration).toBe(9 * MINUTE);
  });

  it('applies valid appearances and ignores invalid ones', () => {
    const { timer } = setup();
    const appearance = { ...timer.getState().appearance, textColor: '#ff0000' };
    timer.setAppearance(appearance);
    expect(timer.getState().appearance.textColor).toBe('#ff0000');
    timer.setAppearance({ ...appearance, textColor: 'red' });
    expect(timer.getState().appearance.textColor).toBe('#ff0000');
  });

  it('notifies subscribers on actions', () => {
    const { timer, id } = setup();
    let calls = 0;
    const unsubscribe = timer.subscribe(() => calls++);
    timer.start(id);
    timer.pause(id);
    unsubscribe();
    timer.reset(id);
    expect(calls).toBe(2);
  });
});

/** A timestamp at a local wall-clock time (a day without a DST change). */
const at = (day: number, hours: number, minutes = 0, seconds = 0) =>
  new Date(2026, 0, day, hours, minutes, seconds).getTime();

describe('countdown to a time of day', () => {
  function targetSetup(now: number, target: string) {
    const opened = setup({ now });
    opened.timer.setMode(opened.id, 'targetTime');
    opened.timer.setTarget(opened.id, target);
    return opened;
  }

  it('counts down to the target time with the clock, without being started', () => {
    const { env, read, shown } = targetSetup(at(15, 20), '21:00');
    expect(read()).toEqual({ value: HOUR, status: 'running' });
    expect(shown()).toBe('01:00:00');
    env.advance(30 * MINUTE + 0.5 * SECOND);
    expect(shown()).toBe('30:00');
    env.advance(29 * MINUTE + 59 * SECOND);
    expect(shown()).toBe('00:01');
  });

  it('is time up at the target time and for an hour after, then counts to the next day', () => {
    const { env, read } = targetSetup(at(15, 20), '21:00');
    env.advance(HOUR);
    expect(read()).toEqual({ value: 0, status: 'timeUp' });
    env.advance(HOUR - 1);
    expect(read().status).toBe('timeUp');
    env.advance(1);
    expect(read()).toEqual({ value: 23 * HOUR, status: 'running' });
  });

  it('opened shortly after the target time, shows time up', () => {
    const { read } = targetSetup(at(15, 21, 30), '21:00');
    expect(read()).toEqual({ value: 0, status: 'timeUp' });
  });

  it('a target earlier in the day than now, beyond the hour, is the next day', () => {
    const { read } = targetSetup(at(15, 23), '01:00');
    expect(read()).toEqual({ value: 2 * HOUR, status: 'running' });
    expect(targetSetup(at(15, 21), '08:15').read()).toEqual({ value: 11 * HOUR + 15 * MINUTE, status: 'running' });
  });

  it('just after midnight, a late target from the previous evening is still time up', () => {
    expect(targetSetup(at(16, 0, 30), '23:50').read().status).toBe('timeUp');
  });

  it('ignores start, pause and reset (it follows the clock)', () => {
    const { env, timer, read, id } = targetSetup(at(15, 20), '21:00');
    timer.pause(id);
    timer.reset(id);
    env.advance(MINUTE);
    expect(read()).toEqual({ value: 59 * MINUTE, status: 'running' });
  });

  it('ignores invalid target times and keeps the countdown duration', () => {
    const { timer, first, id } = targetSetup(at(15, 20), '21:00');
    for (const target of ['24:00', '9:00', '12:60', 'abc', '']) timer.setTarget(id, target);
    expect(first()).toMatchObject({ mode: 'targetTime', target: '21:00', duration: 5 * MINUTE });
  });

  it('remembers the target time and carries it in Share links', () => {
    const { env, timer } = targetSetup(at(15, 20), '21:30');
    expect(open(env).first()).toMatchObject({ mode: 'targetTime', target: '21:30' });
    const elsewhere = open(createTestEnv({ now: at(15, 21), url: timer.shareLink() }));
    expect(elsewhere.read()).toEqual({ value: 30 * MINUTE, status: 'running' });
  });
});

describe('Display mode showing one timer', () => {
  const ids = (timers: { id: string }[]) => timers.map((entry) => entry.id);

  it('a Share link can name the one timer to show in Display mode', () => {
    const { timer, id } = setup();
    const second = timer.addTimer();
    const link = timer.shareLink({ display: true, timer: second });
    const opened = open(createTestEnv({ url: link }));
    expect(ids(opened.timer.getState().timers)).toEqual([id, second]);
    expect(ids(visibleTimers(opened.timer.getState().timers, new URL(link)))).toEqual([second]);
  });

  it('shows every timer without Display mode, without the parameter, or for an unknown id', () => {
    const { timer, id } = setup();
    const second = timer.addTimer();
    const timers = timer.getState().timers;
    for (const link of [
      timer.shareLink({ timer: second }),
      timer.shareLink({ display: true }),
      timer.shareLink({ display: true, timer: 'nope' }),
    ]) {
      expect(ids(visibleTimers(timers, new URL(link)))).toEqual([id, second]);
    }
  });
});

describe('fractional seconds', () => {
  it('are off by default and can be switched on and off; remembered', () => {
    const { env, timer } = setup();
    expect(timer.getState().showFraction).toBe(false);
    timer.setShowFraction(true);
    expect(timer.getState().showFraction).toBe(true);
    expect(open(env).timer.getState().showFraction).toBe(true);
    timer.setShowFraction(false);
    expect(timer.getState().showFraction).toBe(false);
  });

  it('show hundredths: a stopwatch rounds down, a countdown rounds up', () => {
    const { env, timer, first, id } = setup();
    const second = timer.addTimer();
    timer.setMode(second, 'stopwatch');
    timer.setDuration(id, 10 * SECOND);
    timer.start(id);
    timer.start(second);
    env.advance(5 * SECOND - 1);
    expect(formatTimer(first(), env.now(), { showFraction: true })).toBe('00:05.01');
    expect(formatTimer(first(), env.now())).toBe('00:06');
    env.advance(60 * SECOND);
    expect(formatTimer(view(timer, second), env.now(), { showFraction: true })).toBe('01:04.99');
    expect(formatTimer(first(), env.now(), { showFraction: true })).toBe('00:00.00');
  });
});

describe('Settings from ticket 12 (version 1)', () => {
  // Generated by the ticket 12 build: 2 min countdown, red digits, Display mode. Never regenerate.
  const V1_SHARE_LINK =
    'https://beards.github.io/MyWidgetBox/timer/?s=eyJ2ZXJzaW9uIjoxLCJzZXR0aW5ncyI6eyJ0aW1lcnMiOlt7ImlkIjoiMSIsIm5hbWUiOiIiLCJtb2RlIjoiY291bnRkb3duIiwiZHVyYXRpb24iOjEyMDAwMH1dLCJhcHBlYXJhbmNlIjp7ImJhY2tncm91bmQiOnsia2luZCI6InNvbGlkIiwiY29sb3IiOiIjZmZmZmZmIiwiaW1hZ2VVcmwiOiIifSwiZm9udEZhbWlseSI6IiIsImZvbnRTaXplIjo5NiwidGV4dENvbG9yIjoiI2ZmMDAwMCIsInNjYWxlIjoxfX19&display=1';
  const V1_STORAGE =
    '{"version":1,"presets":[{"id":"1","name":"","settings":{"timers":[{"id":"1","name":"","mode":"countdown","duration":120000}],"appearance":{"background":{"kind":"solid","color":"#ffffff","imageUrl":""},"fontFamily":"","fontSize":96,"textColor":"#ff0000","scale":1}}}],"selectedPresetId":"1"}';

  it('an old Share link still opens with its Settings', () => {
    const { timer, first, read } = setup({ url: V1_SHARE_LINK });
    expect(timer.getState().selectedPresetId).toBeNull();
    expect(first()).toMatchObject({ id: '1', mode: 'countdown', duration: 2 * MINUTE });
    expect(timer.getState().appearance.textColor).toBe('#ff0000');
    expect(read()).toEqual({ value: 2 * MINUTE, status: 'idle' });
  });

  it('stored Presets still open, and can switch to a time of day', () => {
    const env = createTestEnv({ now: at(15, 20) });
    env.storage.setItem('mywidgetbox:timer:settings', V1_STORAGE);
    const { timer, first, read, id } = open(env);
    expect(timer.getState().selectedPresetId).toBe('1');
    expect(first()).toMatchObject({ mode: 'countdown', duration: 2 * MINUTE });
    timer.setMode(id, 'targetTime');
    expect(read().status).toBe('running');
  });
});

describe('multiple timers', () => {
  it('adds timers that run independently', () => {
    const { env, timer, id } = setup();
    const second = timer.addTimer();
    expect(second).not.toBe(id);
    expect(timer.getState().timers.map((entry) => entry.id)).toEqual([id, second]);
    timer.setMode(second, 'stopwatch');
    timer.start(id);
    env.advance(10 * SECOND);
    timer.start(second);
    env.advance(5 * SECOND);
    timer.pause(id);
    env.advance(5 * SECOND);
    expect(readTimer(view(timer, id), env.now())).toEqual({ value: 5 * MINUTE - 15 * SECOND, status: 'paused' });
    expect(readTimer(view(timer, second), env.now())).toEqual({ value: 10 * SECOND, status: 'running' });
    timer.reset(second);
    expect(readTimer(view(timer, id), env.now()).value).toBe(5 * MINUTE - 15 * SECOND);
  });

  it('names timers', () => {
    const { timer, first, id } = setup();
    timer.renameTimer(id, 'Break');
    expect(first().name).toBe('Break');
  });

  it('removes timers but always keeps one', () => {
    const { timer, id } = setup();
    const second = timer.addTimer();
    timer.removeTimer(id);
    expect(timer.getState().timers.map((entry) => entry.id)).toEqual([second]);
    timer.removeTimer(second);
    expect(timer.getState().timers.map((entry) => entry.id)).toEqual([second]);
  });

  it('a new timer starts idle even if its id ran before', () => {
    const { env, timer } = setup();
    const second = timer.addTimer();
    timer.setMode(second, 'stopwatch');
    timer.start(second);
    env.advance(MINUTE);
    timer.removeTimer(second);
    const third = timer.addTimer();
    expect(readTimer(view(timer, third), env.now()).status).toBe('idle');
  });

  it('remembers the timers across reloads', () => {
    const { env, timer } = setup();
    const second = timer.addTimer();
    timer.renameTimer(second, 'Round');
    expect(open(env).timer.getState().timers.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: '1', name: '' },
      { id: second, name: 'Round' },
    ]);
  });
});
