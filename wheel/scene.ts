// SVG view of the wheel: crisp at any zoom (OBS scaling) and cheap to redraw. No controller import.
import { type WheelEntry, sectorsFor } from './controller';
import { easeOut, landingRotation } from './geometry';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 100;
/** Longer labels are cut with an ellipsis so they stay inside their sector. */
const MAX_LABEL_CHARS = 18;

export interface WheelColors {
  label: string;
  pointer: string;
}

export interface WheelScene {
  /** Redraws the sectors (keeps the current rotation). */
  setEntries(entries: WheelEntry[]): void;
  setColors(colors: WheelColors): void;
  /**
   * Spins forward so that wheel angle `angle` (see WheelOutcome.angle) stops under the
   * pointer, then calls onDone. `reduced` skips the spin and just shows the landing.
   */
  play(angle: number, options: { duration: number; reduced: boolean }, onDone: () => void): void;
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

function shorten(label: string): string {
  const chars = Array.from(label);
  return chars.length > MAX_LABEL_CHARS ? `${chars.slice(0, MAX_LABEL_CHARS - 1).join('')}…` : label;
}

export function createWheelScene(container: HTMLElement): WheelScene {
  const root = svg('svg', { viewBox: '-110 -116 220 228', role: 'img', 'aria-hidden': 'true' });
  const rotor = svg('g');
  const sectors = svg('g');
  const labels = svg('g', { 'font-size': 11, 'dominant-baseline': 'central', 'text-anchor': 'middle' });
  rotor.append(sectors, labels, svg('circle', { r: RADIUS, fill: 'none', stroke: 'rgb(0 0 0 / 0.25)', 'stroke-width': 1 }));
  const hub = svg('circle', { r: 9, fill: '#ffffff', stroke: 'rgb(0 0 0 / 0.25)', 'stroke-width': 1 });
  // Pointer at the top, tip pointing into the wheel.
  const pointer = svg('path', { d: 'M -9 -114 L 9 -114 L 0 -94 Z', stroke: '#ffffff', 'stroke-width': 1.5 });
  root.append(rotor, hub, pointer);
  container.append(root);

  let rotation = 0;
  let frame = 0;
  const applyRotation = () => rotor.setAttribute('transform', `rotate(${rotation % 360})`);

  return {
    setEntries(entries) {
      const parts = sectorsFor(entries);
      sectors.replaceChildren(
        ...parts.map(({ entry, start, end }) =>
          entries.length === 1
            ? svg('circle', { r: RADIUS, fill: entry.color })
            : svg('path', { d: sectorPath(start, end), fill: entry.color, stroke: 'rgb(255 255 255 / 0.6)', 'stroke-width': 0.5 }),
        ),
      );
      labels.replaceChildren(
        ...parts.map(({ entry, start, end }) => {
          const span = end - start;
          const mid = entries.length === 1 ? 0 : start + span / 2;
          // Radial text reading outwards from the hub; smaller in thin sectors.
          const size = Math.max(4, Math.min(11, span * 0.35));
          const text = svg('text', {
            transform: `rotate(${mid - 90}) translate(${RADIUS * 0.58} 0)`,
            'font-size': size,
          });
          text.textContent = shorten(entry.label);
          return text;
        }),
      );
    },
    setColors({ label, pointer: pointerColor }) {
      labels.setAttribute('fill', label);
      pointer.setAttribute('fill', pointerColor);
    },
    play(angle, { duration, reduced }, onDone) {
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
      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        rotation = from + (to - from) * easeOut(t);
        applyRotation();
        if (t < 1) frame = requestAnimationFrame(step);
        else onDone();
      };
      frame = requestAnimationFrame(step);
    },
  };
}
