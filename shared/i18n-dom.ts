// DOM helpers for shared/i18n.ts. View-layer only; untested by design (manual check).
import { LOCALES, type I18n, type Locale } from './i18n';

/** Each language's name in that language, as shown in the switcher. */
const LOCALE_NAMES: Record<Locale, string> = { 'zh-Hant': '正體中文', en: 'English' };

const SWITCHER_LABEL: Record<Locale, string> = { 'zh-Hant': '語言', en: 'Language' };

/**
 * Fills static text from the message tables and keeps it in sync with the locale:
 * `data-i18n="key"` sets textContent (works on <title> too),
 * `data-i18n-aria-label="key"` sets aria-label. Also sets <html lang>.
 */
export function bindStaticText<K extends string>(i18n: I18n<K>, root: ParentNode = document): void {
  const apply = () => {
    document.documentElement.lang = i18n.getLocale();
    root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
      element.textContent = i18n.t(element.dataset.i18n as K);
    });
    root.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((element) => {
      element.setAttribute('aria-label', i18n.t(element.dataset.i18nAriaLabel as K));
    });
  };
  apply();
  i18n.subscribe(apply);
}

/** Appends a language <select> to container; picking a language remembers it. */
export function mountLanguageSwitcher<K extends string>(i18n: I18n<K>, container: HTMLElement): HTMLSelectElement {
  const select = document.createElement('select');
  for (const locale of LOCALES) {
    select.append(new Option(LOCALE_NAMES[locale], locale));
  }
  const sync = (locale: Locale) => {
    select.value = locale;
    select.setAttribute('aria-label', SWITCHER_LABEL[locale]);
  };
  sync(i18n.getLocale());
  i18n.subscribe(sync);
  select.addEventListener('change', () => i18n.setLocale(select.value as Locale));
  container.append(select);
  return select;
}
