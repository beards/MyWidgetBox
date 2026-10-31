// Flat fallback for browsers without WebGL (disabled GPU, old devices): each die is a colored tile
// showing its face value, revealed after a short wait (at once when skipped). Same interface as scene.ts.
import { REDUCED_MOTION_DURATION } from '../shared/animation';
import type { DieRoll } from './controller';
import type { DiceColors, DiceScene } from './scene';

/** How long the tiles stay hidden in a full animation (what the former 3 s default gave). */
const FULL_REVEAL = 3000;

export function createFallbackDiceScene(container: HTMLElement): DiceScene {
  const tray = document.createElement('span');
  tray.className = 'dice__fallback';
  container.append(tray);
  let timer = 0;

  function draw(rolls: DieRoll[], hidden: boolean) {
    tray.replaceChildren(
      ...rolls.map(({ value }) => {
        const tile = document.createElement('span');
        tile.className = 'dice__fallback-die';
        tile.textContent = hidden ? '?' : String(value);
        return tile;
      }),
    );
  }

  return {
    show(rolls) {
      if (timer === 0) draw(rolls, false);
    },
    play(rolls, { animation }, onDone, onImpact) {
      window.clearTimeout(timer);
      timer = 0;
      if (animation === 'skip') {
        draw(rolls, false);
        onDone();
        return;
      }
      draw(rolls, true);
      timer = window.setTimeout(
        () => {
          timer = 0;
          draw(rolls, false);
          onImpact?.(0.8);
          onDone();
        },
        animation === 'reduced' ? REDUCED_MOTION_DURATION : FULL_REVEAL,
      );
    },
    setColors({ body, label }: DiceColors) {
      tray.style.setProperty('--die-body', body);
      tray.style.setProperty('--die-label', label);
    },
    setTable() {
      // No table without WebGL: the tiles sit on the page background.
    },
  };
}
