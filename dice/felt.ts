// The felt background of the dice: a grey tileable cloth pattern, tinted by the table color with
// background-blend-mode, painted over the whole page so the dice area has no visible edge.

let pattern = '';

/** Paints the page as felt in this color; the caller has already applied the rest of the appearance. */
export function paintFelt(page: HTMLElement, color: string): void {
  const { style } = page;
  style.backgroundColor = color;
  style.backgroundImage = `url("${feltPattern()}")`;
  style.backgroundBlendMode = 'multiply';
  style.backgroundSize = '256px';
  style.backgroundRepeat = 'repeat';
}

/** Undoes paintFelt's extra properties (applyAppearance sets the others). */
export function clearFelt(page: HTMLElement): void {
  page.style.backgroundBlendMode = '';
  page.style.backgroundRepeat = '';
}

/** The pattern as a data URL, made once: fine noise plus short fibres. */
function feltPattern(): string {
  if (pattern) return pattern;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  const { data } = image;
  // A small fixed-seed noise so the pattern is the same on every load.
  let seed = 12345;
  const noise = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let index = 0; index < data.length; index += 4) {
    data[index] = data[index + 1] = data[index + 2] = (0.86 + noise() * 0.14) * 255;
    data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  // Short fibres for a cloth look; ones crossing an edge are drawn on the far side too, so the tile repeats seamlessly.
  context.globalAlpha = 0.08;
  for (let i = 0; i < 4000; i++) {
    context.strokeStyle = noise() < 0.5 ? '#000' : '#fff';
    const x = noise() * size;
    const y = noise() * size;
    const angle = noise() * Math.PI;
    for (const dx of [-size, 0, size]) {
      for (const dy of [0, -size]) {
        context.beginPath();
        context.moveTo(x + dx, y + dy);
        context.lineTo(x + dx + Math.cos(angle) * 6, y + dy + Math.sin(angle) * 6);
        context.stroke();
      }
    }
  }
  pattern = canvas.toDataURL();
  return pattern;
}
