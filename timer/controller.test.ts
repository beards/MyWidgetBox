import { describe, expect, it } from 'vitest';
import type { Env } from '../shared/env';
import { createTestEnv } from '../shared/test-env';
import { MAX_DURATION, createTimerController, formatTimer, readTimer } from './controller';

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
