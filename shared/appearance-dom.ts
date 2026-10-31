// DOM side of shared/appearance.ts. View-layer only; untested by design (manual check).
import {
  type Appearance,
  BACKGROUND_KINDS,
  type BackgroundKind,
  FONT_SIZE_RANGE,
  MAX_FONT_FAMILY_LENGTH,
  SCALE_RANGE,
} from './appearance';
import type { AppearanceMessageKey } from './appearance-messages';
import type { I18n } from './i18n';

export interface AppearanceTargets {
  /** Gets the background; normally document.documentElement, so `transparent` reaches OBS. */
  page: HTMLElement;
  /** The Widget's display (what is shown in Display mode); gets font and scale. */
  display: HTMLElement;
}

export interface ApplyAppearanceOptions {
  /**
   * Shows a transparent background whatever the Settings say, without changing them;
   * used for the Share link's `transparent` Display-mode flag (readDisplayOptions()).
   */
  forceTransparent?: boolean;
}

/**
 * Applies the baseline appearance; the only place that paints the page background.
 * A Widget applies its own items (e.g. colors) itself.
 */
export function applyAppearance(
  { background, fontFamily, fontSize, textColor, scale }: Appearance,
  targets: AppearanceTargets,
  { forceTransparent = false }: ApplyAppearanceOptions = {},
): void {
  const kind = forceTransparent ? 'transparent' : background.kind;
  const { style } = targets.page;
  style.backgroundColor = kind === 'transparent' ? 'transparent' : background.color;
  // The URL was validated as http(s); href is percent-encoded, so it cannot leave the quotes.
  style.backgroundImage = kind === 'image' && background.imageUrl ? `url("${new URL(background.imageUrl).href}")` : '';
  style.backgroundSize = 'cover';
  style.backgroundPosition = 'center';
  style.backgroundAttachment = 'fixed';

  const display = targets.display.style;
  display.fontFamily = fontFamily;
  display.fontSize = `${fontSize}px`;
  display.color = textColor;
  display.zoom = String(scale);
}

/** A Widget-specific color item shown after the baseline items. */
export interface AppearanceColorField<A> {
  key: { [K in keyof A]: A[K] extends string ? K : never }[keyof A] & string;
  label: () => string;
  /** Adds one-click white and black buttons beside the color picker. */
  quickColors?: boolean;
}

export interface AppearancePanelOptions<A extends Appearance> {
  i18n: I18n<AppearanceMessageKey>;
  fields?: AppearanceColorField<A>[];
  /** False for a Widget that sizes its text another way. */
  fontSize?: boolean;
  /** False for a Widget whose display has no text the shared text color would color. */
  textColor?: boolean;
  /** Called with the whole next appearance on every edit (live preview); the caller validates. */
  onChange(appearance: A): void;
}

export interface AppearancePanel<A> {
  /** Shows these values; the input being typed into is left alone so typing is not disturbed. */
  update(appearance: A): void;
}

/** Suggestions for the font input; any installed font family can be typed. */
const FONT_SUGGESTIONS = [
  'system-ui, sans-serif',
  'Georgia, serif',
  'ui-monospace, monospace',
  'ui-rounded, "Arial Rounded MT Bold", sans-serif',
  '"Noto Sans TC", sans-serif',
  'Impact, sans-serif',
];

const BACKGROUND_LABELS: Record<BackgroundKind, AppearanceMessageKey> = {
  solid: 'backgroundSolid',
  transparent: 'backgroundTransparent',
  image: 'backgroundImage',
};

/** Builds the appearance form inside container. Text follows the i18n locale. */
export function mountAppearancePanel<A extends Appearance>(
  container: HTMLElement,
  { i18n, fields = [], fontSize: showFontSize = true, textColor: showTextColor = true, onChange }: AppearancePanelOptions<A>,
): AppearancePanel<A> {
  const { t } = i18n;
  let current: A | null = null;
  /** The input whose 'input' event is being handled; update() leaves it as typed. */
  let editing: HTMLElement | null = null;
  const syncs: (() => void)[] = [];
  const relabels: (() => void)[] = [];

  function row(label: () => string, input: HTMLElement, ...extra: HTMLElement[]) {
    const wrapper = document.createElement('label');
    const text = document.createElement('span');
    relabels.push(() => (text.textContent = label()));
    wrapper.append(text, input, ...extra);
    container.append(wrapper);
    return wrapper;
  }

  /** Wires an input: edits produce a whole next appearance; update() writes values back. */
  function bind<E extends HTMLInputElement | HTMLSelectElement>(
    input: E,
    read: (input: E, appearance: A) => A,
    write: (input: E, appearance: A) => void,
  ) {
    const send = (live: boolean) => {
      if (!current) return;
      editing = live ? input : null;
      try {
        onChange(read(input, current));
      } finally {
        editing = null;
      }
    };
    input.addEventListener('input', () => send(true));
    // On commit, snap back to whatever the caller accepted.
    input.addEventListener('change', () => send(false));
    syncs.push(() => {
      if (current && input !== editing) write(input, current);
    });
  }

  const input = (type: string, attributes: Record<string, string> = {}) => {
    const element = document.createElement('input');
    element.type = type;
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    return element;
  };
  const withBackground = (appearance: A, change: Partial<Appearance['background']>): A => ({
    ...appearance,
    background: { ...appearance.background, ...change },
  });

  const heading = document.createElement('h2');
  relabels.push(() => (heading.textContent = t('appearance')));
  container.append(heading);

  const kind = document.createElement('select');
  row(() => t('background'), kind);
  relabels.push(() => {
    const selected = kind.value;
    kind.replaceChildren(...BACKGROUND_KINDS.map((value) => new Option(t(BACKGROUND_LABELS[value]), value)));
    kind.value = selected || (current?.background.kind ?? 'solid');
  });
  bind(
    kind,
    (element, appearance) => withBackground(appearance, { kind: element.value as BackgroundKind }),
    (element, appearance) => (element.value = appearance.background.kind),
  );

  const color = input('color');
  const colorRow = row(() => t('backgroundColor'), color);
  bind(
    color,
    (element, appearance) => withBackground(appearance, { color: element.value }),
    (element, appearance) => (element.value = appearance.background.color),
  );

  const imageUrl = input('url', { placeholder: 'https://', spellcheck: 'false' });
  const imageRow = row(() => t('imageUrl'), imageUrl);
  bind(
    imageUrl,
    (element, appearance) => withBackground(appearance, { imageUrl: element.value.trim() }),
    (element, appearance) => (element.value = appearance.background.imageUrl),
  );
  syncs.push(() => {
    colorRow.hidden = current?.background.kind === 'transparent';
    imageRow.hidden = current?.background.kind !== 'image';
  });

  const fontFamily = input('text', { list: 'appearance-fonts', maxlength: String(MAX_FONT_FAMILY_LENGTH) });
  const fonts = document.createElement('datalist');
  fonts.id = 'appearance-fonts';
  fonts.append(...FONT_SUGGESTIONS.map((font) => new Option(font)));
  relabels.push(() => (fontFamily.placeholder = t('fontFamilyDefault')));
  row(() => t('fontFamily'), fontFamily, fonts);
  bind(
    fontFamily,
    (element, appearance) => ({ ...appearance, fontFamily: element.value }),
    (element, appearance) => (element.value = appearance.fontFamily),
  );

  const fontSize = input('number', { min: String(FONT_SIZE_RANGE.min), max: String(FONT_SIZE_RANGE.max), step: '1' });
  row(() => t('fontSize'), fontSize).hidden = !showFontSize;
  bind(
    fontSize,
    (element, appearance) => ({ ...appearance, fontSize: element.valueAsNumber }),
    (element, appearance) => (element.value = String(appearance.fontSize)),
  );

  const textColor = input('color');
  row(() => t('textColor'), textColor).hidden = !showTextColor;
  bind(
    textColor,
    (element, appearance) => ({ ...appearance, textColor: element.value }),
    (element, appearance) => (element.value = appearance.textColor),
  );

  const scale = input('range', { min: String(SCALE_RANGE.min), max: String(SCALE_RANGE.max), step: '0.05' });
  const scaleValue = document.createElement('output');
  row(() => t('scale'), scale, scaleValue);
  bind(
    scale,
    (element, appearance) => ({ ...appearance, scale: element.valueAsNumber }),
    (element, appearance) => (element.value = String(appearance.scale)),
  );
  syncs.push(() => (scaleValue.textContent = current ? `${Math.round(current.scale * 100)}%` : ''));

  for (const field of fields) {
    const element = input('color');
    const quick = field.quickColors
      ? (['#ffffff', '#000000'] as const).map((value) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'appearance__quick-color';
          button.style.backgroundColor = value;
          relabels.push(() => {
            button.title = t(value === '#ffffff' ? 'colorWhite' : 'colorBlack');
            button.setAttribute('aria-label', button.title);
          });
          button.addEventListener('click', () => {
            if (current) onChange({ ...current, [field.key]: value });
          });
          return button;
        })
      : [];
    row(field.label, element, ...quick);
    bind(
      element,
      (target, appearance) => ({ ...appearance, [field.key]: target.value }),
      (target, appearance) => (target.value = appearance[field.key] as string),
    );
  }

  const relabel = () => relabels.forEach((apply) => apply());
  relabel();
  i18n.subscribe(relabel);

  return {
    update(appearance) {
      current = appearance;
      syncs.forEach((sync) => sync());
    },
  };
}
