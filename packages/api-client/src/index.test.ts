import { it, expect, vi } from 'vitest';
import { PublicApiClient } from './index.js';
it('R19 clients validate DTOs and redact invalid upstream error contents', async () => {
  const invalid = new PublicApiClient({
    baseUrl: 'http://127.0.0.1:4000',
    fetch: async () =>
      new Response(JSON.stringify({ internal: 'private-secret' }), { status: 500 }),
  });
  await expect(invalid.jobs()).rejects.toMatchObject({ status: 500, code: 'INVALID_API_RESPONSE' });
  const malformed = new PublicApiClient({
    baseUrl: 'http://127.0.0.1:4000',
    fetch: async () => Response.json({ items: [{ draft: true }], nextCursor: null }),
  });
  await expect(malformed.jobs()).rejects.toThrow();
  expect(() => new PublicApiClient({ baseUrl: 'http://evil.example' })).toThrow(
    'INVALID_API_ORIGIN',
  );
});

it('M6 default browser fetch retains the global receiver', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(function (this: typeof globalThis) {
    expect(this).toBe(globalThis);
    return Promise.resolve(
      Response.json({ items: [], nextCursor: null, asOf: new Date().toISOString() }),
    );
  });
  try {
    const client = new PublicApiClient({ baseUrl: 'http://127.0.0.1:4000' });
    expect((await client.jobs()).items).toEqual([]);
  } finally {
    spy.mockRestore();
  }
});
