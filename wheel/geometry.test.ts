import { describe, expect, it } from 'vitest';
import { fitLabel, type LabelFit, landingRotation, MAX_LABEL_SIZE, MIN_LABEL_SIZE, sectorUnderPointer } from './geometry';

/** The wheel angle under the top pointer once the wheel is rotated clockwise by `rotation` degrees. */
const underPointer = (rotation: number) => (((-rotation % 360) + 360) % 360);

describe('landingRotation', () => {
  it.each([
    [0, 270, 3],
    [123.4, 9, 5],
    [-50, 0.5, 1],
    [720, 359.9, 4],
  ])('from %s° turns forward at least the given turns and stops with angle %s° under the pointer', (from, angle, turns) => {
    const to = landingRotation(from, angle, turns);
    expect(to).toBeGreaterThanOrEqual(from + turns * 360);
    expect(to).toBeLessThan(from + (turns + 1) * 360);
    expect(underPointer(to)).toBeCloseTo(angle, 6);
  });
});

describe('sectorUnderPointer', () => {
  const sectors = [
    { start: 0, end: 90 },
    { start: 90, end: 300 },
    { start: 300, end: 360 },
  ];

  it.each([
    [0, 0],
    [-45, 0],
    [-100, 1],
    [30, 2],
    [-90, 1],
    [720 + 10, 2],
  ])('at rotation %s° finds sector %s under the pointer', (rotation, index) => {
    expect(sectorUnderPointer(sectors, rotation)).toBe(index);
  });

  it('is -1 for an empty wheel', () => {
    expect(sectorUnderPointer([], 42)).toBe(-1);
  });
});

describe('fitLabel', () => {
  // A stand-in font: every character is 0.6 of the font size wide.
  const measure = (text: string, size: number) => Array.from(text).length * 0.6 * size;
  const band = { inner: 14, outer: 94, center: 58 };
  const DIRECTIONS = ['across', 'along'] as const;
  const CJK = '一個很長很長超級長的字串會怎麼樣呢好好奇喔讓我看看';

  /** Every corner of every line's box is inside the sector, between the hub band and the rim. */
  function expectInside(fit: LabelFit, span: number, measureWith = measure) {
    const half = (span / 2) * (Math.PI / 180);
    for (const line of fit.lines) {
      const width = measureWith(line.text, fit.size);
      // The box in the sector's frame: u from the hub along the middle, v sideways.
      const [uLow, uHigh, vHigh] =
        fit.direction === 'along'
          ? [line.x - width / 2, line.x + width / 2, Math.abs(line.y) + fit.size / 2]
          : [-line.y - fit.size / 2, -line.y + fit.size / 2, width / 2];
      expect(uLow).toBeGreaterThanOrEqual(band.inner - 1e-9);
      expect(Math.hypot(uHigh, vHigh)).toBeLessThanOrEqual(band.outer + 1e-9);
      if (span < 180) expect(Math.atan2(vHigh, uLow)).toBeLessThanOrEqual(half + 1e-9);
    }
  }
  const joined = (fit: LabelFit) => fit.lines.map((line) => line.text).join('');
  const words = (fit: LabelFit) => fit.lines.map((line) => line.text).join(' ');

  it('always runs the lines in the direction asked for', () => {
    for (const direction of DIRECTIONS) {
      for (const span of [5, 60, 300]) {
        for (const label of ['A', CJK, 'x'.repeat(100)]) expect(fitLabel(label, span, measure, band, { direction }).direction).toBe(direction);
      }
    }
  });

  it('draws a short label along the sector centred where it was, as big as the limit allows', () => {
    expect(fitLabel('A', 60, measure, band, { direction: 'along', maxSize: 40 })).toEqual({
      direction: 'along',
      size: 40,
      lines: [{ text: 'A', x: 58, y: 0 }],
    });
  });

  describe.each(DIRECTIONS)('%s', (direction) => {
    it.each([10, 30, 60, 120, 360])('fits a long label inside a %s° sector without cutting it', (span) => {
      const label = 'A very long entry that would not fit';
      const fit = fitLabel(label, span, measure, band, { direction });
      expect(words(fit)).toBe(label);
      expectInside(fit, span);
    });

    it('fills a wide sector with a long label on several big lines', () => {
      const fit = fitLabel(CJK, 270, measure, band, { direction });
      expect(fit.size).toBeGreaterThan(11);
      expect(fit.lines.length).toBeGreaterThan(1);
      expect(joined(fit)).toBe(CJK);
      expectInside(fit, 270);
    });

    it('stacks the lines in reading order, top line first', () => {
      for (const span of [40, 120]) {
        const fit = fitLabel('one two three four five six seven eight nine ten', span, measure, band, { direction });
        expect(fit.lines.length).toBeGreaterThan(1);
        const ys = fit.lines.map((line) => line.y);
        expect(ys).toEqual([...ys].sort((a, b) => a - b));
      }
    });

    it('keeps words whole rather than growing by breaking them, and CJK breaks anywhere', () => {
      for (const span of [20, 60, 120]) {
        for (const label of ['Short', '#12', 'An extremely long English entry label that goes on and on']) {
          expect(words(fitLabel(label, span, measure, band, { direction }))).toBe(label);
        }
      }
      const fit = fitLabel('alpha beta gamma delta epsilon zeta eta theta', 90, measure, band, { direction });
      for (const line of fit.lines) expect(line.text).toMatch(/^[a-z]+( [a-z]+)*$/);
    });

    it('breaks a word too long for a line even at the smallest size', () => {
      const fit = fitLabel('x'.repeat(60), 180, measure, band, { direction });
      expect(fit.lines.length).toBeGreaterThan(1);
      expect(joined(fit)).toBe('x'.repeat(60));
    });

    it('grows no bigger than the size limit, and with no limit only as far as the sector allows', () => {
      expect(fitLabel('A', 60, measure, band, { direction, maxSize: 12 }).size).toBe(12);
      const free = fitLabel('A', 360, measure, band, { direction });
      expect(free.size).toBeGreaterThan(40);
      expect(free.size).toBeLessThanOrEqual(MAX_LABEL_SIZE);
      expectInside(free, 360);
    });

    it('cuts with an ellipsis only what still does not fit at the smallest size', () => {
      const label = 'x'.repeat(100);
      for (const span of [6]) {
        const fit = fitLabel(label, span, measure, band, { direction });
        expect(fit.size).toBe(MIN_LABEL_SIZE);
        expect(fit.lines.at(-1)!.text.endsWith('…')).toBe(true);
        expect(joined(fit).length).toBeLessThan(label.length);
        expectInside(fit, span);
      }
    });

    it('fits by the width at the size it picks, for fonts that draw small text relatively wider', () => {
      // 0.6 of the size wide at 11, growing to 0.72 at size 3.
      const optical = (text: string, size: number) => Array.from(text).length * size * (0.6 + 0.015 * (11 - Math.min(11, size)));
      const label = 'A long label that must shrink a lot';
      const fit = fitLabel(label, 20, optical, band, { direction });
      expect(words(fit)).toBe(label);
      expectInside(fit, 20, optical);
    });
  });

  it('centres along lines on the middle of the sector', () => {
    const fit = fitLabel('one two three four five six seven eight nine ten', 120, measure, band, { direction: 'along' });
    expect(fit.lines[0]!.y + fit.lines.at(-1)!.y).toBeCloseTo(0, 9);
  });

  it('makes across lines longer towards the rim, where the sector is wider', () => {
    const fit = fitLabel(CJK, 100, measure, band, { direction: 'across' });
    const widths = fit.lines.map((line) => measure(line.text, fit.size));
    expect(widths[0]).toBeGreaterThan(widths.at(-1)!);
  });
});
