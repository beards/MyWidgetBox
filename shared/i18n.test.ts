import { describe, expect, it } from 'vitest';
import { createI18n, type MessageTables } from './i18n';
import { createTestEnv } from './test-env';

type Key = 'greeting' | 'onlyEnglish' | 'rolled';

const messages: MessageTables<Key> = {
  en: { greeting: 'Hello', onlyEnglish: 'English only', rolled: 'Rolled {total} with {count} dice' },
  'zh-Hant': { greeting: '你好', rolled: '{count} 顆骰子擲出 {total}' },
};

/** Builds an i18n with the given URL, stored manual choice and browser language. */
function setup({ url, stored, browser = 'en-US' }: { url?: string; stored?: string; browser?: string }) {
  const env = createTestEnv({ url });
  if (stored !== undefined) env.storage.setItem('mywidgetbox:lang', stored);
  return { env, i18n: createI18n(env, messages, { browserLanguage: browser }) };
}

describe('i18n language resolution', () => {
  it.each([
    ['zh-TW', 'zh-Hant'],
    ['zh-CN', 'zh-Hant'],
    ['zh', 'zh-Hant'],
    ['zh-Hant-HK', 'zh-Hant'],
    ['en-GB', 'en'],
    ['fr-FR', 'en'],
    ['', 'en'],
  ])('uses the browser language %j -> %s when nothing else is set', (browser, expected) => {
    expect(setup({ browser }).i18n.getLocale()).toBe(expected);
  });

  it('prefers the stored manual choice over the browser language', () => {
    expect(setup({ stored: 'zh-Hant', browser: 'en-US' }).i18n.getLocale()).toBe('zh-Hant');
    expect(setup({ stored: 'en', browser: 'zh-TW' }).i18n.getLocale()).toBe('en');
  });

  it('prefers ?lang= over the stored choice and the browser language', () => {
    const { i18n } = setup({ url: 'https://example.test/dice/?lang=en', stored: 'zh-Hant', browser: 'zh-TW' });
    expect(i18n.getLocale()).toBe('en');
    expect(setup({ url: 'https://example.test/?lang=zh-Hant', stored: 'en' }).i18n.getLocale()).toBe('zh-Hant');
  });

  it('matches ?lang= loosely (case and region)', () => {
    expect(setup({ url: 'https://example.test/?lang=ZH-tw' }).i18n.getLocale()).toBe('zh-Hant');
  });

  it('ignores an unsupported ?lang= and falls through to the stored choice', () => {
    expect(setup({ url: 'https://example.test/?lang=xx', stored: 'zh-Hant' }).i18n.getLocale()).toBe('zh-Hant');
  });

  it('ignores an unreadable stored choice and falls through to the browser language', () => {
    expect(setup({ stored: '{garbage', browser: 'zh-TW' }).i18n.getLocale()).toBe('zh-Hant');
  });

  it('does not write to storage when the language comes from ?lang=', () => {
    const { env } = setup({ url: 'https://example.test/?lang=zh-Hant' });
    expect(env.storage.getItem('mywidgetbox:lang')).toBeNull();
  });
});

describe('i18n manual language choice', () => {
  it('switches the language and notifies subscribers', () => {
    const { i18n } = setup({});
    const seen: string[] = [];
    i18n.subscribe((locale) => seen.push(locale));

    i18n.setLocale('zh-Hant');
    expect(i18n.getLocale()).toBe('zh-Hant');
    expect(i18n.t('greeting')).toBe('你好');
    expect(seen).toEqual(['zh-Hant']);
  });

  it('remembers the choice across a reload', () => {
    const { env, i18n } = setup({ browser: 'en-US' });
    i18n.setLocale('zh-Hant');

    const reloaded = createI18n(env, messages, { browserLanguage: 'en-US' });
    expect(reloaded.getLocale()).toBe('zh-Hant');
  });

  it('remembers a choice that matches the detected language, so a later browser change does not override it', () => {
    const { env, i18n } = setup({ browser: 'en-US' });
    i18n.setLocale('en');

    expect(createI18n(env, messages, { browserLanguage: 'zh-TW' }).getLocale()).toBe('en');
  });

  it('stops notifying after unsubscribe', () => {
    const { i18n } = setup({});
    let calls = 0;
    const unsubscribe = i18n.subscribe(() => calls++);
    i18n.setLocale('zh-Hant');
    unsubscribe();
    i18n.setLocale('en');
    expect(calls).toBe(1);
  });
});

describe('i18n messages', () => {
  it('falls back to the English message when the current locale lacks the key', () => {
    const { i18n } = setup({ browser: 'zh-TW' });
    expect(i18n.t('onlyEnglish')).toBe('English only');
  });

  it('falls back to the key itself when no table has it', () => {
    const { i18n } = setup({});
    expect(i18n.t('missing' as Key)).toBe('missing');
  });

  it('fills {name} placeholders and leaves unknown ones untouched', () => {
    const { i18n } = setup({ browser: 'zh-TW' });
    expect(i18n.t('rolled', { total: 17, count: 3 })).toBe('3 顆骰子擲出 17');
    i18n.setLocale('en');
    expect(i18n.t('rolled', { total: 17 })).toBe('Rolled 17 with {count} dice');
  });
});
