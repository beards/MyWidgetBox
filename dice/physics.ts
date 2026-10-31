// Off-screen dice physics (ADR-0003): drops the dice onto a walled table with cannon-es, records the
// whole trajectory, then works out the face remap that makes each die show the value the controller
// already decided. The physics only stages the roll; it never decides it. No DOM, no WebGL.
import { Body, ContactMaterial, ConvexPolyhedron, type Equation, Material, Plane, SAPBroadphase, Vec3, World } from 'cannon-es';
import { Quaternion, Vector3 } from 'three';
import { type DieRoll, TABLE_BOUNCE_MAX } from './controller';
import { type DieBody, type DieShape, bodiesFor, dieHull, dieShape, faceRemap, topReading } from './geometry';

/** The walled part of the table, centred on the origin, in world units (a die is about 2 across). */
export interface Arena {
  halfWidth: number;
  halfDepth: number;
}

export type ImpactKind = 'table' | 'wall' | 'dice';

export interface Impact {
  /** Seconds after the throw. */
  time: number;
  /** 0..1, from how hard the bodies met. */
  strength: number;
  kind: ImpactKind;
}

export interface StagedBody extends DieBody {
  shape: DieShape;
  /** Draw the die at orientation * remap: same shape and place, with `label` on top at rest (see faceRemap). */
  remap: Quaternion;
}

export interface StagedRoll {
  /** One per die body, in bodiesFor order (a d100 is two bodies). */
  bodies: StagedBody[];
  frameRate: number;
  frameCount: number;
  /** Frame-major poses: for each frame, for each body, x y z then quaternion x y z w. */
  poses: Float32Array;
  impacts: Impact[];
}

export interface StageOptions {
  /** Staging randomness in [0, 1) (where and how the dice are dropped); never affects the Outcome. */
  random: () => number;
  arena: Arena;
  /** How bouncy the table is, 0..TABLE_BOUNCE_MAX (the table bounce setting); defaults to TABLE_BOUNCE_DEFAULT. */
  bounce?: number;
}

/** Default table bounce; the setting maps to a table restitution of 0.1 + 0.8 × bounce (0.1..1.3). */
export const TABLE_BOUNCE_DEFAULT = 0.6;

const FRAME_RATE = 60;
const STEP = 1 / FRAME_RATE;
const DIE_SPACING = 2.4;
/** Floor area per die, so many dice still have room to land. */
const AREA_PER_DIE = 12;
const MIN_AREA = 55;
/** A die this slow for a moment falls asleep (counts as at rest) until something hits it. */
const SLEEP_SPEED = 0.25;
/** A die is flat when a face points this close to straight down (about 8 degrees). */
const FLAT = Math.cos((8 * Math.PI) / 180);
/** Below this speed a die that is not flat is tipped over onto its nearest face, at up to this many rad/s. */
const TIP_SPEED = 0.6;
/**
 * A die that has stayed within this distance (units) of where it was STILL_FRAMES frames ago, turning less
 * than STILL_TURN, is only jittering in place: on a very bouncy table such tiny hops go on for a long time,
 * too small to see, and keep the roll from ending, so it looks stuck. It is set down instead (laid to rest
 * if flat, else tipped over).
 */
const STILL_DISTANCE = 0.04;
const STILL_FRAMES = 12;
const STILL_TURN = Math.cos((2 * Math.PI) / 180 / 2);
const TIP_SPIN = 3;
/** Seconds into the wind-down after which dice are no longer tipped over. */
const TIP_GIVE_UP = 0.6;
const DOWN = new Vector3(0, -1, 0);
/** Approach speed (units/s) that counts as the loudest impact, and the quietest one recorded. */
const LOUD_IMPACT = 25;
const SOFT_IMPACT = 1.5;
/** One sound per pair of bodies within this time (contacts repeat while bodies touch). */
const IMPACT_COOLDOWN = 0.08;

/** When damping starts to bring the dice to rest (s); most rolls come to rest on their own before. */
const WIND_DOWN = 3;
/**
 * From this time (s) the table's bounce eases down to SETTLED_RESTITUTION by WIND_DOWN (and is zero after it),
 * so every roll settles by itself, even on a table that bounces back more than it takes (restitution over 1),
 * which would otherwise bounce the dice higher and higher.
 */
const BOUNCE_EASE_START = 1.2;
/**
 * A table bouncier than 1 (the table gives back more than it takes) gets this much longer (s) at full bounce
 * per unit of bounce above 1: the ease and the wind-down start later, so the bounces are shown at length
 * (at TABLE_BOUNCE_MAX: easing from 2.5 s, wind-down from 4.3 s).
 */
const EXTRA_BOUNCE_TIME = 2.6;
const SETTLED_RESTITUTION = 0.3;
/**
 * A roll is not cut short: it runs until every die has settled (the wind-down, the eased bounce and the
 * jitter check make sure they do). This many frames (30 s) is only a guard against a bug looping forever.
 */
export const SAFETY_FRAMES = 30 * FRAME_RATE;
/** Frames the pose buffer starts with; it grows when a roll runs longer. */
const INITIAL_FRAMES = Math.ceil((WIND_DOWN + 1.5) * FRAME_RATE);

/** A table area that fits the dice and the stage's aspect ratio (width / height on screen). */
export function arenaFor(bodyCount: number, aspect: number): Arena {
  const area = Math.max(MIN_AREA, bodyCount * AREA_PER_DIE);
  // Seen from about 55 degrees up (scene.ts) the depth looks shorter, so the walled area is deeper than the stage.
  const depthRatio = 1 / (Math.max(0.5, Math.min(3, aspect)) * Math.sin((55 * Math.PI) / 180));
  const halfWidth = Math.sqrt(area / depthRatio) / 2;
  return { halfWidth, halfDepth: halfWidth * depthRatio };
}

/** Simulates a throw of these dice and remaps their faces so the throw ends on the Outcome `rolls`. */
export function stageRoll(rolls: DieRoll[], { random, arena, bounce = TABLE_BOUNCE_DEFAULT }: StageOptions): StagedRoll {
  const bodies = rolls.flatMap(bodiesFor).map((body) => ({ ...body, shape: dieShape(body.sides, body.labels) }));
  const recording = simulate(bodies, arena, bounce, random);
  return {
    bodies: bodies.map((body, index) => ({
      ...body,
      remap: faceRemap(body.shape, topReading(body.shape, recording.final[index]!).index, body.label),
    })),
    frameRate: FRAME_RATE,
    frameCount: recording.frameCount,
    poses: recording.poses,
    impacts: recording.impacts,
  };
}

interface Recording {
  frameCount: number;
  poses: Float32Array;
  impacts: Impact[];
  final: Quaternion[];
}

interface Tuning {
  gravity: number;
  /** Sideways drift (units/s), tumble (rad/s) and drop height. */
  drift: number;
  spin: number;
  height: number;
  damping: number;
  tableFriction: number;
  tableRestitution: number;
  /** When the table's bounce starts to ease down, and when the wind-down starts (s). */
  easeStart: number;
  windDown: number;
}

/**
 * The one natural tuning of the drop (a few dice come to rest in about 2–3.5 s); only the table
 * bounce setting changes it. Past WIND_DOWN, damping brings the dice to rest.
 */
function tuning(bounce: number): Tuning {
  /** How lively the drop is, 0..1: lighter gravity, more tumble, a slicker table. */
  const liveliness = 2 / 9;
  return {
    gravity: 100 - 70 * Math.sqrt(liveliness),
    drift: 1 + 2 * liveliness,
    spin: 16 + 14 * liveliness,
    height: 4 + 4 * liveliness,
    damping: 0.2 - 0.195 * liveliness,
    tableFriction: 0.45 - 0.33 * liveliness,
    tableRestitution: 0.1 + 0.8 * Math.max(0, Math.min(TABLE_BOUNCE_MAX, bounce)),
    ...timeline(bounce),
  };
}

/** When the bounce eases and the wind-down starts: later on a table bouncier than 1 (see EXTRA_BOUNCE_TIME). */
function timeline(bounce: number): { easeStart: number; windDown: number } {
  const later = EXTRA_BOUNCE_TIME * Math.max(0, Math.min(TABLE_BOUNCE_MAX, bounce) - 1);
  return { easeStart: BOUNCE_EASE_START + later, windDown: WIND_DOWN + later };
}

function simulate(
  dice: (DieBody & { shape: DieShape })[],
  arena: Arena,
  bounce: number,
  random: () => number,
): Recording {
  const tune = tuning(bounce);
  const world = new World({ gravity: new Vec3(0, -tune.gravity, 0), allowSleep: true });
  world.broadphase = new SAPBroadphase(world);
  Object.assign(world.solver, { iterations: 10 });

  const diceMaterial = new Material('dice');
  const tableMaterial = new Material('table');
  const wallMaterial = new Material('wall');
  const onTable = new ContactMaterial(diceMaterial, tableMaterial, { friction: tune.tableFriction, restitution: tune.tableRestitution });
  world.addContactMaterial(onTable);
  world.addContactMaterial(new ContactMaterial(diceMaterial, wallMaterial, { friction: 0, restitution: 0.8 }));
  world.addContactMaterial(new ContactMaterial(diceMaterial, diceMaterial, { friction: 0.15, restitution: 0.75 }));

  const table = new Body({ mass: 0, material: tableMaterial, shape: new Plane() });
  table.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(table);
  const walls = [
    { position: new Vec3(-arena.halfWidth, 0, 0), turn: Math.PI / 2 },
    { position: new Vec3(arena.halfWidth, 0, 0), turn: -Math.PI / 2 },
    { position: new Vec3(0, 0, -arena.halfDepth), turn: 0 },
    { position: new Vec3(0, 0, arena.halfDepth), turn: Math.PI },
  ].map(({ position, turn }) => {
    // A plane's normal is its +z; each wall faces into the arena.
    const wall = new Body({ mass: 0, material: wallMaterial, shape: new Plane(), position });
    wall.quaternion.setFromEuler(0, turn, 0);
    world.addBody(wall);
    return wall;
  });

  const bodies = dice.map(({ shape }) => {
    const { vertices, faces } = dieHull(shape);
    const hull = new ConvexPolyhedron({ vertices: vertices.map(({ x, y, z }) => new Vec3(x, y, z)), faces });
    const body = new Body({ mass: 1, material: diceMaterial, shape: hull, sleepSpeedLimit: SLEEP_SPEED, sleepTimeLimit: 0.2 });
    body.linearDamping = tune.damping * 0.4;
    body.angularDamping = tune.damping;
    world.addBody(body);
    return body;
  });
  dropIn(bodies, arena, tune, random);

  const kindOf = (a: Body, b: Body): ImpactKind =>
    a === table || b === table ? 'table' : walls.includes(a) || walls.includes(b) ? 'wall' : 'dice';
  const lastImpact = new Map<string, number>();
  const impacts: Impact[] = [];
  const frameSize = bodies.length * 7;
  let poses = new Float32Array(INITIAL_FRAMES * frameSize);
  const before = bodies.map(() => ({ velocity: new Vec3(), spin: new Vec3() }));
  let frameCount = 0;

  while (frameCount < SAFETY_FRAMES) {
    if ((frameCount + 1) * frameSize > poses.length) {
      const grown = new Float32Array(poses.length * 2);
      grown.set(poses);
      poses = grown;
    }
    bodies.forEach((body, index) => {
      poses.set(
        [body.position.x, body.position.y, body.position.z, body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w],
        (frameCount * bodies.length + index) * 7,
      );
    });
    frameCount++;
    if (bodies.every((body) => body.sleepState === Body.SLEEPING)) break;

    const time = frameCount * STEP;
    onTable.restitution = tableRestitutionAt(tune, time);
    if (time > tune.windDown) {
      // Past the wind-down time: damp the dice to a stop instead of letting them roll on.
      const extra = Math.min(0.95, (time - tune.windDown) * 1.5);
      for (const body of bodies) {
        body.linearDamping = Math.max(body.linearDamping, extra * 0.6);
        body.angularDamping = Math.max(body.angularDamping, extra);
        body.sleepSpeedLimit = SLEEP_SPEED * (1 + 2 * extra);
      }
    }
    // Late in the wind-down, dice still wedged at an angle are left as they are.
    if (time < tune.windDown + TIP_GIVE_UP) bodies.forEach((body, index) => tipOver(body, dice[index]!.shape));
    if (frameCount > STILL_FRAMES) {
      bodies.forEach((body, index) => {
        const offset = ((frameCount - 1 - STILL_FRAMES) * bodies.length + index) * 7;
        const moved = Math.hypot(body.position.x - poses[offset]!, body.position.y - poses[offset + 1]!, body.position.z - poses[offset + 2]!);
        const { x, y, z, w } = body.quaternion;
        const turned = Math.abs(x * poses[offset + 3]! + y * poses[offset + 4]! + z * poses[offset + 5]! + w * poses[offset + 6]!);
        if (body.sleepState !== Body.SLEEPING && moved < STILL_DISTANCE && turned > STILL_TURN) {
          setDown(body, dice[index]!.shape, time >= tune.windDown + TIP_GIVE_UP);
        }
      });
    }
    bodies.forEach((body, index) => {
      before[index]!.velocity.copy(body.velocity);
      before[index]!.spin.copy(body.angularVelocity);
    });
    world.step(STEP);

    for (const contact of world.contacts) {
      const speed = approachSpeed(contact, bodies, before);
      if (speed < SOFT_IMPACT) continue;
      const key = `${contact.bi.id}:${contact.bj.id}`;
      if (time - (lastImpact.get(key) ?? -Infinity) < IMPACT_COOLDOWN) continue;
      lastImpact.set(key, time);
      impacts.push({ time, strength: Math.min(1, speed / LOUD_IMPACT), kind: kindOf(contact.bi, contact.bj) });
    }
  }

  return {
    frameCount,
    poses: poses.slice(0, frameCount * bodies.length * 7),
    impacts,
    final: bodies.map(({ quaternion: { x, y, z, w } }) => new Quaternion(x, y, z, w)),
  };
}

/**
 * A slow die that is not flat (balanced on an edge, leaning on a wall or another die) is tipped onto its
 * nearest face, the way a real one falls over; it is kept awake until it lies flat.
 */
function tipOver(body: Body, shape: DieShape) {
  if (body.velocity.length() > TIP_SPEED || body.angularVelocity.length() > TIP_SPEED * 2) return;
  const bottom = lowestNormal(body, shape);
  if (-bottom.y > FLAT) return;
  body.wakeUp();
  // Turn the lowest face toward straight down.
  const axis = bottom.clone().cross(DOWN).normalize();
  const angle = Math.acos(Math.max(-1, Math.min(1, -bottom.y)));
  const spin = axis.multiplyScalar(Math.min(TIP_SPIN, angle * TIP_SPIN * 2));
  body.angularVelocity.set(spin.x, spin.y, spin.z);
}

/** The table's restitution at this time: as set, then easing down over the wind-down (see BOUNCE_EASE_START). */
function tableRestitutionAt({ tableRestitution: restitution, easeStart, windDown }: Tuning, time: number): number {
  // Past the wind-down nothing bounces any more, so no die is still in the air when the frames run out.
  if (time > windDown) return 0;
  if (restitution <= SETTLED_RESTITUTION || time <= easeStart) return restitution;
  const eased = Math.min(1, (time - easeStart) / (windDown - easeStart));
  return restitution + (SETTLED_RESTITUTION - restitution) * eased;
}

/**
 * Ends a die's jitter in place (see STILL_DISTANCE): at rest if it lies flat, otherwise tipped onto its
 * nearest face; once tipping has been given up (wedged against a wall or another die), at rest as it is.
 */
function setDown(body: Body, shape: DieShape, givenUpTipping: boolean) {
  body.velocity.setZero();
  body.angularVelocity.setZero();
  if (givenUpTipping || -lowestNormal(body, shape).y >= FLAT) body.sleep();
  else tipOver(body, shape);
}

/** The face normal of this die that points most downward, in world space. */
function lowestNormal(body: Body, shape: DieShape): Vector3 {
  const orientation = new Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
  return shape.faces
    .map((face) => face.normal.clone().applyQuaternion(orientation))
    .reduce((lowest, normal) => (normal.y < lowest.y ? normal : lowest));
}

/**
 * Drops every die straight down onto the table from above, scattered over its middle, with a random
 * orientation and tumble (no throw). Dice that don't fit side by side are stacked a layer higher.
 */
function dropIn(bodies: Body[], arena: Arena, tune: Tuning, random: () => number) {
  // Keep the drop points away from the walls so the dice bounce on the open table.
  const halfX = Math.max(0, arena.halfWidth * 0.6 - 1);
  const halfZ = Math.max(0, arena.halfDepth * 0.6 - 1);
  const placed: Vector3[] = [];

  bodies.forEach((body) => {
    let start = new Vector3();
    for (let layer = 0; ; layer++) {
      const y = tune.height + layer * DIE_SPACING;
      let found = false;
      for (let attempt = 0; attempt < 30 && !found; attempt++) {
        start = new Vector3((random() * 2 - 1) * halfX, y + random() * 0.6, (random() * 2 - 1) * halfZ);
        found = placed.every((other) => other.distanceTo(start) >= DIE_SPACING);
      }
      if (found) break;
    }
    placed.push(start);
    body.position.set(start.x, start.y, start.z);
    body.quaternion.set(random() - 0.5, random() - 0.5, random() - 0.5, random() - 0.5).normalize();

    // A slight drift so they don't land dead still, and a tumble so they land on an edge or a corner.
    const drift = tune.drift;
    body.velocity.set((random() - 0.5) * drift, 0, (random() - 0.5) * drift);
    const spin = new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize().multiplyScalar(tune.spin * (0.7 + random() * 0.6));
    body.angularVelocity.set(spin.x, spin.y, spin.z);
  });
}

/** How fast the two bodies of a contact were approaching each other along its normal, before the step solved it. */
function approachSpeed(contact: Equation & { ni: Vec3; ri: Vec3; rj: Vec3 }, bodies: Body[], before: { velocity: Vec3; spin: Vec3 }[]) {
  const pointVelocity = (body: Body, arm: Vec3) => {
    const index = bodies.indexOf(body);
    if (index < 0) return new Vec3();
    const { velocity, spin } = before[index]!;
    return velocity.vadd(spin.cross(arm));
  };
  const relative = pointVelocity(contact.bj, contact.rj).vsub(pointVelocity(contact.bi, contact.ri));
  return -relative.dot(contact.ni);
}

/** At most this many impact sounds overlap; a clack lasts about IMPACT_SOUND_LENGTH seconds. */
export const MAX_CONCURRENT_IMPACT_SOUNDS = 4;
const IMPACT_SOUND_LENGTH = 0.12;
/** Softer impacts make no sound. */
const AUDIBLE_STRENGTH = 0.1;

export interface ImpactSound {
  time: number;
  /** 0..1 of the sound Settings volume, in proportion to the impact strength. */
  volume: number;
  kind: ImpactKind;
}

/** Which impacts of a roll make a sound and how loud, in time order, never more than a few at once. */
export function impactSounds(impacts: Impact[]): ImpactSound[] {
  const sounds: ImpactSound[] = [];
  for (const { time, strength, kind } of [...impacts].sort((a, b) => a.time - b.time)) {
    if (strength < AUDIBLE_STRENGTH) continue;
    const playing = sounds.filter((sound) => time - sound.time < IMPACT_SOUND_LENGTH).length;
    if (playing < MAX_CONCURRENT_IMPACT_SOUNDS) sounds.push({ time, volume: strength, kind });
  }
  return sounds;
}
