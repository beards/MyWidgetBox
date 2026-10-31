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

/** Chance that the wheel stops just short of the border it is about to cross. */
const NEAR_NEXT_BORDER = 0.45;
/** Chance that it stops just past the border it has crossed (otherwise: anywhere). */
const NEAR_LAST_BORDER = 0.3;
/** Closest and farthest distance (degrees) from a border when stopping near one. */
const BORDER_GAP = { min: 0.4, max: 10 };

/**
 * Where the pointer stops in the winning sector (wheel angle, degrees), from a uniform draw
 * `u` in [0, 1). Which entry wins is decided before, so this only sets the suspense: often
 * just short of the next border (the wheel turns clockwise, so the pointer moves towards
 * `start`), sometimes just past the last one, otherwise anywhere in the inner 80%. Never on a
 * border: gaps shrink with tiny sectors.
 */
export function landingAngle({ start, end }: { start: number; end: number }, u: number): number {
  const span = end - start;
  const gap = (v: number) => {
    const min = Math.min(BORDER_GAP.min, span * 0.1);
    const max = Math.min(BORDER_GAP.max, span * 0.25);
    return min + (max - min) * v;
  };
  if (u < NEAR_NEXT_BORDER) return start + gap(u / NEAR_NEXT_BORDER);
  const anywhere = NEAR_NEXT_BORDER + NEAR_LAST_BORDER;
  if (u < anywhere) return end - gap((u - NEAR_NEXT_BORDER) / NEAR_LAST_BORDER);
  return start + span * (0.1 + 0.8 * ((u - anywhere) / (1 - anywhere)));
}

/** Share of the spin time taken by the fast slowdown; the rest is the slow coast. */
const SLOWDOWN_TIME = 0.35;
/** Speed at the start of the coast, as a share of the starting speed. */
const COAST_SPEED = 0.06;

/**
 * Share of the turning done after share `t` of the spin time (both 0..1). The wheel slows down
 * quickly to a crawl (speed falling from 1 to COAST_SPEED over SLOWDOWN_TIME), then coasts slowly,
 * slowing down evenly, until it stops: the last sectors pass one by one for most of the spin.
 */
export function spinProgress(t: number): number {
  const p = SLOWDOWN_TIME;
  const c = COAST_SPEED;
  // Speed in the slowdown: c + (1 - c)(1 - t/p)^2; in the coast: c(1 - s), s = (t - p)/(1 - p).
  const slowdown = (u: number) => c * u + ((1 - c) * p * (1 - (1 - u / p) ** 3)) / 3;
  const coast = (s: number) => c * (1 - p) * (s - (s * s) / 2);
  const total = slowdown(p) + coast(1);
  const done = t <= p ? slowdown(Math.max(0, t)) : slowdown(p) + coast(Math.min(1, (t - p) / (1 - p)));
  return done / total;
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

/** Labels never get bigger than this (in wheel units, the wheel radius being 100), even with no size limit… */
export const MAX_LABEL_SIZE = 80;
/** …nor smaller: what still does not fit at this size is cut with an ellipsis. */
export const MIN_LABEL_SIZE = 3;

/** Distance between the lines of a wrapped label, in font sizes. */
const LINE_HEIGHT = 1.15;
const MAX_LABEL_LINES = 8;
/** Places tried for a block of across lines, from the rim inwards. */
const ACROSS_PLACES = 7;
/** One break opportunity each: a run of spaces, a CJK character, or a word. */
const TOKENS = /\s+|[⺀-鿿가-힯豈-﫿＀-￯]|[^\s⺀-鿿가-힯豈-﫿＀-￯]+/gu;

/**
 * How a label's lines run: `along` the sector's middle (reading outwards from the hub, lines side
 * by side), or `across` it (upright when the sector is at the top, lines stacked from the rim
 * inwards, longer towards the rim where the sector is wider).
 */
export type LabelDirection = 'across' | 'along';

export interface LabelLine {
  text: string;
  /**
   * Centre of the line in the label's own frame. `along`: x is the distance from the hub, y the
   * sideways offset from the sector's middle (negative: the top line). `across`: x is the sideways
   * offset (always 0), y is minus the distance from the hub.
   */
  x: number;
  y: number;
}

export interface LabelFit {
  direction: LabelDirection;
  /** Font size in wheel units. */
  size: number;
  lines: LabelLine[];
}

interface Slot {
  /** Room for the line's text. */
  room: number;
  /** Where the line goes, given its width. */
  place(width: number): LabelLine;
}

/**
 * Fits a label inside a sector of `span` degrees, between `band.inner` and `band.outer` from the
 * hub, running in the given direction, as big as possible up to `maxSize`, on one to
 * MAX_LABEL_LINES lines (fewer lines when the size is the same). Along lines are centred on
 * `band.center` when they fit there. It shrinks before it is cut. `measure` gives a text's width
 * at a font size (not always proportional to the size: some fonts draw small text relatively wider).
 */
export function fitLabel(
  label: string,
  span: number,
  measure: (text: string, size: number) => number,
  band: { inner: number; outer: number; center: number },
  { direction, maxSize = MAX_LABEL_SIZE }: { direction: LabelDirection; maxSize?: number },
): LabelFit {
  const largest = Math.max(MIN_LABEL_SIZE, Math.min(MAX_LABEL_SIZE, maxSize));
  const tokens = label.match(TOKENS) ?? [];
  const tan = span >= 180 ? Infinity : Math.tan((span * Math.PI) / 360);
  const unbreakable = (word: string) => measure(word, MIN_LABEL_SIZE) > band.outer - band.inner;

  /** Along lines side by side, centred on the sector's middle. */
  const alongSlots = (size: number, n: number): Slot[] =>
    Array.from({ length: n }, (_, k) => {
      const y = (k - (n - 1) / 2) * size * LINE_HEIGHT;
      const top = Math.abs(y) + size / 2;
      const lo = Math.max(band.inner, top / tan);
      const hi = top < band.outer ? Math.sqrt(band.outer ** 2 - top ** 2) : -Infinity;
      return { room: hi - lo, place: (width) => ({ x: Math.max(lo + width / 2, Math.min(band.center, hi - width / 2)), y, text: '' }) };
    });

  /** Across lines stacked inwards from `first` (distance of the first line's centre from the hub). */
  const acrossSlots = (size: number, n: number, first: number): Slot[] =>
    Array.from({ length: n }, (_, k) => {
      const distance = first - k * size * LINE_HEIGHT;
      const near = distance - size / 2;
      const far = distance + size / 2;
      const half = near < band.inner || far >= band.outer ? -Infinity : Math.min(Math.sqrt(band.outer ** 2 - far ** 2), near * tan);
      return { room: 2 * half, place: () => ({ x: 0, y: -distance, text: '' }) };
    });

  /** Every way to lay out n lines at a size in a direction (across: several places along the radius). */
  const layouts = (direction: LabelDirection, size: number, n: number): Slot[][] => {
    if (direction === 'along') return [alongSlots(size, n)];
    const highest = band.outer - size / 2;
    const lowest = band.inner + size / 2 + (n - 1) * size * LINE_HEIGHT;
    if (lowest > highest) return [];
    return Array.from({ length: ACROSS_PLACES }, (_, i) => acrossSlots(size, n, highest - ((highest - lowest) * i) / (ACROSS_PLACES - 1)));
  };

  /**
   * Fills the slots greedily; null when the label does not fit (unless `cut`, which ends it with an
   * ellipsis), or the number of lines it needs when that is fewer than the slots.
   */
  function fill(direction: LabelDirection, size: number, slots: Slot[], cut: true): LabelFit;
  function fill(direction: LabelDirection, size: number, slots: Slot[], cut: false): LabelFit | number | null;
  function fill(direction: LabelDirection, size: number, slots: Slot[], cut: boolean): LabelFit | number | null {
    const fits = (text: string, room: number) => measure(text, size) <= room;
    const queue = [...tokens];
    const texts: string[] = [];
    for (const { room } of slots) {
      let text = '';
      while (queue.length > 0) {
        const token = queue[0]!;
        if (text === '' && /^\s+$/.test(token)) {
          queue.shift();
          continue;
        }
        if (fits((text + token).trimEnd(), room)) {
          text += token;
          queue.shift();
          continue;
        }
        // Words stay whole (the label shrinks instead), unless one is too long for a line even at the smallest size.
        const chars = Array.from(token);
        if (text === '' && chars.length > 1 && (cut || unbreakable(token))) queue.splice(0, 1, ...chars);
        else break;
      }
      texts.push(text.trimEnd());
    }
    const rest = queue.join('').trim();
    const done = (lines: string[]): LabelFit => ({
      direction,
      size,
      lines: lines.map((text, k) => ({ ...slots[k]!.place(measure(text, size)), text })),
    });
    const used = texts.findIndex((text) => text === '');
    if (rest === '' && used === -1) return done(texts);
    // It all went on the first lines, the others are left empty: fewer lines do.
    if (rest === '' && !cut && used > 0 && texts.slice(used).every((text) => text === '')) return used;
    if (!cut) return null;
    const kept = texts.filter((text) => text !== '');
    if (kept.length === 0) return { direction, size, lines: [] };
    const room = slots[kept.length - 1]!.room;
    const chars = Array.from(`${kept.at(-1)!}${rest === '' ? '' : ' '}${rest}`);
    let text = `${chars.join('')}…`;
    while (chars.length > 0 && !fits(text, room)) {
      chars.pop();
      text = `${chars.join('').trimEnd()}…`;
    }
    return done([...kept.slice(0, -1), text]);
  }

  /**
   * The label on at most n lines at a size, if it fits: across, the middle of the places where it
   * fits on n lines.
   */
  const tryFit = (direction: LabelDirection, size: number, n: number): LabelFit | null => {
    const results = layouts(direction, size, n)
      .filter((slots) => slots.every(({ room }) => room > 0))
      .map((slots) => fill(direction, size, slots, false));
    const fitting = results.filter((result): result is LabelFit => typeof result === 'object' && result !== null);
    if (fitting.length > 0) return fitting[Math.floor((fitting.length - 1) / 2)]!;
    const fewer = results.find((result): result is number => typeof result === 'number');
    return fewer === undefined ? null : tryFit(direction, size, fewer);
  };

  let best: LabelFit | null = null;
  for (let n = 1; n <= MAX_LABEL_LINES; n++) {
    if (best && best.size >= largest) break;
    let fit = tryFit(direction, largest, n);
    if (!fit) {
      // Largest size that fits on n lines, by bisection.
      let low = Math.max(MIN_LABEL_SIZE, best?.size ?? 0);
      let high = largest;
      fit = tryFit(direction, low, n);
      if (!fit) continue;
      for (let i = 0; i < 10; i++) {
        const mid = (low + high) / 2;
        const tried = tryFit(direction, mid, n);
        if (tried) [low, fit] = [mid, tried];
        else high = mid;
      }
    }
    if (!best || fit.size > best.size + 1e-6) best = fit;
  }
  if (best) return best;
  // Too long even at the smallest size: as many lines as fit, the last one cut.
  for (let n = MAX_LABEL_LINES; n >= 1; n--) {
    const slots = layouts(direction, MIN_LABEL_SIZE, n).find((places) => places.every(({ room }) => room > 0));
    if (slots) return fill(direction, MIN_LABEL_SIZE, slots, true);
  }
  return { direction, size: MIN_LABEL_SIZE, lines: [] };
}
