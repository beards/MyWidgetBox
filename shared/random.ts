const UINT32_RANGE = 2 ** 32;

/**
 * Uniform integer in [0, n) using rejection sampling, so there is no modulo bias:
 * values in the incomplete top bucket of the uint32 range are discarded and redrawn.
 */
export function randomBelow(randomUint32: () => number, n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > UINT32_RANGE) {
    throw new RangeError(`randomBelow: n must be an integer in [1, 2^32], got ${n}`);
  }
  const limit = UINT32_RANGE - (UINT32_RANGE % n);
  for (;;) {
    const value = randomUint32();
    if (value < limit) return value % n;
  }
}
