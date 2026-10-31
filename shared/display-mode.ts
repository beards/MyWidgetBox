// DOM helper for Display mode. View-layer only; untested by design (manual check).
import type { DisplayOptions } from './share-link';

const STYLE = `
html[data-display] [data-controls] { display: none !important; }
`;

/**
 * Applies Display mode to the page: elements marked `data-controls` are hidden. Read the
 * options with readDisplayOptions(). The `transparent` option is not handled here: pass it to
 * applyAppearance() (shared/appearance-dom.ts), which owns the page background, so the
 * Share link flag and the appearance "transparent" background share one code path.
 */
export function applyDisplayMode({ display }: Pick<DisplayOptions, 'display'>): void {
  const root = document.documentElement;
  root.toggleAttribute('data-display', display);
  if (!document.getElementById('display-mode-style')) {
    const style = document.createElement('style');
    style.id = 'display-mode-style';
    style.textContent = STYLE;
    document.head.append(style);
  }
}

