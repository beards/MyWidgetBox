import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { type DieRoll, TABLE_BOUNCE_MAX } from './controller';
import { topReading } from './geometry';
import { MAX_CONCURRENT_IMPACT_SOUNDS, type Impact, type StagedRoll, arenaFor, impactSounds, SAFETY_FRAMES, stageRoll } from './physics';

/** mulberry32 in [0, 1): a seeded stand-in for Math.random. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

function stage(rolls: DieRoll[], seed: number): StagedRoll {
  const bodyCount = rolls.reduce((sum, roll) => sum + (roll.sides === 100 ? 2 : 1), 0);
  return stageRoll(rolls, { random: seeded(seed), arena: arenaFor(bodyCount, 2) });
}

function pose(roll: StagedRoll, frame: number, body: number) {
  const offset = (frame * roll.bodies.length + body) * 7;
  const p = roll.poses;
  return {
    position: new Vector3(p[offset], p[offset + 1], p[offset + 2]),
    orientation: new Quaternion(p[offset + 3], p[offset + 4], p[offset + 5], p[offset + 6]),
  };
}

/** The label a viewer sees on top of each body at the last frame (the physics pose turned by the face remap). */
function shownOnTop(roll: StagedRoll): string[] {
  return roll.bodies.map((body, index) => {
    const { orientation } = pose(roll, roll.frameCount - 1, index);
    return topReading(body.shape, orientation.multiply(body.remap)).label;
  });
}

const ONE_OF_EACH: DieRoll[] = [
  { sides: 4, value: 3 },
  { sides: 6, value: 5 },
  { sides: 8, value: 1 },
  { sides: 10, value: 10 },
  { sides: 12, value: 7 },
  { sides: 20, value: 20 },
  { sides: 100, value: 42 },
];

describe('staged dice roll (physics replay with face remap)', () => {
  it.each([1, 2, 3, 4, 5])('ends with the Outcome on top of every die kind (seed %i)', (seed) => {
    const roll = stage(ONE_OF_EACH, seed);
    expect(shownOnTop(roll)).toEqual(['3', '5', '1', '10', '7', '20', '40', '2']);
  });

  it('ends with the Outcome on top of 24 dice thrown together', () => {
    const rolls: DieRoll[] = Array.from({ length: 24 }, (_, i) => {
      const sides = ([4, 6, 8, 10, 12, 20] as const)[i % 6]!;
      return { sides, value: (i % sides) + 1 };
    });
    const roll = stage(rolls, 7);
    expect(shownOnTop(roll)).toEqual(rolls.map((r) => String(r.value)));
  });

  it.each([11, 12, 13])('comes to rest by itself (seed %i)', (seed) => {
    const roll = stage(ONE_OF_EACH, seed);
    expect(roll.frameCount).toBeLessThan(SAFETY_FRAMES);
    const last = roll.frameCount - 1;
    roll.bodies.forEach((_, index) => {
      // Not visibly moving over the last frames (tiny jitter in place is cut short, see the next test).
      expect(pose(roll, last, index).position.distanceTo(pose(roll, last - 10, index).position)).toBeLessThan(0.1);
    });
  });

  it('keeps every die on the table inside the invisible walls', () => {
    const roll = stage(ONE_OF_EACH, 3);
    const { halfWidth, halfDepth } = arenaFor(8, 2);
    for (let frame = 0; frame < roll.frameCount; frame++) {
      roll.bodies.forEach((_, index) => {
        const { position } = pose(roll, frame, index);
        expect(Math.abs(position.x)).toBeLessThan(halfWidth);
        expect(Math.abs(position.z)).toBeLessThan(halfDepth);
        expect(position.y).toBeGreaterThan(0);
      });
    }
  });

  it('drops the dice from above the table, spread apart, without throwing them sideways', () => {
    for (const seed of [1, 2, 3]) {
      const roll = stage(ONE_OF_EACH, seed);
      const starts = roll.bodies.map((_, index) => pose(roll, 0, index).position);
      for (const start of starts) expect(start.y).toBeGreaterThan(3);
      starts.forEach((a, i) => starts.slice(i + 1).forEach((b) => expect(a.distanceTo(b)).toBeGreaterThan(2)));
      // Falling straight down: early on, each die has barely moved sideways.
      roll.bodies.forEach((_, index) => {
        const early = pose(roll, 10, index).position;
        expect(Math.hypot(early.x - starts[index]!.x, early.z - starts[index]!.z)).toBeLessThan(1);
      });
    }
  });

  it('bounces off a bouncier table more often, still ending on the Outcome', () => {
    const rolls: DieRoll[] = [
      { sides: 6, value: 2 },
      { sides: 20, value: 13 },
      { sides: 6, value: 6 },
    ];
    const hardTableHits = (bounce: number) =>
      [1, 2, 3, 4, 5].reduce((sum, seed) => {
        const roll = stageRoll(rolls, { random: seeded(seed), arena: arenaFor(3, 2), bounce });
        expect(shownOnTop(roll)).toEqual(['2', '13', '6']);
        return sum + roll.impacts.filter((impact) => impact.kind === 'table' && impact.strength > 0.15).length;
      }, 0);
    expect(hardTableHits(1)).toBeGreaterThan(hardTableHits(0));
  });

  it('ends soon after the dice stop visibly moving, even on the bounciest table', () => {
    const rolls: DieRoll[] = [
      { sides: 6, value: 3 },
      { sides: 20, value: 7 },
      { sides: 6, value: 1 },
      { sides: 8, value: 2 },
    ];
    for (const seed of [1, 2, 3, 4, 5]) {
      const roll = stageRoll(rolls, { random: seeded(seed), arena: arenaFor(4, 2), bounce: 1 });
      expect(shownOnTop(roll)).toEqual(['3', '7', '1', '2']);
      // The last frame by which some die had still visibly moved: over 0.1 (a twelfth of a die) in 0.2 s.
      let lastVisible = 0;
      for (let frame = 12; frame < roll.frameCount; frame++) {
        roll.bodies.forEach((_, index) => {
          if (pose(roll, frame, index).position.distanceTo(pose(roll, frame - 12, index).position) > 0.1) lastVisible = frame;
        });
      }
      expect((roll.frameCount - lastVisible) / roll.frameRate).toBeLessThan(0.5);
    }
  });

  it('stays on the table and ends on the Outcome even with a table that bounces back more than it takes', () => {
    const { halfWidth, halfDepth } = arenaFor(8, 2);
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const roll = stageRoll(ONE_OF_EACH, { random: seeded(seed), arena: arenaFor(8, 2), bounce: TABLE_BOUNCE_MAX });
      expect(shownOnTop(roll)).toEqual(['3', '5', '1', '10', '7', '20', '40', '2']);
      expect(roll.frameCount).toBeLessThan(SAFETY_FRAMES);
      const last = roll.frameCount - 1;
      roll.bodies.forEach((_, index) => {
        // At rest, not cut off mid-bounce by the frame limit.
        expect(pose(roll, last, index).position.distanceTo(pose(roll, last - 10, index).position)).toBeLessThan(0.1);
      });
      for (let frame = 0; frame < roll.frameCount; frame++) {
        roll.bodies.forEach((_, index) => {
          const { position } = pose(roll, frame, index);
          expect(Math.abs(position.x)).toBeLessThan(halfWidth);
          expect(Math.abs(position.z)).toBeLessThan(halfDepth);
        });
      }
    }
  });

  it('records impacts against the table, the walls and other dice, louder for harder hits', () => {
    const roll = stage(ONE_OF_EACH, 2);
    const kinds = new Set(roll.impacts.map((impact) => impact.kind));
    expect(kinds.has('table')).toBe(true);
    expect(kinds.has('dice')).toBe(true);
    for (const impact of roll.impacts) {
      expect(impact.strength).toBeGreaterThan(0);
      expect(impact.strength).toBeLessThanOrEqual(1);
      expect(impact.time).toBeLessThanOrEqual(roll.frameCount / roll.frameRate);
    }
  });
});

describe('impact sounds', () => {
  const hit = (time: number, strength: number, kind: Impact['kind'] = 'table'): Impact => ({ time, strength, kind });

  it('plays harder impacts louder, in proportion to how hard they were', () => {
    const sounds = impactSounds([hit(0.1, 0.25), hit(0.5, 1), hit(0.9, 0.5, 'dice')]);
    expect(sounds).toEqual([
      { time: 0.1, volume: 0.25, kind: 'table' },
      { time: 0.5, volume: 1, kind: 'table' },
      { time: 0.9, volume: 0.5, kind: 'dice' },
    ]);
  });

  it('limits how many impact sounds play at once, keeping the first ones', () => {
    const burst = Array.from({ length: 10 }, (_, i) => hit(1 + i * 0.001, 0.5));
    const sounds = impactSounds([...burst, hit(2, 0.5)]);
    expect(sounds.filter((sound) => sound.time < 1.5)).toHaveLength(MAX_CONCURRENT_IMPACT_SOUNDS);
    expect(sounds.at(-1)).toMatchObject({ time: 2 });
  });

  it('skips impacts too soft to hear', () => {
    expect(impactSounds([hit(0.1, 0.01)])).toEqual([]);
  });
});
