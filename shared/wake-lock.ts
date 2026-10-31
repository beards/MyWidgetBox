// Opt-in Screen Wake Lock wiring (ADR-0002): keeps the screen on while a Widget wants it, e.g. while a
// timer runs on a phone. Browsers without the API, or that refuse the lock (low battery, permissions
// policy, hidden page), are silently skipped.

export interface WakeLock {
  /** Holds the lock while `wanted` is true; cheap to call on every state change. */
  set(wanted: boolean): void;
}

export function createWakeLock(): WakeLock {
  let wanted = false;
  let sentinel: WakeLockSentinel | null = null;
  let pending = false;

  async function sync() {
    if (!('wakeLock' in navigator) || pending) return;
    if (wanted && !sentinel && document.visibilityState === 'visible') {
      pending = true;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        sentinel.addEventListener('release', () => (sentinel = null));
      } catch {
        // Refused: the screen may turn off, nothing else breaks.
      } finally {
        pending = false;
      }
      // `wanted` may have changed while the request was pending.
      if (!wanted) void release();
    } else if (!wanted && sentinel) {
      void release();
    }
  }

  async function release() {
    const current = sentinel;
    sentinel = null;
    await current?.release().catch(() => {});
  }

  // The browser drops the lock when the page is hidden; take it again when the page comes back.
  document.addEventListener('visibilitychange', () => void sync());

  return {
    set(next) {
      if (next === wanted) return;
      wanted = next;
      void sync();
    },
  };
}
