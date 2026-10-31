/**
 * Shared (opt-in) appearance baseline: the look every Widget can offer, stored in its
 * Settings (so it follows Presets and Share links). A Widget extends `Appearance` with its
 * own items (e.g. dice body / pip colors) and checks them next to `isAppearance`.
 * Pure data and validation; the DOM side is in appearance-dom.ts.
 */

export const BACKGROUND_KINDS = ['solid', 'transparent', 'image'] as const;
export type BackgroundKind = (typeof BACKGROUND_KINDS)[number];

/**
 * One flat object for all kinds, so switching kind keeps the color and image URL the user
 * entered (and so missing fields can be filled from defaults). `transparent` is also what
 * Display mode reuses for overlays.
 */
export interface Background {
  kind: BackgroundKind;
  /** `#rrggbb`; the page color for `solid`, and shown under the image for `image`. */
  color: string;
  /** http(s) URL, or '' when none has been entered. Used by `image`. */
  imageUrl: string;
}

export interface Appearance {
  background: Background;
  /** CSS font-family list, or '' for the page default. */
  fontFamily: string;
  /** Text size in CSS px. */
  fontSize: number;
  /** Overall zoom factor of the Widget's display. */
  scale: number;
}

export const FONT_SIZE_RANGE = { min: 8, max: 160 } as const;
export const SCALE_RANGE = { min: 0.25, max: 4 } as const;
export const MAX_FONT_FAMILY_LENGTH = 200;

export const appearanceDefaults: Appearance = {
  background: { kind: 'solid', color: '#ffffff', imageUrl: '' },
  fontFamily: '',
  fontSize: 20,
  scale: 1,
};

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/** '' or an absolute http(s) URL. */
export function isImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === '') return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Checks the baseline fields; a Widget's `isValid` calls this and checks its own items too. */
export function isAppearance(value: unknown): value is Appearance {
  const { background, fontFamily, fontSize, scale } = (value ?? {}) as Partial<Appearance>;
  return (
    typeof background === 'object' &&
    background !== null &&
    BACKGROUND_KINDS.includes(background.kind) &&
    isHexColor(background.color) &&
    isImageUrl(background.imageUrl) &&
    typeof fontFamily === 'string' &&
    fontFamily.length <= MAX_FONT_FAMILY_LENGTH &&
    inRange(fontSize, FONT_SIZE_RANGE) &&
    inRange(scale, SCALE_RANGE)
  );
}

function inRange(value: unknown, { min, max }: { min: number; max: number }): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
