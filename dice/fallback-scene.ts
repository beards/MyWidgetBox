// Flat fallback for browsers without WebGL (disabled GPU, old devices): each die is a colored tile
// showing its face value, revealed after the same animation duration. Same interface as scene.ts.
import type { DieRoll } from './controller';
import type { DiceColors, DiceScene } from './scene';

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
    play(rolls, { duration, reduced }, onDone) {
      window.clearTimeout(timer);
      draw(rolls, true);
      timer = window.setTimeout(
        () => {
          timer = 0;
          draw(rolls, false);
          onDone();
        },
        reduced ? 300 : duration,
      );
    },
    setColors({ body, label }: DiceColors) {
      tray.style.setProperty('--die-body', body);
      tray.style.setProperty('--die-label', label);
    },
  };
}
