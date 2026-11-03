import { describe, it, expect, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import { syntheticSource, testNow, instantLimiter } from '../../../../tests/helpers/source.js';
import { SourceClient } from './client.js';
import { isPublicAddress, decodeBody, type WireRequest, type WireResponse } from './network.js';
import { HostLimiter } from './limiter.js';
const response = (
  body = '<article class="job"><h2>Test</h2></article>',
  status = 200,
  headers: Record<string, string> = {},
): WireResponse => ({
  status,
  headers: { 'content-type': 'text/html', ...headers },
  body: Buffer.from(body),
});
function setup(handler?: (request: WireRequest) => Promise<WireResponse>) {
  const source = syntheticSource();
  const transport = vi.fn(
    handler ??
      (async (r) =>
        r.url.pathname === '/robots.txt'
          ? response('User-agent: *\nDisallow: /blocked\n', 200, { 'content-type': 'text/plain' })
          : response()),
  );
  const resolver = vi.fn(async () => [{ address: '8.8.8.8', family: 4 }]);
  const sleep = vi.fn(async (_ms: number) => {});
  return {
    source,
    transport,
    resolver,
    sleep,
    client: new SourceClient({
      load: async () => source.bundle,
      keys: source.trust,
      userAgent: 'UttirnoNoticeBot/0.2 (+https://example.com)',
      resolver,
      transport,
      limiter: instantLimiter(),
      now: () => testNow,
      sleep,
    }),
  };
}
describe('R03 address and decompression safety', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '192.0.2.1',
    '198.18.0.1',
    '203.0.113.2',
    '224.0.0.1',
    '0.0.0.0',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '64:ff9b::a9fe:a9fe',
    '2001:db8::1',
  ])('rejects non-public %s', (ip) => expect(isPublicAddress(ip)).toBe(false));
  it('allows normal public addresses and bounds decompression', () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('2001:4860:4860::8888')).toBe(true);
    expect(decodeBody(gzipSync('hello'), 'gzip', 128).toString()).toBe('hello');
    expect(() => decodeBody(gzipSync('x'.repeat(10000)), 'gzip', 128)).toThrow(
      'INVALID_OR_OVERSIZED_BODY',
    );
    expect(() => decodeBody(Buffer.from('bad'), 'gzip', 128)).toThrow();
  });
});
describe('R01-R04/R28 request gates', () => {
  it('unsigned configs cause zero DNS or HTTP requests', async () => {
    const a = setup();
    const client = new SourceClient({
      load: async () => ({ config: a.source.config }),
      keys: a.source.trust,
      userAgent: 'UttirnoNoticeBot/0.2 (+https://example.com)',
      resolver: a.resolver,
      transport: a.transport,
    });
    await expect(client.get('https://notices.example/list')).rejects.toThrow('UNTRUSTED_APPROVAL');
    expect(a.resolver).not.toHaveBeenCalled();
    expect(a.transport).not.toHaveBeenCalled();
  });
  it('rejects mixed public/private DNS before transport', async () => {
    const a = setup();
    const client = new SourceClient({
      load: async () => a.source.bundle,
      keys: a.source.trust,
      userAgent: 'UttirnoNoticeBot/0.2 (+https://example.com)',
      resolver: async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ],
      transport: a.transport,
      limiter: instantLimiter(),
      now: () => testNow,
    });
    await expect(client.get('https://notices.example/list')).rejects.toThrow('NON_PUBLIC_DNS');
    expect(a.transport).not.toHaveBeenCalled();
  });
  it('honors robots before content request', async () => {
    const a = setup();
    await expect(a.client.get('https://notices.example/blocked')).rejects.toThrow('ROBOTS_DENIED');
    expect(a.transport).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 404, 500])('robots HTTP %s fails closed by default', async (status) => {
    const a = setup(async () => response('', status));
    await expect(a.client.get('https://notices.example/list')).rejects.toThrow(
      'ROBOTS_UNAVAILABLE',
    );
    expect(a.transport).toHaveBeenCalledTimes(1);
  });
  it('allows missing robots only with a signed reviewed exception', async () => {
    const s = syntheticSource({ robots: { missingReviewed: true, maxAgeSeconds: 3600 } });
    const wire = vi.fn(async (r: WireRequest) =>
      r.url.pathname === '/robots.txt' ? response('', 404) : response(),
    );
    const c = new SourceClient({
      load: async () => s.bundle,
      keys: s.trust,
      userAgent: 'UttirnoNoticeBot/0.2 (+https://example.com)',
      resolver: async () => [{ address: '8.8.8.8', family: 4 }],
      transport: wire,
      limiter: instantLimiter(),
      now: () => testNow,
    });
    expect((await c.get('https://notices.example/list')).status).toBe(200);
  });
  it('redirects cannot escape exact origins or reach private hosts', async () => {
    const a = setup(async (r) =>
      r.url.pathname === '/robots.txt'
        ? response('User-agent: *\nAllow: /')
        : response('', 302, { location: 'http://169.254.169.254/latest/meta-data/' }),
    );
    await expect(a.client.get('https://notices.example/list')).rejects.toThrow('UNSAFE_URL');
    expect(a.transport).toHaveBeenCalledTimes(2);
  });
  it('rechecks revocation between robots and content', async () => {
    const s = syntheticSource();
    let current = s.bundle;
    const transport = vi.fn(async () => {
      current = s.resign({ ...s.config, state: 'paused' });
      return response('User-agent: *\nAllow: /');
    });
    const c = new SourceClient({
      load: async () => current,
      keys: s.trust,
      userAgent: 'UttirnoNoticeBot/0.2 (+https://example.com)',
      resolver: async () => [{ address: '8.8.8.8', family: 4 }],
      transport,
      limiter: instantLimiter(),
      now: () => testNow,
    });
    await expect(c.get('https://notices.example/list')).rejects.toThrow('SOURCE_NOT_ACTIVE');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('rechecks signed configuration after DNS to prevent stale approval use', async () => {
    const s = syntheticSource();
    let current = s.bundle;
    const transport = vi.fn(async () => response());
    const c = new SourceClient({
      load: async () => current,
      keys: s.trust,
      userAgent: 'UttirnoNoticeBot/0.2 (+https://example.com)',
      resolver: async () => {
        current = s.resign({ ...s.config, version: 2 });
        return [{ address: '8.8.8.8', family: 4 }];
      },
      transport,
      limiter: instantLimiter(),
      now: () => testNow,
    });
    await expect(c.get('https://notices.example/list')).rejects.toThrow(
      'CONFIG_CHANGED_DURING_RUN',
    );
    expect(transport).not.toHaveBeenCalled();
  });
  it('bounded retry honors Retry-After and fresh gates', async () => {
    let count = 0;
    const a = setup(async (r) =>
      r.url.pathname === '/robots.txt'
        ? response('User-agent: *\nAllow: /')
        : ++count === 1
          ? response('', 429, { 'retry-after': '2' })
          : response(),
    );
    expect((await a.client.get('https://notices.example/list')).status).toBe(200);
    expect(a.sleep).toHaveBeenCalledWith(2000);
    expect(a.client.requestCount).toBe(3);
  });
  it('long Retry-After never retries prematurely', async () => {
    const a = setup(async (r) =>
      r.url.pathname === '/robots.txt'
        ? response('User-agent: *\nAllow: /')
        : response('', 429, { 'retry-after': '120' }),
    );
    await expect(a.client.get('https://notices.example/list')).rejects.toThrow('RETRY_LATER');
    expect(a.sleep).not.toHaveBeenCalled();
  });
  it('conditional requests reuse only their own cached bytes', async () => {
    let count = 0;
    const a = setup(async (r) =>
      r.url.pathname === '/robots.txt'
        ? response('User-agent: *\nAllow: /')
        : ++count === 1
          ? response('original', 200, { etag: 'v1' })
          : response('', 304),
    );
    const first = await a.client.get('https://notices.example/list');
    const second = await a.client.get('https://notices.example/list');
    expect(second.notModified).toBe(true);
    expect(second.sha256).toBe(first.sha256);
    expect(a.transport.mock.calls.at(-1)?.[0].headers['if-none-match']).toBe('v1');
  });
  it('a stop switch blocks further requests', async () => {
    const a = setup();
    a.client.stop();
    await expect(a.client.get('https://notices.example/list')).rejects.toThrow('CLIENT_STOPPED');
    expect(a.transport).not.toHaveBeenCalled();
  });
  it('serializes full requests with host-wide minimum interval', async () => {
    let clock = 0,
      active = 0;
    const starts: number[] = [];
    const limiter = new HostLimiter(
      () => clock,
      async (ms) => {
        clock += ms;
      },
    );
    await Promise.all(
      [1, 2, 3].map(() =>
        limiter.run('one.example', 4000, async () => {
          expect(++active).toBe(1);
          starts.push(clock);
          await Promise.resolve();
          active--;
        }),
      ),
    );
    expect(starts).toEqual([0, 4000, 8000]);
  });
});
