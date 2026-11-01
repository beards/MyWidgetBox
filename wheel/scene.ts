// SVG view of the wheel: crisp at any zoom (OBS scaling) and cheap to redraw. No controller import.
import { type WheelEntry, sectorsFor } from './controller';
import { fitLabel, type LabelDirection, landingRotation, MAX_LABEL_SIZE, sectorUnderPointer, spinProgress } from './geometry';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 100;
/** Labels sit between the hub and the rim, centred a bit past half way when they are short. */
const LABEL_BAND = { inner: 14, outer: RADIUS - 6, center: RADIUS * 0.58 };

export interface LabelLayout {
  direction: LabelDirection;
  sizeLimit: number | null;
}

export interface WheelColors {
  label: string;
  pointer: string;
}

export interface WheelScene {
  /** Redraws the sectors (keeps the current rotation); no entries draws an empty grey disc. */
  setEntries(entries: WheelEntry[]): void;
  /**
   * How labels are laid out: the direction their lines run, and the largest size (wheel units),
   * or null for labels as big as their sectors allow.
   */
  setLabelLayout(layout: LabelLayout): void;
  setColors(colors: WheelColors): void;
  /** The drawn wheel's diameter in the container's CSS px (unaffected by zoom on an ancestor). */
  diameter(): number;
  /**
   * Spins forward so that wheel angle `angle` (see WheelOutcome.angle) stops under the
   * pointer, then calls onDone. `reduced` skips the spin and just shows the landing.
   * `onTick` is called each time a sector boundary passes the pointer (at most once per frame).
   */
  play(
    angle: number,
    options: { duration: number; reduced: boolean; onTick?: () => void },
    onDone: () => void,
  ): void;
}

const svg = <K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string | number> = {}) => {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
};

/** Point at `degrees` clockwise from the top, at distance r from the center. */
const point = (degrees: number, r: number) => {
  const radians = (degrees * Math.PI) / 180;
  return [r * Math.sin(radians), -r * Math.cos(radians)] as const;
};

function sectorPath(start: number, end: number): string {
  const [x1, y1] = point(start, RADIUS);
  const [x2, y2] = point(end, RADIUS);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M 0 0 L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

/**
 * Width of a text at a font size, measured on a hidden SVG text inside `group` so it uses the
 * labels' real font and weight. Falls back to an estimate while the wheel is not rendered.
 */
function textMeasurer(group: SVGGElement): (text: string, size: number) => number {
  const probe = svg('text', { visibility: 'hidden' });
  group.append(probe);
  // The fit tries many sizes and line breaks; the same text at the same size is measured once.
  const widths = new Map<string, number>();
  return (text, size) => {
    const key = `${size}\u0000${text}`;
    let width = widths.get(key);
    if (width === undefined) {
      probe.textContent = text;
      probe.setAttribute('font-size', String(size));
      width = probe.getComputedTextLength();
      if (width === 0 && text !== '') width = Array.from(text).length * 0.6 * size;
      widths.set(key, width);
    }
    return width;
  };
}

const POINTER_SHADOW = 'wheel-pointer-shadow';
const POINTER_SHADE = 'wheel-pointer-shade';
/** A pin at the top: a round head (center y -105, radius 8) tapering to a tip into the wheel. */
const POINTER_PATH = 'M 0 -90 L -6.77 -100.73 A 8 8 0 1 1 6.77 -100.73 Z';

const WHEEL_SHADOW = 'wheel-shadow';
const WHEEL_LIGHT = 'wheel-light';
const RIM = 'wheel-rim';
const HUB = 'wheel-hub';
/** The rim: a band of this width just outside the sectors. */
const RIM_WIDTH = 6;
const RIM_RADIUS = RADIUS + RIM_WIDTH / 2;

/** One gradient stop; `color` is `#rrggbb`, with an optional opacity. */
const stop = (offset: number, color: string, opacity = 1) =>
  svg('stop', { offset, 'stop-color': color, 'stop-opacity': opacity });

/**
 * Shadows, lighting and finishes. The lighting is fixed (it does not turn with the wheel) and lies
 * over the sectors as translucent layers, so it works with any entry color.
 */
function sceneDefs(): SVGDefsElement {
  const defs = svg('defs');
  const shadow = (id: string, dy: number, blur: number, opacity: number) => {
    const filter = svg('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' });
    filter.append(svg('feDropShadow', { dx: 0, dy, stdDeviation: blur, 'flood-opacity': opacity }));
    return filter;
  };
  // Side-lit pointer: light on the left, dark on the right.
  const pointerShade = svg('linearGradient', { id: POINTER_SHADE, x1: 0, x2: 1, y1: 0, y2: 0 });
  pointerShade.append(stop(0, '#ffffff', 0.2), stop(0.5, '#ffffff', 0), stop(1, '#000000', 0.2));
  // The face of the wheel: a soft light from the top left, darker towards the rim.
  const light = svg('radialGradient', { id: WHEEL_LIGHT, cx: 0.4, cy: 0.35, r: 0.7 });
  light.append(stop(0, '#ffffff', 0.12), stop(0.55, '#ffffff', 0), stop(1, '#000000', 0.18));
  const rim = svg('linearGradient', { id: RIM, x1: 0, x2: 0, y1: 0, y2: 1 });
  rim.append(stop(0, '#606060'), stop(0.5, '#343434'), stop(1, '#1a1a1a'));
  const hub = svg('radialGradient', { id: HUB, cx: 0.35, cy: 0.3, r: 0.75 });
  hub.append(stop(0, '#ffffff'), stop(1, '#c8c8c8'));
  defs.append(
    shadow(POINTER_SHADOW, 1.5, 1.2, 0.45),
    shadow(WHEEL_SHADOW, 2, 2.5, 0.35),
    pointerShade,
    light,
    rim,
    hub,
  );
  return defs;
}

/** The pointer: `body` takes the pointer color; the shading and the rivet on top work over any color. */
function createPointer() {
  const group = svg('g', { filter: `url(#${POINTER_SHADOW})` });
  const body = svg('path', { d: POINTER_PATH });
  const shading = svg('path', { d: POINTER_PATH, fill: `url(#${POINTER_SHADE})` });
  const rivet = svg('circle', { cx: 0, cy: -105, r: 2.5, fill: '#ffffff', 'fill-opacity': 0.85 });
  group.append(body, shading, rivet);
  return { group, body };
}

export function createWheelScene(container: HTMLElement): WheelScene {
  const VIEW = { width: 220, height: 228 };
  const root = svg('svg', { viewBox: `-110 -116 ${VIEW.width} ${VIEW.height}`, role: 'img', 'aria-hidden': 'true' });
  const rotor = svg('g');
  const sectors = svg('g');
  const labels = svg('g', { 'font-size': MAX_LABEL_SIZE, 'dominant-baseline': 'central', 'text-anchor': 'middle' });
  rotor.append(sectors, labels);
  // The rim's studs sit on the rim, at the sector boundaries, and turn with the sectors.
  const studs = svg('g');
  const body = svg('g');
  body.append(
    // The shadow is cast by a still disc behind the wheel, so it is not redrawn on every frame of a spin.
    svg('circle', { r: RADIUS + RIM_WIDTH, fill: '#141414', filter: `url(#${WHEEL_SHADOW})` }),
    rotor,
    svg('circle', { r: RADIUS, fill: `url(#${WHEEL_LIGHT})` }),
    svg('circle', { r: RIM_RADIUS, fill: 'none', stroke: `url(#${RIM})`, 'stroke-width': RIM_WIDTH }),
    // A fine outer edge, so the rim stands out on a background of a similar shade.
    svg('circle', { r: RADIUS + RIM_WIDTH, fill: 'none', stroke: 'rgb(0 0 0 / 0.3)', 'stroke-width': 0.5 }),
    studs,
  );
  const hub = svg('g', { filter: `url(#${POINTER_SHADOW})` });
  hub.append(
    svg('circle', { r: 10, fill: `url(#${HUB})`, stroke: 'rgb(0 0 0 / 0.2)', 'stroke-width': 0.5 }),
    svg('circle', { r: 3, fill: 'rgb(0 0 0 / 0.12)' }),
  );
  const pointer = createPointer();
  root.append(sceneDefs(), body, hub, pointer.group);
  container.append(root);

  let rotation = 0;
  let frame = 0;
  let parts: ReturnType<typeof sectorsFor> = [];
  let layout: LabelLayout = { direction: 'across', sizeLimit: null };

  function drawLabels() {
    labels.replaceChildren();
    const measure = textMeasurer(labels);
    labels.replaceChildren(
      ...parts.map(({ entry, start, end }) => {
        const span = end - start;
        const mid = parts.length === 1 ? 0 : start + span / 2;
        // Wrapped, shrunk (then cut) to stay inside its sector, reading outwards or upright at the rim.
        const fit = fitLabel(entry.label, span, measure, LABEL_BAND, {
          direction: layout.direction,
          maxSize: layout.sizeLimit ?? undefined,
        });
        const turn = fit.direction === 'along' ? mid - 90 : mid;
        const group = svg('g', { transform: `rotate(${turn})`, 'font-size': fit.size });
        group.append(
          ...fit.lines.map((line) => {
            const text = svg('text', { x: line.x, y: line.y });
            text.textContent = line.text;
            return text;
          }),
        );
        return group;
      }),
    );
  }
  const applyRotation = () => {
    const transform = `rotate(${rotation % 360})`;
    rotor.setAttribute('transform', transform);
    studs.setAttribute('transform', transform);
  };

  return {
    // The SVG keeps its aspect ratio, so the wheel is scaled by the tighter of the two fits.
    diameter: () => 2 * RADIUS * Math.min(container.clientWidth / VIEW.width, container.clientHeight / VIEW.height),
    setEntries(entries) {
      parts = sectorsFor(entries);
      studs.replaceChildren(
        ...(parts.length < 2 ? [] : parts).map(({ start }) => {
          const [cx, cy] = point(start, RIM_RADIUS);
          return svg('circle', { cx, cy, r: 1.6, fill: `url(#${HUB})`, stroke: 'rgb(0 0 0 / 0.35)', 'stroke-width': 0.4 });
        }),
      );
      if (parts.length === 0) {
        sectors.replaceChildren(svg('circle', { r: RADIUS, fill: '#d0d0d0' }));
        labels.replaceChildren();
        return;
      }
      sectors.replaceChildren(
        ...parts.map(({ entry, start, end }) =>
          entries.length === 1
            ? svg('circle', { r: RADIUS, fill: entry.color })
            : svg('path', { d: sectorPath(start, end), fill: entry.color, stroke: 'rgb(255 255 255 / 0.6)', 'stroke-width': 0.5 }),
        ),
      );
      drawLabels();
    },
    setLabelLayout(next) {
      if (next.direction === layout.direction && next.sizeLimit === layout.sizeLimit) return;
      layout = next;
      drawLabels();
    },
    setColors({ label, pointer: pointerColor }) {
      labels.setAttribute('fill', label);
      pointer.body.setAttribute('fill', pointerColor);
    },
    play(angle, { duration, reduced, onTick }, onDone) {
      cancelAnimationFrame(frame);
      const from = rotation % 360;
      const to = landingRotation(from, angle, reduced ? 0 : Math.max(2, Math.round(duration / 700)));
      if (reduced) {
        rotation = to;
        applyRotation();
        setTimeout(onDone, duration);
        return;
      }
      const startTime = performance.now();
      let sector = sectorUnderPointer(parts, rotation);
      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        rotation = from + (to - from) * spinProgress(t);
        applyRotation();
        const next = sectorUnderPointer(parts, rotation);
        if (next !== sector && parts.length > 1) onTick?.();
        sector = next;
        if (t < 1) frame = requestAnimationFrame(step);
        else onDone();
      };
      frame = requestAnimationFrame(step);
    },
  };
}
