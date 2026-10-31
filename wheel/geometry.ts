// Pure wheel math used by the view (no DOM), so it can be tested in Node.

/**
 * The clockwise rotation (degrees) to animate to from `from`, turning at least `turns` full
 * turns, so that wheel angle `angle` (clockwise from the top of the unrotated wheel) ends
 * under the pointer at the top.
 */
export function landingRotation(from: number, angle: number, turns: number): number {
  const mod = (value: number) => ((value % 360) + 360) % 360;
  // Rotating by r puts wheel angle a at screen angle a + r, so the pointer needs r ≡ -angle.
  return from + turns * 360 + mod(-angle - from);
}

/** Quartic ease-out: a long, slow finish, like a real wheel coasting to a stop. */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 4;
}

/**
 * Index of the sector under the top pointer once the wheel is rotated clockwise by `rotation`
 * degrees (sectors as from sectorsFor), or -1 for an empty wheel. The view ticks when it changes.
 */
export function sectorUnderPointer(sectors: { start: number; end: number }[], rotation: number): number {
  if (sectors.length === 0) return -1;
  const angle = (((-rotation % 360) + 360) % 360);
  const index = sectors.findIndex((sector) => angle < sector.end);
  return index === -1 ? sectors.length - 1 : index;
}
