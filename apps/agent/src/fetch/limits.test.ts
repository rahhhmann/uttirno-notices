import { it, expect, vi } from 'vitest';
import { syntheticSource, instantLimiter, testNow } from '../../../../tests/helpers/source.js';
import { SourceClient } from './client.js';
import type { WireRequest, WireResponse } from './network.js';
it('trust-key revocation blocks the next request before dispatch', async () => {
  const s = syntheticSource();
  let revoked = false;
  const transport = vi.fn(async () => reply('User-agent: *\nAllow: /'));
  const client = new SourceClient({
    load: async () => s.bundle,
    keys: async () => (revoked ? {} : s.trust),
    userAgent: 'UttirnoNoticeBot/0.2 (+https://example.com)',
    resolver: async () => [{ address: '8.8.8.8', family: 4 }],
    transport,
    limiter: instantLimiter(),
    now: () => testNow,
  });
  revoked = true;
  await expect(client.get('https://notices.example/list')).rejects.toThrow('UNTRUSTED_APPROVAL');
  expect(transport).not.toHaveBeenCalled();
});
function limited(overrides: Record<string, unknown>, handler: (r: WireRequest) => WireResponse) {
  const s = syntheticSource(overrides);
  const transport = vi.fn(async (r: WireRequest) => handler(r));
  return {
    transport,
    client: new SourceClient({
      load: async () => s.bundle,
      keys: s.trust,
      userAgent: 'UttirnoNoticeBot/0.2 (+https://example.com)',
      resolver: async () => [{ address: '8.8.8.8', family: 4 }],
      transport,
      limiter: instantLimiter(),
      now: () => testNow,
      sleep: async () => {},
    }),
  };
}
const reply = (body: string, status = 200, headers: Record<string, string> = {}): WireResponse => ({
  status,
  headers: { 'content-type': 'text/html', ...headers },
  body: Buffer.from(body),
});
it('request budget includes robots and blocks content before dispatch', async () => {
  const a = limited({ limits: { maxRequests: 1 } }, () => reply('User-agent: *\nAllow: /'));
  await expect(a.client.get('https://notices.example/list')).rejects.toThrow('REQUEST_BUDGET');
  expect(a.transport).toHaveBeenCalledTimes(1);
});
it('total-byte budget includes policy responses and content', async () => {
  const a = limited({ limits: { maxTotalBytes: 128 } }, (r) =>
    r.url.pathname === '/robots.txt' ? reply('User-agent: *\nAllow: /') : reply('x'.repeat(120)),
  );
  await expect(a.client.get('https://notices.example/list')).rejects.toThrow('BYTE_BUDGET');
});
it('a robots crawl-delay requires a sufficiently slow reviewed config', async () => {
  const a = limited({}, () => reply('User-agent: *\nCrawl-delay: 8\nAllow: /'));
  await expect(a.client.get('https://notices.example/list')).rejects.toThrow(
    'CRAWL_DELAY_REQUIRES_CONFIG_REVIEW',
  );
  expect(a.transport).toHaveBeenCalledTimes(1);
});
it('invalid robots content never becomes implicit allow', async () => {
  const a = limited({}, () => reply('Access temporarily denied'));
  await expect(a.client.get('https://notices.example/list')).rejects.toThrow(
    'INVALID_ROBOTS_CONTENT',
  );
});
it('a source access block trips the client kill switch', async () => {
  const a = limited({}, (r) =>
    r.url.pathname === '/robots.txt' ? reply('User-agent: *\nAllow: /') : reply('', 403),
  );
  await expect(a.client.get('https://notices.example/list')).rejects.toThrow(
    'SOURCE_ACCESS_BLOCKED',
  );
  await expect(a.client.get('https://notices.example/list')).rejects.toThrow('CLIENT_STOPPED');
  expect(a.transport).toHaveBeenCalledTimes(2);
});
it('304 without matching stored bytes is rejected', async () => {
  const a = limited({}, (r) =>
    r.url.pathname === '/robots.txt' ? reply('User-agent: *\nAllow: /') : reply('', 304),
  );
  await expect(a.client.get('https://notices.example/list')).rejects.toThrow(
    'UNEXPECTED_NOT_MODIFIED',
  );
});
it('redirect loops never return a successful empty page', async () => {
  const a = limited({}, (r) =>
    r.url.pathname === '/robots.txt'
      ? reply('User-agent: *\nAllow: /')
      : reply('', 302, { location: '/list' }),
  );
  await expect(a.client.get('https://notices.example/list')).rejects.toThrow(
    'REDIRECT_LOOP_OR_MISSING_LOCATION',
  );
});
it('robots redirects cannot bootstrap arbitrary paths', async () => {
  const a = limited({}, () => reply('', 302, { location: '/private' }));
  await expect(a.client.get('https://notices.example/list')).rejects.toThrow('INVALID_ROBOTS_URL');
  expect(a.transport).toHaveBeenCalledTimes(1);
});
