import { PublicApiClient } from '@uttirno/api-client';
export function settings(input: Record<string, string | undefined> = process.env) {
  const client = new PublicApiClient({
    baseUrl: input.PORTAL_API_ORIGIN ?? 'http://127.0.0.1:4000',
    fetch: (url, init) => globalThis.fetch(url, { ...init, cache: 'no-store' }),
  });
  const home = new URL(input.PORTAL_HOME_URL ?? 'https://uttirno.org/');
  if (home.protocol !== 'https:' || home.username || home.password)
    throw new Error('INVALID_PORTAL_HOME');
  const preparation: { category: string; label: string; url: string }[] = [];
  if (input.PORTAL_PREPARATION_LINKS) {
    const entries: unknown = JSON.parse(input.PORTAL_PREPARATION_LINKS);
    if (!Array.isArray(entries) || entries.length > 20)
      throw new Error('INVALID_PREPARATION_LINKS');
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry.category !== 'string' ||
        !entry.category ||
        entry.category.length > 100 ||
        typeof entry.label !== 'string' ||
        !entry.label ||
        entry.label.length > 150 ||
        typeof entry.url !== 'string'
      )
        throw new Error('INVALID_PREPARATION_LINKS');
      const destination = new URL(entry.url);
      if (destination.origin !== home.origin || destination.username || destination.password)
        throw new Error('INVALID_PREPARATION_ORIGIN');
      preparation.push({ category: entry.category, label: entry.label, url: destination.href });
    }
  }
  return {
    client,
    home: home.href,
    brand: (input.PORTAL_BRAND_NAME ?? 'Uttirno').slice(0, 80),
    preparation,
  };
}
export function safeLink(value: string): string | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
