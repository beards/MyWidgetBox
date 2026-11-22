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

/** The theme the user picked; the default theme when none was picked or storage cannot be read. */
export function readTheme(storage: KeyValueStorage): Theme {
  let stored: string | null = null;
  try {
    stored = storage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage blocked: the default theme.
  }
  return THEMES.find((theme) => theme === stored) ?? THEMES[0];
}

/**
 * Each theme's page background and text colors (the same as --theme-bg and --theme-text in theme.css).
 * A Widget's default display colors follow them, so a fresh Widget matches the page around it; they are
 * only defaults, and Settings once saved keep their own colors whatever the theme.
 */
export const THEME_COLORS: Record<Theme, { background: string; text: string }> = {
  soft: { background: '#f4f6f8', text: '#1d2733' },
  dark: { background: '#121417', text: '#e8e9eb' },
  paper: { background: '#f6f1e7', text: '#2b241c' },
};

export function writeTheme(storage: KeyValueStorage, theme: Theme): void {
  storage.setItem(THEME_STORAGE_KEY, theme);
}
