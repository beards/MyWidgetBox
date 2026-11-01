/**
 * Shared (opt-in) appearance baseline: the look every Widget can offer, stored in its
 * Settings (so it follows Presets and Share links). A Widget extends `Appearance` with its
 * own items (e.g. dice body / pip colors) and checks them next to `isAppearance`.
 * Pure data and validation; the DOM side is in appearance-dom.ts.
 */
import { isHttpUrlOrEmpty } from './url';

export const BACKGROUND_KINDS = ['solid', 'transparent', 'image'] as const;
export type BackgroundKind = (typeof BACKGROUND_KINDS)[number];

/**
 * One flat object for all kinds, so switching kind keeps the color and image URL the user
 * entered (and so missing fields can be filled from defaults). `transparent` is also what
 * Display mode reuses for overlays. A Widget may offer kinds of its own (e.g. the dice felt);
 * any kind other than `transparent` and `image` is painted in the color.
 */
export interface Background<K extends string = BackgroundKind> {
  kind: K;
  /** `#rrggbb`; the page color for `solid`, and shown under the image for `image`. */
  color: string;
  /** http(s) URL, or '' when none has been entered. Used by `image`. */
  imageUrl: string;
}

export interface Appearance<K extends string = BackgroundKind> {
  background: Background<K>;
  /** CSS font-family list, or '' for the page default. */
  fontFamily: string;
  /** Text size in CSS px. */
  fontSize: number;
  /** `#rrggbb` text color of the display. */
  textColor: string;
}

/** The baseline plus a zoom, for a Widget whose display is plain DOM (the dice size their 3D scene instead). */
export interface ScaledAppearance extends Appearance {
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
  textColor: '#222222',
};

export const scaledAppearanceDefaults: ScaledAppearance = { ...appearanceDefaults, scale: 1 };

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/**
 * Checks the baseline fields, with the background kinds the Widget offers; a Widget's `isValid`
 * calls this and checks its own items too.
 */
export function isAppearance<K extends string = BackgroundKind>(
  value: unknown,
  kinds: readonly K[] = BACKGROUND_KINDS as readonly string[] as readonly K[],
): value is Appearance<K> {
  const { background, fontFamily, fontSize, textColor } = (value ?? {}) as Partial<Appearance<K>>;
  return (
    typeof background === 'object' &&
    background !== null &&
    kinds.includes(background.kind) &&
    isHexColor(background.color) &&
    isHttpUrlOrEmpty(background.imageUrl) &&
    typeof fontFamily === 'string' &&
    fontFamily.length <= MAX_FONT_FAMILY_LENGTH &&
    inRange(fontSize, FONT_SIZE_RANGE) &&
    isHexColor(textColor)
  );
}

export function isScaledAppearance(value: unknown): value is ScaledAppearance {
  return isAppearance(value) && inRange((value as Partial<ScaledAppearance>).scale, SCALE_RANGE);
}

function inRange(value: unknown, { min, max }: { min: number; max: number }): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
