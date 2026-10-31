// DOM helper for Display mode. View-layer only; untested by design (manual check).
import type { DisplayOptions } from './share-link';

const STYLE = `
html[data-display] [data-controls] { display: none !important; }
html[data-transparent], html[data-transparent] body { background: transparent !important; }
`;

/**
 * Applies Display mode to the page: elements marked `data-controls` are hidden, and the
 * page background becomes transparent when asked. Read the options with readDisplayOptions().
 */
export function applyDisplayMode({ display, transparent }: DisplayOptions): void {
  const root = document.documentElement;
  root.toggleAttribute('data-display', display);
  root.toggleAttribute('data-transparent', transparent);
  if (!document.getElementById('display-mode-style')) {
    const style = document.createElement('style');
    style.id = 'display-mode-style';
    style.textContent = STYLE;
    document.head.append(style);
  }
}

