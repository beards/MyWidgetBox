// three.js view of the dice: lays the dice out in a grid and animates them onto the
// faces of an Outcome that the controller has already decided. Knows nothing about the controller.
import {
  CanvasTexture,
  DirectionalLight,
  EdgesGeometry,
  Euler,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from 'three';
import type { DieRoll } from './controller';
import { type DieBody, type DieFace, type DieShape, bodiesFor, createDieGeometry, dieShape, landingQuaternion } from './geometry';

export interface DiceScene {
  /** Shows these dice at rest on their faces, without animating; a no-op if they are already shown. */
  show(rolls: DieRoll[]): void;
  /** Animates these dice onto their faces and calls onDone when they have settled. */
  play(rolls: DieRoll[], options: { duration: number; reduced: boolean }, onDone: () => void): void;
}

const FACE_COLOR = '#f7f3e8';
const LABEL_COLOR = '#1f1f1f';
const EDGE_COLOR = '#8a8170';
/** Grid cell size in world units; dice have a circumradius of about 1. */
const CELL = 2.6;
const FIELD_OF_VIEW = 30;
/** Small fixed tilt so dice look three-dimensional while the landed face still faces the viewer. */
const RESTING_TILT = new Quaternion().setFromEuler(new Euler(-0.2, 0.15, 0));

interface Model {
  shape: DieShape;
  geometry: BufferGeometry;
  edges: EdgesGeometry;
  materials: Material[];
}

interface Motion {
  mesh: Mesh;
  rest: Vector3;
  final: Quaternion;
  axis: Vector3;
  turns: number;
  drop: Vector3;
  /** Fraction of the total duration after which this die has settled (dice settle at slightly different times). */
  end: number;
}

export function createDiceScene(container: HTMLElement): DiceScene {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  container.append(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 500);
  scene.add(new HemisphereLight(0xffffff, 0x8a8a99, 1.6));
  const sun = new DirectionalLight(0xffffff, 1.8);
  sun.position.set(-3, 5, 8);
  scene.add(sun);

  const models = new Map<string, Model>();
  const edgeMaterial = new LineBasicMaterial({ color: EDGE_COLOR });
  let meshes: Mesh[] = [];
  let shownKey = '';
  let grid = { cols: 1, rows: 1 };
  let frame = 0;

  function model(body: DieBody): Model {
    const key = `${body.sides}:${body.labels.join(',')}`;
    let found = models.get(key);
    if (!found) {
      const shape = dieShape(body.sides, body.labels);
      const geometry = createDieGeometry(shape);
      found = {
        shape,
        geometry,
        edges: new EdgesGeometry(geometry, 1),
        materials: shape.faces.map((face) => new MeshStandardMaterial({ map: faceTexture(face, body.sides), roughness: 0.55 })),
      };
      models.set(key, found);
    }
    return found;
  }

  /** Replaces the dice in the scene and returns each one's resting position and landing rotation. */
  function layOut(rolls: DieRoll[]) {
    meshes.forEach((mesh) => scene.remove(mesh));
    const bodies = rolls.flatMap(bodiesFor);
    const { width, height } = size();
    const cols = Math.max(1, Math.min(bodies.length, Math.round(Math.sqrt((bodies.length * width) / height))));
    grid = { cols, rows: Math.ceil(bodies.length / cols) };
    const placed = bodies.map((body, index) => {
      const { shape, geometry, edges, materials } = model(body);
      const mesh = new Mesh(geometry, materials);
      mesh.add(new LineSegments(edges, edgeMaterial));
      const face = shape.faces.find((candidate) => candidate.label === body.label)!;
      const col = index % cols;
      const row = Math.floor(index / cols);
      const rest = new Vector3((col - (cols - 1) / 2) * CELL, ((grid.rows - 1) / 2 - row) * CELL, 0);
      return { mesh, rest, final: RESTING_TILT.clone().multiply(landingQuaternion(face)) };
    });
    meshes = placed.map(({ mesh }) => mesh);
    meshes.forEach((mesh) => scene.add(mesh));
    shownKey = JSON.stringify(rolls);
    fitCamera();
    return placed;
  }

  function size() {
    return { width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight) };
  }

  function fitCamera() {
    const { width, height } = size();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const tanHalf = Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180);
    const distance = Math.max((grid.rows * CELL) / 2 / tanHalf, (grid.cols * CELL) / 2 / (tanHalf * camera.aspect));
    camera.position.set(0, 0, distance + 2);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  function render() {
    renderer.render(scene, camera);
  }

  new ResizeObserver(() => {
    fitCamera();
    render();
  }).observe(container);

  return {
    show(rolls) {
      if (frame !== 0 || JSON.stringify(rolls) === shownKey) return;
      for (const { mesh, rest, final } of layOut(rolls)) {
        mesh.position.copy(rest);
        mesh.quaternion.copy(final);
      }
      render();
    },

    play(rolls, { duration, reduced }, onDone) {
      cancelAnimationFrame(frame);
      const motions: Motion[] = layOut(rolls).map((placed) => ({
        ...placed,
        axis: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        // Roughly one turn per second of animation, plus a random part so dice do not spin in lockstep.
        turns: reduced ? 0 : 1 + duration / 1000 + Math.random(),
        drop: new Vector3((Math.random() - 0.5) * 0.4 * CELL, (Math.random() - 0.5) * 0.4 * CELL, 1.5 + Math.random()),
        end: reduced ? 1 : 0.8 + Math.random() * 0.2,
      }));
      const start = performance.now();
      const step = (now: number) => {
        const elapsed = Math.min(1, (now - start) / duration);
        for (const motion of motions) pose(motion, Math.min(1, elapsed / motion.end), reduced);
        render();
        if (elapsed < 1) {
          frame = requestAnimationFrame(step);
        } else {
          frame = 0;
          onDone();
        }
      };
      frame = requestAnimationFrame(step);
    },
  };
}

/** Places one die at progress t (0..1): it falls toward its cell, bounces, and spins down onto its landing face. */
function pose({ mesh, rest, final, axis, turns, drop }: Motion, t: number, reduced: boolean) {
  if (reduced) {
    // Quick reveal without movement: the die grows into place already on its face.
    mesh.position.copy(rest);
    mesh.quaternion.copy(final);
    mesh.scale.setScalar(0.6 + 0.4 * easeOutCubic(t));
    return;
  }
  const remaining = 1 - easeOutCubic(t);
  const bounce = Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 1.2;
  mesh.position.copy(rest).addScaledVector(drop, remaining * remaining);
  mesh.position.z += bounce;
  mesh.quaternion.setFromAxisAngle(axis, remaining * turns * 2 * Math.PI).multiply(final);
  mesh.scale.setScalar(1);
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/**
 * The label texture of one face. createDieGeometry maps the face's circumscribed circle onto
 * the texture square, so the label is sized to fit the face's inscribed circle.
 */
function faceTexture(face: DieFace, sides: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = FACE_COLOR;
  context.fillRect(0, 0, 256, 256);
  const inscribed = 128 * (face.inradius / face.radius);
  const fontSize = inscribed * (face.label.length > 1 ? 1.05 : 1.35);
  context.fillStyle = LABEL_COLOR;
  context.font = `bold ${fontSize}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(face.label, 128, 128);
  // Underline 6 and 9 so they can be told apart on dice where they can appear upside down.
  if (sides >= 8 && (face.label === '6' || face.label === '9')) {
    const width = context.measureText(face.label).width;
    context.fillRect(128 - width / 2, 128 + fontSize * 0.42, width, fontSize * 0.08);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

