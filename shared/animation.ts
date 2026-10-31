// Shared (opt-in) animation Settings for Widgets that animate an Outcome (dice roll, wheel spin):
// a full animation length plus an override of the system's reduced-motion preference.

export interface AnimationSettings {
  /** Length of the full animation in ms, MIN_ANIMATION_DURATION..MAX_ANIMATION_DURATION. */
  duration: number;
  /** Play the full animation even when the system asks for reduced motion. */
  alwaysFull: boolean;
}

export const MIN_ANIMATION_DURATION = 1000;
export const MAX_ANIMATION_DURATION = 10_000;
/** Duration of the quick reveal that replaces the full animation under reduced motion. */
export const REDUCED_MOTION_DURATION = 300;

export function isAnimationDuration(duration: unknown): duration is number {
  return typeof duration === 'number' && duration >= MIN_ANIMATION_DURATION && duration <= MAX_ANIMATION_DURATION;
}

export function isAnimationSettings(value: unknown): value is AnimationSettings {
  const { duration, alwaysFull } = (value ?? {}) as Partial<AnimationSettings>;
  return isAnimationDuration(duration) && typeof alwaysFull === 'boolean';
}

/** How the view should animate, given the animation Settings in effect and whether the system asks for reduced motion. */
export function animationFor(
  { animationDuration, alwaysFullAnimation }: { animationDuration: number; alwaysFullAnimation: boolean },
  prefersReducedMotion: boolean,
): { duration: number; reduced: boolean } {
  const reduced = prefersReducedMotion && !alwaysFullAnimation;
  return { duration: reduced ? REDUCED_MOTION_DURATION : animationDuration, reduced };
}
