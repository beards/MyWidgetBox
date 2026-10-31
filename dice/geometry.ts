// Pure dice geometry (no DOM, no WebGL): polyhedron faces, their labels, and the
// rotation that lands a chosen face toward the viewer. The 3D view builds on this.
import {
  BoxGeometry,
  BufferGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  OctahedronGeometry,
  Quaternion,
  TetrahedronGeometry,
  Vector3,
} from 'three';
import type { DieRoll } from './controller';

/** Physical die shapes; a d100 is shown as two d10 bodies. */
export type BodySides = 4 | 6 | 8 | 10 | 12 | 20;

export interface DieFace {
  label: string;
  /** Outward unit normal, in die coordinates. */
  normal: Vector3;
  /** Unit vector in the face plane pointing to the top of the label. */
  up: Vector3;
  centroid: Vector3;
  /** Distance from the centroid to the farthest vertex. */
  radius: number;
  /** Distance from the centroid to the nearest edge. */
  inradius: number;
  triangles: Vector3[][];
}

export interface DieShape {
  sides: BodySides;
  faces: DieFace[];
}

/** One rendered die body and the face label it must land on. */
export interface DieBody {
  sides: BodySides;
  labels: string[];
  label: string;
}

const EPSILON = 1e-6;
const TENS_LABELS = Array.from({ length: 10 }, (_, i) => `${i}0`);
const UNITS_LABELS = Array.from({ length: 10 }, (_, i) => String(i));

export function numberLabels(sides: number): string[] {
  return Array.from({ length: sides }, (_, i) => String(i + 1));
}

/** The bodies that show one die roll: a d100 is a tens d10 (00–90) plus a units d10 (0–9); 100 is 00 + 0. */
export function bodiesFor({ sides, value }: DieRoll): DieBody[] {
  if (sides !== 100) return [{ sides, labels: numberLabels(sides), label: String(value) }];
  const tens = Math.floor((value % 100) / 10);
  return [
    { sides: 10, labels: TENS_LABELS, label: TENS_LABELS[tens]! },
    { sides: 10, labels: UNITS_LABELS, label: UNITS_LABELS[value % 10]! },
  ];
}

/** Faces of a die; opposite faces get labels from opposite ends of the list (like real dice summing to n + 1). */
export function dieShape(sides: BodySides, labels: string[] = numberLabels(sides)): DieShape {
  const faces = groupFaces(triangles(sides));
  if (faces.length !== sides) throw new Error(`d${sides}: expected ${sides} faces, got ${faces.length}`);
  const assigned = new Set<UnlabeledFace>();
  let low = 0;
  let high = sides - 1;
  for (const face of faces) {
    if (assigned.has(face)) continue;
    face.label = labels[low++]!;
    assigned.add(face);
    const opposite = faces.find((other) => other.normal.dot(face.normal) < -1 + EPSILON);
    if (opposite && !assigned.has(opposite)) {
      opposite.label = labels[high--]!;
      assigned.add(opposite);
    }
  }
  return { sides, faces: faces as DieFace[] };
}

/** Rotation that turns this face toward the viewer (+z) with its label upright (+y). */
export function landingQuaternion(face: DieFace): Quaternion {
  const right = face.up.clone().cross(face.normal);
  const basis = new Matrix4().makeBasis(right, face.up, face.normal);
  return new Quaternion().setFromRotationMatrix(basis.transpose());
}

/** Flat-shaded mesh geometry with one material group per face (in shape.faces order) and UVs centred on each face. */
export function createDieGeometry(shape: DieShape): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const geometry = new BufferGeometry();
  shape.faces.forEach((face, index) => {
    const right = face.up.clone().cross(face.normal);
    const start = positions.length / 3;
    for (const triangle of face.triangles) {
      for (const point of triangle) {
        const offset = point.clone().sub(face.centroid);
        positions.push(point.x, point.y, point.z);
        normals.push(face.normal.x, face.normal.y, face.normal.z);
        uvs.push(0.5 + offset.dot(right) / (2 * face.radius), 0.5 + offset.dot(face.up) / (2 * face.radius));
      }
    }
    geometry.addGroup(start, positions.length / 3 - start, index);
  });
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return geometry;
}

type UnlabeledFace = Omit<DieFace, 'label'> & { label?: string };

function triangles(sides: BodySides): Vector3[][] {
  if (sides === 10) return pentagonalTrapezohedron();
  const source = {
    4: () => new TetrahedronGeometry(1.15),
    6: () => new BoxGeometry(1.2, 1.2, 1.2),
    8: () => new OctahedronGeometry(1),
    12: () => new DodecahedronGeometry(1),
    20: () => new IcosahedronGeometry(1),
  }[sides]();
  const geometry = source.index ? source.toNonIndexed() : source;
  const position = geometry.getAttribute('position');
  const result: Vector3[][] = [];
  for (let i = 0; i < position.count; i += 3) {
    result.push([0, 1, 2].map((k) => new Vector3().fromBufferAttribute(position, i + k)));
  }
  return result;
}

/** d10: two apexes and a zig-zag ring of 10 vertices, forming 10 planar kites. */
function pentagonalTrapezohedron(): Vector3[][] {
  const ringZ = 0.105;
  const cos36 = Math.cos(Math.PI / 5);
  // Apex height that makes each kite planar.
  const apexZ = (ringZ * (1 + cos36)) / (1 - cos36);
  const ring = (k: number, z: number) => new Vector3(Math.cos((k * Math.PI) / 5), Math.sin((k * Math.PI) / 5), z);
  const top = new Vector3(0, 0, apexZ);
  const bottom = new Vector3(0, 0, -apexZ);
  const upper = (k: number) => ring(2 * k, ringZ);
  const lower = (k: number) => ring(2 * k + 1, -ringZ);
  const result: Vector3[][] = [];
  for (let k = 0; k < 5; k++) {
    result.push([top, upper(k), lower(k)], [top, lower(k), upper(k + 1)]);
    result.push([bottom, lower(k), upper(k + 1)], [bottom, upper(k + 1), lower(k + 1)]);
  }
  return result;
}

/** Merges coplanar triangles of a convex, origin-centred polyhedron into faces, winding every triangle outward. */
function groupFaces(source: Vector3[][]): UnlabeledFace[] {
  const groups: { normal: Vector3; triangles: Vector3[][] }[] = [];
  for (const triangle of source) {
    const [a, b, c] = triangle as [Vector3, Vector3, Vector3];
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const outward = normal.dot(a) > 0 ? [a, b, c] : [a, c, b];
    if (normal.dot(a) < 0) normal.negate();
    const group = groups.find((candidate) => candidate.normal.dot(normal) > 1 - EPSILON);
    if (group) group.triangles.push(outward);
    else groups.push({ normal, triangles: [outward] });
  }
  return groups.map(({ normal, triangles }) => {
    const vertices = uniquePoints(triangles.flat());
    const centroid = vertices.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(vertices.length);
    const distances = vertices.map((point) => point.distanceTo(centroid));
    const radius = Math.max(...distances);
    const isSquare = vertices.length === 4 && Math.min(...distances) > radius - EPSILON;
    // Point the label at a corner (triangles, pentagons, the d10 kite apex), or at an edge for squares.
    const farthest = vertices[distances.indexOf(radius)]!;
    const toward = isSquare ? farthest.clone().add(nearestOther(vertices, farthest)).divideScalar(2) : farthest;
    const up = toward.clone().sub(centroid);
    up.sub(normal.clone().multiplyScalar(up.dot(normal))).normalize();
    return { normal, up, centroid, radius, inradius: inradius(triangles, centroid), triangles };
  });
}

function uniquePoints(points: Vector3[]): Vector3[] {
  const result: Vector3[] = [];
  for (const point of points) {
    if (!result.some((other) => other.distanceTo(point) < EPSILON)) result.push(point);
  }
  return result;
}

function nearestOther(points: Vector3[], from: Vector3): Vector3 {
  const others = points.filter((point) => point.distanceTo(from) > EPSILON);
  return others.reduce((best, point) => (point.distanceTo(from) < best.distanceTo(from) ? point : best));
}

/** Distance from centroid to the nearest boundary edge (an edge used by only one triangle of the face). */
function inradius(triangles: Vector3[][], centroid: Vector3): number {
  const edges = triangles.flatMap(([a, b, c]) => [
    [a!, b!],
    [b!, c!],
    [c!, a!],
  ]);
  const sameEdge = ([a, b]: Vector3[], [c, d]: Vector3[]) =>
    (a!.distanceTo(c!) < EPSILON && b!.distanceTo(d!) < EPSILON) ||
    (a!.distanceTo(d!) < EPSILON && b!.distanceTo(c!) < EPSILON);
  const boundary = edges.filter((edge) => edges.filter((other) => sameEdge(edge, other)).length === 1);
  return Math.min(
    ...boundary.map(([a, b]) => {
      const direction = b!.clone().sub(a!).normalize();
      const offset = centroid.clone().sub(a!);
      return offset.sub(direction.multiplyScalar(offset.dot(direction))).length();
    }),
  );
}
