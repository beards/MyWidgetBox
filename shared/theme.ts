import type { KeyValueStorage } from './env';

/**
 * Site-wide look of the controls and the catalog page; never touches a Widget's own display.
 * Each page's <head> repeats THEMES and THEME_STORAGE_KEY in a tiny boot script
 * (`<script data-theme-boot>`) that sets <html data-theme> before first paint.
 * The first theme is the default.
 */
export const THEMES = ['soft', 'dark', 'paper'] as const;
export type Theme = (typeof THEMES)[number];

/** Site-wide storage key for the theme the user picked; like the language, not part of Settings. */
export const THEME_STORAGE_KEY = 'mywidgetbox:theme';

export function readTheme(storage: KeyValueStorage): Theme {
  const stored = storage.getItem(THEME_STORAGE_KEY);
  return THEMES.find((theme) => theme === stored) ?? THEMES[0];
}

export function writeTheme(storage: KeyValueStorage, theme: Theme): void {
  storage.setItem(THEME_STORAGE_KEY, theme);
}
