// DOM helper for shared/theme.ts. View-layer only; untested by design (manual check).
import type { KeyValueStorage } from './env';
import type { I18n, Locale } from './i18n';
import { THEMES, type Theme, readTheme, writeTheme } from './theme';

const THEME_NAMES: Record<Locale, Record<Theme, string>> = {
  'zh-Hant': { soft: '柔和', dark: '深色', paper: '紙本' },
  en: { soft: 'Soft', dark: 'Dark', paper: 'Paper' },
};

const SWITCHER_LABEL: Record<Locale, string> = { 'zh-Hant': '主題', en: 'Theme' };

/** Appends a theme <select> to container; picking a theme applies it at once and remembers it. */
export function mountThemeSwitcher<K extends string>(
  i18n: I18n<K>,
  storage: KeyValueStorage,
  container: HTMLElement,
): HTMLSelectElement {
  const select = document.createElement('select');
  const sync = (locale: Locale) => {
    const selected = select.value || readTheme(storage);
    select.replaceChildren(...THEMES.map((theme) => new Option(THEME_NAMES[locale][theme], theme)));
    select.value = selected;
    select.setAttribute('aria-label', SWITCHER_LABEL[locale]);
  };
  sync(i18n.getLocale());
  i18n.subscribe(sync);
  select.addEventListener('change', () => {
    const theme = select.value as Theme;
    writeTheme(storage, theme);
    document.documentElement.dataset.theme = theme;
  });
  container.append(select);
  return select;
}
