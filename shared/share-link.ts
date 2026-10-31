import { LANG_PARAM } from './i18n';
import type { VersionedSettings } from './settings';

/**
 * Shared (opt-in) Share link format. A Share link is the Widget's page URL with:
 * - `s`: the versioned Settings as base64url-encoded UTF-8 JSON
 * - `display`: Display mode (controls hidden)
 * - `transparent`: transparent background
 * - `lang`: the UI language (see shared/i18n.ts)
 * Pass `readShareLinkSettings` as the `readUrl` option of the Settings store.
 */
export const SETTINGS_PARAM = 's';
export const DISPLAY_PARAM = 'display';
export const TRANSPARENT_PARAM = 'transparent';

export interface ShareLinkOptions {
  display?: boolean;
  transparent?: boolean;
  /** Locale to force on open, e.g. i18n.getLocale(). */
  lang?: string;
}

export interface DisplayOptions {
  /** Controls hidden; only the Widget itself is shown. */
  display: boolean;
  transparent: boolean;
}

/** Builds a Share link from the page URL; any query or hash already on it is dropped. */
export function createShareLink(pageUrl: URL, settings: VersionedSettings, options: ShareLinkOptions = {}): string {
  const url = new URL(pageUrl.pathname, pageUrl.origin);
  url.searchParams.set(SETTINGS_PARAM, encodeBase64Url(JSON.stringify(settings)));
  if (options.display) url.searchParams.set(DISPLAY_PARAM, '1');
  if (options.transparent) url.searchParams.set(TRANSPARENT_PARAM, '1');
  if (options.lang) url.searchParams.set(LANG_PARAM, options.lang);
  return url.href;
}

/** The versioned Settings carried by a Share link, or null when the URL has none. Throws on garbage. */
export function readShareLinkSettings(url: URL): VersionedSettings | null {
  const raw = url.searchParams.get(SETTINGS_PARAM);
  if (raw === null) return null;
  const data: unknown = JSON.parse(decodeBase64Url(raw));
  if (typeof data !== 'object' || data === null) throw new Error('share link: not an object');
  const { version, settings } = data as Partial<VersionedSettings>;
  return { version: version as number, settings };
}

/** Display mode flags from the URL; `?display`, `?display=1` and `?display=true` all turn it on. */
export function readDisplayOptions(url: URL): DisplayOptions {
  return { display: isOn(url, DISPLAY_PARAM), transparent: isOn(url, TRANSPARENT_PARAM) };
}

function isOn(url: URL, param: string): boolean {
  const value = url.searchParams.get(param);
  return value !== null && value !== '0' && value.toLowerCase() !== 'false';
}

// btoa/atob instead of Uint8Array.toBase64: OBS ships an older Chromium.
function encodeBase64Url(text: string): string {
  const binary = Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(encoded: string): string {
  const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
