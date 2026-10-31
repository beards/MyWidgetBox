import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { DIE_SIDES } from './controller';
import { type BodySides, bodiesFor, dieShape, landingQuaternion } from './geometry';

const BODY_SIDES: BodySides[] = [4, 6, 8, 10, 12, 20];
const TOWARD_VIEWER = new Vector3(0, 0, 1);
const SCREEN_UP = new Vector3(0, 1, 0);

describe('dice geometry', () => {
  it.each(BODY_SIDES)('builds a d%i with one face per side', (sides) => {
    expect(dieShape(sides).faces).toHaveLength(sides);
  });

  it.each(DIE_SIDES)('shows every d%i value on exactly one face of its bodies', (sides) => {
    for (let value = 1; value <= sides; value++) {
      for (const body of bodiesFor({ sides, value })) {
        const faces = dieShape(body.sides, body.labels).faces.filter((face) => face.label === body.label);
        expect(faces).toHaveLength(1);
      }
    }
  });

  it('shows d100 values as a tens die and a units die', () => {
    const labels = (value: number) => bodiesFor({ sides: 100, value }).map((body) => body.label);
    expect(labels(1)).toEqual(['00', '1']);
    expect(labels(10)).toEqual(['10', '0']);
    expect(labels(57)).toEqual(['50', '7']);
    expect(labels(100)).toEqual(['00', '0']);
    expect(bodiesFor({ sides: 20, value: 17 })).toEqual([expect.objectContaining({ sides: 20, label: '17' })]);
  });

  it.each(BODY_SIDES)('lands a d%i with the chosen face toward the viewer, upright', (sides) => {
    const { faces } = dieShape(sides);
    for (const face of faces) {
      const rotation = landingQuaternion(face);
      expect(face.normal.clone().applyQuaternion(rotation).distanceTo(TOWARD_VIEWER)).toBeLessThan(1e-9);
      expect(face.up.clone().applyQuaternion(rotation).distanceTo(SCREEN_UP)).toBeLessThan(1e-9);
      // No other face is turned further toward the viewer.
      for (const other of faces) {
        if (other !== face) expect(other.normal.clone().applyQuaternion(rotation).z).toBeLessThan(0.999);
      }
    }
  });
});
