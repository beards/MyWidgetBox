import { describe, expect, it } from 'vitest';
import { landingRotation, sectorUnderPointer } from './geometry';

/** The wheel angle under the top pointer once the wheel is rotated clockwise by `rotation` degrees. */
const underPointer = (rotation: number) => (((-rotation % 360) + 360) % 360);

describe('landingRotation', () => {
  it.each([
    [0, 270, 3],
    [123.4, 9, 5],
    [-50, 0.5, 1],
    [720, 359.9, 4],
  ])('from %s° turns forward at least the given turns and stops with angle %s° under the pointer', (from, angle, turns) => {
    const to = landingRotation(from, angle, turns);
    expect(to).toBeGreaterThanOrEqual(from + turns * 360);
    expect(to).toBeLessThan(from + (turns + 1) * 360);
    expect(underPointer(to)).toBeCloseTo(angle, 6);
  });
});

describe('sectorUnderPointer', () => {
  const sectors = [
    { start: 0, end: 90 },
    { start: 90, end: 300 },
    { start: 300, end: 360 },
  ];

  it.each([
    [0, 0],
    [-45, 0],
    [-100, 1],
    [30, 2],
    [-90, 1],
    [720 + 10, 2],
  ])('at rotation %s° finds sector %s under the pointer', (rotation, index) => {
    expect(sectorUnderPointer(sectors, rotation)).toBe(index);
  });

  it('is -1 for an empty wheel', () => {
    expect(sectorUnderPointer([], 42)).toBe(-1);
  });
});
