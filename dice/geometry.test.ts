import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { DIE_SIDES } from './controller';
import { type BodySides, bodiesFor, dieShape, faceRemap, restingQuaternion, topReading } from './geometry';

const BODY_SIDES: BodySides[] = [4, 6, 8, 10, 12, 20];
const UP = new Vector3(0, 1, 0);

describe('dice geometry', () => {
  it.each(BODY_SIDES)('builds a d%i with one face per side', (sides) => {
    expect(dieShape(sides).faces).toHaveLength(sides);
  });

  it.each(DIE_SIDES)('shows every d%i value on exactly one reading (face, or corner of a d4) of its bodies', (sides) => {
    for (let value = 1; value <= sides; value++) {
      for (const body of bodiesFor({ sides, value })) {
        const found = dieShape(body.sides, body.labels).readings.filter((reading) => reading.label === body.label);
        expect(found).toHaveLength(1);
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

  it.each(BODY_SIDES)('relabels a landed d%i so its top shows any wanted label', (sides) => {
    const shape = dieShape(sides);
    const labels = shape.readings.map((reading) => reading.label);
    for (let landed = 0; landed < labels.length; landed++) {
      // Some orientation in which reading `landed` is on top, with an arbitrary turn about the vertical.
      const pose = new Quaternion().setFromAxisAngle(UP, landed).multiply(restingQuaternion(shape, landed));
      expect(topReading(shape, pose).label).toBe(labels[landed]);
      for (const wanted of labels) {
        const shown = pose.clone().multiply(faceRemap(shape, landed, wanted));
        expect(topReading(shape, shown).label).toBe(wanted);
      }
    }
  });

  it.each(BODY_SIDES)('relabels a d%i with one of its own symmetries, so its shape does not change', (sides) => {
    const shape = dieShape(sides);
    const corners = shape.faces.flatMap((face) => face.triangles.flat());
    for (const wanted of shape.readings.map((reading) => reading.label)) {
      const remap = faceRemap(shape, 0, wanted);
      for (const corner of corners) {
        const moved = corner.clone().applyQuaternion(remap);
        expect(Math.min(...corners.map((other) => other.distanceTo(moved)))).toBeLessThan(1e-6);
      }
    }
  });

  it('reads a d4 at its top corner, like a real d4', () => {
    const shape = dieShape(4);
    expect(shape.readings).toHaveLength(4);
    for (let index = 0; index < 4; index++) {
      const pose = restingQuaternion(shape, index);
      const corner = shape.readings[index]!.direction.clone().applyQuaternion(pose);
      expect(corner.distanceTo(UP)).toBeLessThan(1e-9);
      // It rests on the face opposite that corner.
      expect(shape.faces.some((face) => face.normal.clone().applyQuaternion(pose).y < -1 + 1e-9)).toBe(true);
    }
  });

  it.each(BODY_SIDES)('rests a d%i flat on the table with the chosen reading on top', (sides) => {
    const shape = dieShape(sides);
    shape.readings.forEach((reading, index) => {
      const pose = restingQuaternion(shape, index);
      expect(topReading(shape, pose).label).toBe(reading.label);
      expect(shape.faces.some((face) => face.normal.clone().applyQuaternion(pose).y < -1 + 1e-9)).toBe(true);
    });
  });
});
