// three.js view of the dice: a table seen from above at an angle, onto which the dice are dropped.
// The throw is simulated off-screen first (physics.ts, ADR-0003), then played back here frame by frame.
// Knows nothing about the controller.
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  DirectionalLight,
  HemisphereLight,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  SpotLight,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { REDUCED_MOTION_DURATION } from '../shared/animation';
import type { DiceAnimation, DieRoll, TableFinish } from './controller';
import { type DieBody, type DieFace, type DieShape, bodiesFor, createDieGeometry, dieShape, restingQuaternion } from './geometry';
import { type Arena, type ImpactSound, type StagedRoll, arenaFor, impactSounds, stageRoll } from './physics';

export interface DiceScene {
  /** Shows these dice at rest on the table, without animating; a no-op if they are already shown. */
  show(rolls: DieRoll[]): void;
  /**
   * Drops these dice onto the table so they land on their values and calls onDone when they rest;
   * onImpact is called as they hit the table, the walls and each other (volume 0..1 from how hard).
   * 'reduced' shows a quick reveal instead; 'skip' sets them down at once, silently, and calls onDone.
   */
  play(
    rolls: DieRoll[],
    options: { animation: DiceAnimation; bounce?: number },
    onDone: () => void,
    onImpact?: (volume: number) => void,
  ): void;
  /** Recolors the dice (also mid-animation); a no-op if the colors are unchanged. */
  setColors(colors: DiceColors): void;
  /** Changes the table; an invisible table (transparent background) still catches the dice shadows. */
  setTable(table: TableLook): void;
}

/** CSS colors of the die body and of the pips / face numbers. */
export interface DiceColors {
  body: string;
  label: string;
  /** d6 faces whose pips are painted in their own color instead (null: none). */
  specialPips: { values: number[]; color: string } | null;
}

export interface TableLook {
  color: string;
  finish: TableFinish;
  visible: boolean;
}

const DEFAULT_COLORS: DiceColors = { body: '#f7f3e8', label: '#1f1f1f', specialPips: { values: [1, 4], color: '#c62828' } };
const FIELD_OF_VIEW = 32;
/** The camera looks down at the table from this many degrees above it. */
const ELEVATION = (55 * Math.PI) / 180;
/** Above this many die bodies the physics would take too long: the dice are just set down, as with reduced motion. */
const PHYSICS_BODY_LIMIT = 80;
/** How long the top faces light up once the dice rest, and in what color. */
const HIGHLIGHT_MS = 1400;
const HIGHLIGHT_COLOR = '#ffc94a';
const HIGHLIGHT_STRENGTH = 1.2;
/** Colors that paint a face's label mask: labels white, the rest black. */
const MASK_COLORS: DiceColors = { body: '#000000', label: '#ffffff', specialPips: null };
/** Table texture tile size in world units (a die is about 2 across). */
const TILE = { felt: 6, wood: 14 } as const;

interface Model {
  sides: number;
  shape: DieShape;
  geometry: BufferGeometry;
  materials: Material[];
  /** Label masks by face index and lit label, made when first needed (see labelMask). */
  labelMasks: Map<string, CanvasTexture>;
}

interface Placed {
  mesh: Mesh;
  /** The model's shared face materials (the mesh gets copies while its top face is lit up). */
  materials: Material[];
  body: DieBody;
  shape: DieShape;
  labelMasks: Map<string, CanvasTexture>;
}

export function createDiceScene(container: HTMLElement): DiceScene {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  container.append(renderer.domElement);

  const scene = new Scene();
  // Soft studio reflections make the dice read as glossy plastic.
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.5, 400);
  scene.add(new HemisphereLight(0xfff8ee, 0x4a4436, 0.55));
  // A lamp over the table: a pool of warm light that falls off toward the edges, casting the dice shadows.
  const lamp = new SpotLight(0xfff1dc, 3.2, 0, Math.PI / 4, 0.75, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.bias = -0.0003;
  lamp.shadow.normalBias = 0.03;
  lamp.shadow.radius = 3;
  // A soft fill from the viewer's side keeps the near faces of the dice from going dark.
  const fill = new DirectionalLight(0xdde6ff, 0.5);
  scene.add(lamp, lamp.target, fill);

  const tableMaterial = new MeshStandardMaterial();
  const shadowCatcher = new ShadowMaterial({ opacity: 0.35 });
  const table = new Mesh<PlaneGeometry, Material>(new PlaneGeometry(400, 400), tableMaterial);
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  const models = new Map<string, Model>();
  let placed: Placed[] = [];
  let shownKey = '';
  let arena: Arena = arenaFor(1, 2);
  let frame = 0;
  /** True while dice are falling and rolling (not during the top-face highlight after they rest). */
  let rolling = false;
  let colors = DEFAULT_COLORS;
  let tableKey = '';

  /** One material per face, then one for the rounded edges and corners (see createDieGeometry). */
  function faceMaterials(shape: DieShape): Material[] {
    const plastic = { roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 };
    return [
      ...shape.faces.map((face) => new MeshPhysicalMaterial({ map: faceTexture(face, shape, colors), ...plastic })),
      new MeshPhysicalMaterial({ color: colors.body, ...plastic }),
    ];
  }

  function model(body: DieBody): Model {
    const key = `${body.sides}:${body.labels.join(',')}`;
    let found = models.get(key);
    if (!found) {
      const shape = dieShape(body.sides, body.labels);
      found = { sides: body.sides, shape, geometry: createDieGeometry(shape), materials: faceMaterials(shape), labelMasks: new Map() };
      models.set(key, found);
    }
    return found;
  }

  /** Replaces the dice in the scene with these bodies and sizes the table to fit them. */
  function place(bodies: DieBody[]) {
    placed.forEach(({ mesh }) => scene.remove(mesh));
    clearHighlights();
    arena = arenaFor(bodies.length, aspect());
    placed = bodies.map((body) => {
      const { shape, geometry, materials, labelMasks } = model(body);
      const mesh = new Mesh(geometry, materials);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return { mesh, materials, body, shape, labelMasks };
    });
    fitCamera();
  }

  /** Sets the dice down in rows on the table, each with its value on top. */
  function setDown() {
    const cell = 2.6;
    const cols = Math.max(1, Math.min(placed.length, Math.floor((2 * arena.halfWidth) / cell)));
    const rows = Math.ceil(placed.length / cols);
    placed.forEach(({ mesh, body, shape }, index) => {
      const reading = shape.readings.findIndex((candidate) => candidate.label === body.label);
      const orientation = restingQuaternion(shape, reading);
      const col = index % cols;
      const row = Math.floor(index / cols);
      const inRow = Math.min(cols, placed.length - row * cols);
      mesh.quaternion.copy(orientation);
      mesh.position.set((col - (inRow - 1) / 2) * cell, restingHeight(shape, orientation), (row - (rows - 1) / 2) * cell);
      mesh.scale.setScalar(1);
    });
  }

  function size() {
    return { width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight) };
  }

  function aspect() {
    const { width, height } = size();
    return width / height;
  }

  /** Fixed camera, high above the near side, framing the whole walled area. */
  function fitCamera() {
    const { width, height } = size();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const corners = [-1, 1].flatMap((x) =>
      [-1, 1].flatMap((z) => [0, 1.6].map((y) => new Vector3(x * arena.halfWidth, y, z * arena.halfDepth))),
    );
    const direction = new Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION));
    const fits = (distance: number) => {
      camera.position.copy(direction).multiplyScalar(distance);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      return corners.every((corner) => {
        const { x, y, z } = corner.clone().project(camera);
        return Math.abs(x) < 0.97 && Math.abs(y) < 0.95 && z < 1;
      });
    };
    let low = 2;
    let high = 300;
    while (high - low > 0.05) {
      const middle = (low + high) / 2;
      if (fits(middle)) high = middle;
      else low = middle;
    }
    fits(high);
    // The lamp hangs above and a little to the left of the table centre; its cone covers the walled area.
    const reach = Math.hypot(arena.halfWidth, arena.halfDepth);
    // Hung high, so the shadows of dice in the air do not balloon.
    lamp.position.set(-reach * 0.6, reach * 3.2, reach * 0.4);
    lamp.angle = Math.atan(1.35 / 3.2) + 0.1;
    lamp.shadow.camera.near = reach;
    lamp.shadow.camera.far = reach * 6;
    fill.position.set(0, reach, reach * 2);
  }

  function render() {
    renderer.render(scene, camera);
  }

  /** Puts back the shared materials of dice whose top faces were lit up. */
  function clearHighlights() {
    for (const { mesh, materials } of placed) {
      if (mesh.material === materials) continue;
      (mesh.material as Material[]).forEach((material) => {
        if (!materials.includes(material)) material.dispose();
      });
      mesh.material = materials;
    }
  }

  /** Lights up the top face of each die for a moment once the dice rest (all faces at the top corner of a d4). */
  function highlight() {
    clearHighlights();
    const glowing: MeshPhysicalMaterial[] = [];
    for (const { mesh, materials, body, shape, labelMasks } of placed) {
      const top = shape.readings.find((reading) => reading.label === body.label)!.direction;
      mesh.material = materials.map((material, index) => {
        const face = shape.faces[index];
        // The rounded edges and corners stay unlit.
        if (!face) return material;
        const lit = shape.sides === 4 ? face.normal.dot(top) > 0 : face.label === body.label;
        if (!lit) return material;
        const glow = (material as MeshPhysicalMaterial).clone();
        glow.emissive.set(HIGHLIGHT_COLOR);
        // Only the pips or numbers glow, not the whole face.
        glow.emissiveMap = labelMask(labelMasks, shape, index, body.label);
        glowing.push(glow);
        return glow;
      });
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / HIGHLIGHT_MS);
      // Up quickly, then fade out.
      const intensity = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      glowing.forEach((material) => (material.emissiveIntensity = HIGHLIGHT_STRENGTH * intensity));
      render();
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        frame = 0;
        clearHighlights();
        render();
      }
    };
    frame = requestAnimationFrame(step);
  }

  /** Quick reveal (reduced motion, or too many dice for the physics): the dice grow into place already set down. */
  function reveal(duration: number, onDone: () => void, onImpact?: (volume: number) => void) {
    setDown();
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      placed.forEach(({ mesh }) => mesh.scale.setScalar(0.6 + 0.4 * easeOutCubic(t)));
      render();
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        frame = 0;
        onImpact?.(0.8);
        rolling = false;
        onDone();
        highlight();
      }
    };
    frame = requestAnimationFrame(step);
  }

  /** Plays back a staged roll at real time, interpolating between the recorded physics frames. */
  function replay(staged: StagedRoll, onDone: () => void, onImpact?: (volume: number) => void) {
    const sounds: ImpactSound[] = impactSounds(staged.impacts);
    let nextSound = 0;
    const last = staged.frameCount - 1;
    const position = new Vector3();
    const next = new Vector3();
    const from = new Quaternion();
    const to = new Quaternion();
    const pose = (at: number) => {
      const lower = Math.min(last, Math.floor(at));
      const upper = Math.min(last, lower + 1);
      const mix = at - lower;
      placed.forEach(({ mesh }, index) => {
        const a = (lower * placed.length + index) * 7;
        const b = (upper * placed.length + index) * 7;
        const p = staged.poses;
        position.set(p[a]!, p[a + 1]!, p[a + 2]!);
        next.set(p[b]!, p[b + 1]!, p[b + 2]!);
        mesh.position.lerpVectors(position, next, mix);
        from.set(p[a + 3]!, p[a + 4]!, p[a + 5]!, p[a + 6]!);
        to.set(p[b + 3]!, p[b + 4]!, p[b + 5]!, p[b + 6]!);
        // The face remap: same shape and place as the physics body, relabelled so the Outcome ends on top.
        mesh.quaternion.slerpQuaternions(from, to, mix).multiply(staged.bodies[index]!.remap);
      });
    };
    const start = performance.now();
    const step = (now: number) => {
      const seconds = (now - start) / 1000;
      pose(Math.min(last, seconds * staged.frameRate));
      while (nextSound < sounds.length && sounds[nextSound]!.time <= seconds) onImpact?.(sounds[nextSound++]!.volume);
      render();
      if (seconds * staged.frameRate < last) {
        frame = requestAnimationFrame(step);
      } else {
        frame = 0;
        rolling = false;
        onDone();
        highlight();
      }
    };
    pose(0);
    render();
    frame = requestAnimationFrame(step);
  }

  new ResizeObserver(() => {
    fitCamera();
    render();
  }).observe(container);

  return {
    show(rolls) {
      const key = JSON.stringify(rolls);
      if (rolling || key === shownKey) return;
      cancelAnimationFrame(frame);
      frame = 0;
      shownKey = key;
      place(rolls.flatMap(bodiesFor));
      setDown();
      render();
    },

    play(rolls, { animation, bounce }, onDone, onImpact) {
      cancelAnimationFrame(frame);
      frame = 0;
      rolling = true;
      shownKey = JSON.stringify(rolls);
      const bodies = rolls.flatMap(bodiesFor);
      place(bodies);
      if (animation === 'skip') {
        // Already at rest on the Outcome: no fall and no impact sounds, only the top-face highlight.
        setDown();
        render();
        rolling = false;
        onDone();
        highlight();
        return;
      }
      if (animation === 'reduced' || bodies.length > PHYSICS_BODY_LIMIT) {
        reveal(animation === 'reduced' ? REDUCED_MOTION_DURATION : 500, onDone, onImpact);
        return;
      }
      replay(stageRoll(rolls, { random: Math.random, arena, bounce }), onDone, onImpact);
    },

    setColors(next) {
      if (JSON.stringify(next) === JSON.stringify(colors)) return;
      colors = next;
      // Textures are painted with the colors: repaint every cached model. Meshes share the
      // model's materials array, so replacing its contents recolors them in place.
      for (const found of models.values()) {
        for (const material of found.materials) {
          (material as MeshStandardMaterial).map?.dispose();
          material.dispose();
        }
        found.materials.splice(0, found.materials.length, ...faceMaterials(found.shape));
      }
      render();
    },

    setTable({ color, finish, visible }) {
      const key = `${color}:${finish}:${visible}`;
      if (key === tableKey) return;
      tableKey = key;
      if (!visible) {
        table.material = shadowCatcher;
      } else {
        tableMaterial.map?.dispose();
        tableMaterial.map = finish === 'plain' ? null : tableTexture(finish);
        tableMaterial.color.set(color);
        tableMaterial.roughness = finish === 'felt' ? 0.95 : finish === 'wood' ? 0.62 : 0.75;
        tableMaterial.needsUpdate = true;
        table.material = tableMaterial;
      }
      render();
    },
  };
}

/** The mask lighting up `label` on face `index`: on a d4 only the number at the top corner, else the face label. */
function labelMask(cache: Map<string, CanvasTexture>, shape: DieShape, index: number, label: string): CanvasTexture {
  const key = `${index}:${label}`;
  let mask = cache.get(key);
  if (!mask) {
    mask = faceTexture(shape.faces[index]!, shape, MASK_COLORS, label);
    cache.set(key, mask);
  }
  return mask;
}

/** Height of the die centre above the table when it rests with this orientation. */
function restingHeight(shape: DieShape, orientation: Quaternion): number {
  const corners = shape.faces.flatMap((face) => face.triangles.flat());
  return Math.max(...corners.map((corner) => -corner.clone().applyQuaternion(orientation).y));
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/**
 * The label texture of one face. createDieGeometry maps the face's circumscribed circle onto the
 * texture square, so a face label is sized to fit the face's inscribed circle. A d4 face instead
 * shows the numbers of its three corners, each near its corner and pointing at it.
 */
/** With `maskLabel`, paints a highlight mask instead: only that label, in the given (mask) colors. */
function faceTexture(face: DieFace, shape: DieShape, colors: DiceColors, maskLabel?: string): CanvasTexture {
  const mask = maskLabel !== undefined;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = colors.body;
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = colors.label;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const inscribed = 128 * (face.inradius / face.radius);
  if (shape.sides === 4) {
    const right = face.up.clone().cross(face.normal);
    context.font = `bold ${inscribed * 0.62}px system-ui, sans-serif`;
    for (const corner of face.triangles[0]!) {
      const label = shape.readings.find((reading) => reading.direction.distanceTo(corner.clone().normalize()) < 1e-6)!.label;
      if (mask && label !== maskLabel) continue;
      const offset = corner.clone().sub(face.centroid);
      // Canvas coordinates of the corner (texture v runs up, canvas y down).
      const dx = (offset.dot(right) / face.radius) * 128;
      const dy = -(offset.dot(face.up) / face.radius) * 128;
      context.save();
      context.translate(128 + dx * 0.55, 128 + dy * 0.55);
      context.rotate(Math.atan2(dx, -dy));
      context.fillText(label, 0, 0);
      context.restore();
    }
  } else if (shape.sides === 6) {
    const value = Number(face.label);
    if (colors.specialPips?.values.includes(value)) context.fillStyle = colors.specialPips.color;
    drawPips(context, value, inscribed);
  } else {
    const fontSize = inscribed * (face.label.length > 1 ? 1.05 : 1.35);
    context.font = `bold ${fontSize}px system-ui, sans-serif`;
    context.fillText(face.label, 128, 128);
    // Underline 6 and 9 so they can be told apart on dice where they can appear upside down.
    if (shape.sides >= 8 && (face.label === '6' || face.label === '9')) {
      const width = context.measureText(face.label).width;
      context.fillRect(128 - width / 2, 128 + fontSize * 0.42, width, fontSize * 0.08);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Pip positions on a d6 face, in units of half the face side (x right, y down). */
const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

/** Draws the pips of a d6 face, like a real die, on a face texture whose square face has this half side. */
function drawPips(context: CanvasRenderingContext2D, value: number, halfSide: number) {
  const spread = halfSide * 0.5;
  // The single pip of a 1 is drawn much larger, as on most real dice.
  const pip = halfSide * (value === 1 ? 0.42 : 0.22);
  for (const [x, y] of PIPS[value] ?? []) {
    context.beginPath();
    context.arc(128 + x * spread, 128 + y * spread, pip, 0, Math.PI * 2);
    context.fill();
  }
}

/** A grey tileable surface pattern, tinted by the table color: felt fibres or wood planks. */
function tableTexture(finish: 'felt' | 'wood'): CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  const { data } = image;
  // A small fixed-seed noise so the pattern is the same on every load.
  let seed = 12345;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const plank = size / 4;
  // Smooth wrapping 1D noise (cosine-interpolated random points), so the grain meanders and the tile repeats seamlessly.
  const curve = (count: number) => Array.from({ length: count }, noise);
  const smooth = (points: number[], t: number) => {
    const i = Math.floor(t);
    const a = points[i % points.length]!;
    const b = points[(i + 1) % points.length]!;
    return a + (b - a) * ((1 - Math.cos((t - i) * Math.PI)) / 2);
  };
  const planks = Array.from({ length: 4 }, () => ({ bend: curve(6), ripple: curve(18), shade: 0.9 + noise() * 0.15 }));
  const streaks = curve(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value: number;
      if (finish === 'felt') {
        value = 0.86 + noise() * 0.14;
      } else {
        const row = Math.floor(y / plank);
        const { bend, ripple, shade } = planks[row]!;
        const u = x / size;
        const v = (y % plank) / plank;
        const warp = smooth(bend, u * 6) * 1.6 + smooth(ripple, u * 18) * 0.25;
        // Long grain lines that meander along the plank, fine streaks, and a dark seam between planks.
        const grain = Math.sin((v * 5 + warp) * Math.PI * 2);
        value = shade * (0.8 + grain * 0.06 + Math.sin((v * 23 + warp * 2) * Math.PI * 2) * 0.025 + (streaks[y]! - 0.5) * 0.08 + noise() * 0.03);
        if (v < 0.012 || v > 0.988) value *= 0.5;
      }
      const index = (y * size + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = Math.max(0, Math.min(255, value * 255));
      data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  if (finish === 'felt') {
    // Short fibres for a cloth look.
    context.globalAlpha = 0.08;
    for (let i = 0; i < 4000; i++) {
      context.strokeStyle = noise() < 0.5 ? '#000' : '#fff';
      const x = noise() * size;
      const y = noise() * size;
      const angle = noise() * Math.PI;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * 6, y + Math.sin(angle) * 6);
      context.stroke();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(400 / TILE[finish], 400 / TILE[finish]);
  texture.anisotropy = 8;
  return texture;
}
