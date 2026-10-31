import { describe, expect, it } from 'vitest';
import { SHAKE_COOLDOWN, createShakeDetector } from './shake';

const still = (time: number) => ({ x: 0, y: 0, z: 9.8, time });
const jolt = (time: number) => ({ x: 25, y: -10, z: 9.8, time });

describe('shake detector', () => {
  it('ignores a phone lying still or tilting slowly', () => {
    const detect = createShakeDetector();
    const samples = [still(0), still(16), { x: 1, y: 0.5, z: 9.6, time: 32 }, { x: 2, y: 1, z: 9.4, time: 48 }];
    expect(samples.map(detect)).toEqual([false, false, false, false]);
  });

  it('fires on a sharp change in acceleration', () => {
    const detect = createShakeDetector();
    detect(still(0));
    expect(detect(jolt(16))).toBe(true);
  });

  it('fires once per shake: further jolts within the cooldown are ignored', () => {
    const detect = createShakeDetector();
    detect(still(0));
    expect(detect(jolt(16))).toBe(true);
    expect(detect(still(32))).toBe(false);
    expect(detect(jolt(48))).toBe(false);
    expect(detect(still(16 + SHAKE_COOLDOWN))).toBe(true);
  });

  it('ignores samples without acceleration data', () => {
    const detect = createShakeDetector();
    expect(detect({ x: null, y: null, z: null, time: 0 })).toBe(false);
    expect(detect(jolt(16))).toBe(false);
  });
});
