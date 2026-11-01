import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestEnv } from './test-env';
import { THEME_STORAGE_KEY, THEMES, readTheme, writeTheme } from './theme';

describe('theme', () => {
  it('defaults to soft when nothing is stored', () => {
    expect(readTheme(createTestEnv().storage)).toBe('soft');
  });

  it('reads a stored theme', () => {
    const { storage } = createTestEnv();
    storage.setItem(THEME_STORAGE_KEY, 'paper');
    expect(readTheme(storage)).toBe('paper');
  });

  it('falls back to soft for an unknown stored value', () => {
    const { storage } = createTestEnv();
    storage.setItem(THEME_STORAGE_KEY, 'neon');
    expect(readTheme(storage)).toBe('soft');
  });

  it('remembers the picked theme', () => {
    const { storage } = createTestEnv();
    writeTheme(storage, 'dark');
    expect(storage.getItem('mywidgetbox:theme')).toBe('dark');
  });

  // The boot script runs before any module, so it repeats the list and the key; keep them in step.
  it.each(['index.html', 'dice/index.html', 'wheel/index.html', 'timer/index.html'])(
    '%s sets the theme before first paint with the same list and key',
    (page) => {
      const html = readFileSync(resolve(import.meta.dirname, '..', page), 'utf8');
      const boot = /<script data-theme-boot>([\s\S]*?)<\/script>/.exec(html)?.[1];
      expect(boot).toBeDefined();
      expect(boot).toContain(`'${THEME_STORAGE_KEY}'`);
      for (const theme of THEMES) expect(boot).toContain(`'${theme}'`);
    },
  );
});
