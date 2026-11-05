export function apiOrigin(input: string | undefined) {
  const value = input ?? 'http://127.0.0.1:4000',
    url = new URL(value);
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    !(
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    )
  )
    throw new Error('INVALID_ADMIN_API_ORIGIN');
  return value;
}
export function publicSettings(input: Record<string, string | undefined>) {
  const home = input.ADMIN_HOME_URL ?? 'https://uttirno.org/';
  const url = new URL(home);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('INVALID_ADMIN_HOME_URL');
  return { brand: (input.ADMIN_BRAND_NAME ?? 'Uttirno').slice(0, 80), home: url.href };
}
