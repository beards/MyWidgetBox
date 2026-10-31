import type { Env } from './env';

/**
 * Opt-in UI text module. Each page passes its own message tables, keyed by locale.
 * Adding a language = adding its tag to LOCALES and one table per page.
 */
export const LOCALES = ['zh-Hant', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Used when a key is missing from the current locale's table, and as the last detection fallback. */
export const FALLBACK_LOCALE = 'en' satisfies Locale;

/** URL parameter that forces the language (and can be carried by a Share link). */
export const LANG_PARAM = 'lang';

/** Site-wide storage key for the language the user picked by hand. */
export const LANG_STORAGE_KEY = 'mywidgetbox:lang';

/** The fallback table must be complete; other tables may lag behind. */
export type MessageTables<K extends string> = Record<typeof FALLBACK_LOCALE, Record<K, string>> &
  Partial<Record<Exclude<Locale, typeof FALLBACK_LOCALE>, Partial<Record<K, string>>>>;

export interface I18n<K extends string> {
  getLocale(): Locale;
  /** Switches language and remembers the choice. */
  setLocale(locale: Locale): void;
  /** Message for key in the current locale; `{name}` placeholders are filled from params. */
  t(key: K, params?: Record<string, string | number>): string;
  /** Calls listener after every locale change; returns an unsubscribe function. */
  subscribe(listener: (locale: Locale) => void): () => void;
}

export interface I18nOptions {
  /** The browser's preferred language (navigator.language). */
  browserLanguage: string;
}

/** Resolves the locale: `?lang=` > stored manual choice > browser language > fallback. */
export function createI18n<K extends string>(
  env: Env,
  tables: MessageTables<K>,
  options: I18nOptions,
): I18n<K> {
  let locale =
    matchLocale(env.url.searchParams.get(LANG_PARAM)) ??
    matchLocale(env.storage.getItem(LANG_STORAGE_KEY)) ??
    matchLocale(options.browserLanguage) ??
    FALLBACK_LOCALE;
  const listeners = new Set<(locale: Locale) => void>();

  return {
    getLocale: () => locale,
    setLocale(next) {
      env.storage.setItem(LANG_STORAGE_KEY, next);
      if (next === locale) return;
      locale = next;
      listeners.forEach((listener) => listener(locale));
    },
    t(key, params) {
      const message = tables[locale]?.[key] ?? tables[FALLBACK_LOCALE][key] ?? key;
      return params
        ? message.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match))
        : message;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Maps a language tag to a supported locale: exact match first, then by primary subtag (zh-CN -> zh-Hant). */
function matchLocale(tag: string | null): Locale | undefined {
  if (!tag) return undefined;
  const lower = tag.toLowerCase();
  const primary = lower.split('-')[0]!;
  return (
    LOCALES.find((locale) => locale.toLowerCase() === lower) ??
    LOCALES.find((locale) => locale.toLowerCase().split('-')[0] === primary)
  );
}
