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
