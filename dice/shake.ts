/** One accelerometer reading in m/s² (gravity included); null axes mean the device gave no data. */
export interface MotionSample {
  x: number | null;
  y: number | null;
  z: number | null;
  /** ms */
  time: number;
}

/** Change in acceleration between two readings (m/s²) that counts as a shake. */
export const SHAKE_THRESHOLD = 20;
/** After a shake, further shakes are ignored for this long (ms) so one shake rolls once. */
export const SHAKE_COOLDOWN = 1000;

/** Pure shake detection: feed it samples in order; returns true for the sample that completes a shake. */
export function createShakeDetector(): (sample: MotionSample) => boolean {
  let previous: { x: number; y: number; z: number } | null = null;
  let lastShake = -Infinity;
  return ({ x, y, z, time }) => {
    if (x === null || y === null || z === null) return false;
    const last = previous;
    previous = { x, y, z };
    if (!last || time - lastShake < SHAKE_COOLDOWN) return false;
    if (Math.hypot(x - last.x, y - last.y, z - last.z) < SHAKE_THRESHOLD) return false;
    lastShake = time;
    return true;
  };
}

type PermissionRequester = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * Starts listening for shakes. Must be called from a user gesture: iOS asks for motion permission here.
 * Resolves to a stop function, or to 'unsupported' / 'denied' when shakes cannot be detected.
 */
export async function listenForShakes(onShake: () => void): Promise<(() => void) | 'unsupported' | 'denied'> {
  if (typeof DeviceMotionEvent === 'undefined') return 'unsupported';
  const { requestPermission } = DeviceMotionEvent as unknown as PermissionRequester;
  if (requestPermission) {
    try {
      if ((await requestPermission()) !== 'granted') return 'denied';
    } catch {
      return 'denied';
    }
  }
  const detect = createShakeDetector();
  const listener = (event: DeviceMotionEvent) => {
    const a = event.accelerationIncludingGravity;
    if (detect({ x: a?.x ?? null, y: a?.y ?? null, z: a?.z ?? null, time: event.timeStamp })) onShake();
  };
  window.addEventListener('devicemotion', listener);
  return () => window.removeEventListener('devicemotion', listener);
}
