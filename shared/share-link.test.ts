import { describe, expect, it } from 'vitest';
import { type SettingsSchema, createSettingsStore, serializeSettings, settingsStorageKey } from './settings';
import { createShareLink, readDisplayOptions, readShareLinkSettings } from './share-link';
import { createTestEnv } from './test-env';

// A wheel-like Widget whose Settings changed shape once:
// v1 { items: string[] }  ->  v2 { entries: { label: string }[] }
interface WheelLikeSettings {
  entries: { label: string }[];
}

const schema: SettingsSchema<WheelLikeSettings> = {
  namespace: 'wheel-like',
  version: 2,
  defaults: { entries: [{ label: 'A' }] },
  migrations: { 1: ({ items }) => ({ entries: (items as string[]).map((label) => ({ label })) }) },
  isValid: (settings): settings is WheelLikeSettings =>
    Array.isArray((settings as WheelLikeSettings).entries) &&
    (settings as WheelLikeSettings).entries.every((entry) => typeof entry.label === 'string'),
};

const page = new URL('https://example.test/MyWidgetBox/wheel/');
const open = (url: string) => createSettingsStore(createTestEnv({ url }), schema, { readUrl: readShareLinkSettings });

describe('Share link', () => {
  it('round-trips Settings with non-ASCII text', () => {
    const settings = { entries: [{ label: '今晚吃什麼？' }, { label: 'Ramen 🍜' }, { label: 'a+b/c=d' }] };
    const link = createShareLink(page, serializeSettings(schema, settings));

    expect(open(link).getSnapshot()).toMatchObject({ settings, source: 'url' });
  });

  it('opens an old-version Share link after migrating it', () => {
    const v1Link = createShareLink(page, { version: 1, settings: { items: ['Alice', 'Bob'] } });
    expect(open(v1Link).getSnapshot().settings).toEqual({ entries: [{ label: 'Alice' }, { label: 'Bob' }] });
  });

  it('never writes to storage when opened', () => {
    const env = createTestEnv({ url: createShareLink(page, { version: 2, settings: { entries: [{ label: 'X' }] } }) });
    const store = createSettingsStore(env, schema, { readUrl: readShareLinkSettings });
    store.update({ entries: [{ label: 'Y' }] });
    expect(env.storage.getItem(settingsStorageKey('wheel-like'))).toBeNull();
  });

  it.each(['?s=%%%', '?s=bnVsbA', '?s=e30', '?other=1', ''])('falls back to defaults for %j', (query) => {
    expect(open(`${page.href}${query}`).getSnapshot()).toMatchObject({ settings: schema.defaults, source: 'defaults' });
  });
});

describe('Display mode options', () => {
  it.each([
    ['', { display: false, transparent: false }],
    ['?display', { display: true, transparent: false }],
    ['?display=1&transparent=1', { display: true, transparent: true }],
    ['?display=true&transparent=0', { display: true, transparent: false }],
    ['?display=false&transparent', { display: false, transparent: true }],
  ])('reads %j', (query, expected) => {
    expect(readDisplayOptions(new URL(`${page.href}${query}`))).toEqual(expected);
  });
});
