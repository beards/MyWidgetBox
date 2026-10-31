/** '' (nothing entered) or an absolute http(s) URL; used for user-entered image and sound URLs. */
export function isHttpUrlOrEmpty(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === '') return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
