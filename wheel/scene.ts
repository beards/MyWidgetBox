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

export function createWheelScene(container: HTMLElement): WheelScene {
  const root = svg('svg', { viewBox: '-110 -116 220 228', role: 'img', 'aria-hidden': 'true' });
  const rotor = svg('g');
  const sectors = svg('g');
  const labels = svg('g', { 'font-size': MAX_LABEL_SIZE, 'dominant-baseline': 'central', 'text-anchor': 'middle' });
  rotor.append(sectors, labels, svg('circle', { r: RADIUS, fill: 'none', stroke: 'rgb(0 0 0 / 0.25)', 'stroke-width': 1 }));
  const hub = svg('circle', { r: 9, fill: '#ffffff', stroke: 'rgb(0 0 0 / 0.25)', 'stroke-width': 1 });
  // Pointer at the top, tip pointing into the wheel.
  const pointer = svg('path', { d: 'M -9 -114 L 9 -114 L 0 -94 Z', stroke: '#ffffff', 'stroke-width': 1.5 });
  root.append(rotor, hub, pointer);
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
  const applyRotation = () => rotor.setAttribute('transform', `rotate(${rotation % 360})`);

  return {
    setEntries(entries) {
      parts = sectorsFor(entries);
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
      pointer.setAttribute('fill', pointerColor);
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
