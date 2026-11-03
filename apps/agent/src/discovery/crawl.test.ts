import { it, expect } from 'vitest';
import { syntheticSource, instantLimiter, testNow } from '../../../../tests/helpers/source.js';
import { AdapterSchema } from '@uttirno/source-config';
import { SourceClient } from '../fetch/client.js';
import { discover } from './crawl.js';
function makeClient(pages: Record<string, string>, maxPages = 20) {
  const source = syntheticSource({
    adapter: AdapterSchema.parse({
      kind: 'html',
      items: '.job',
      title: 'h2',
      detailLink: 'a.more',
      next: 'a.next',
    }),
    detailAdapter: AdapterSchema.parse({
      kind: 'html',
      items: 'article',
      title: 'h1',
      attachments: 'a.pdf',
      siblings: 'a.related',
    }),
    limits: { maxPages },
  });
  return new SourceClient({
    load: async () => source.bundle,
    keys: source.trust,
    userAgent: 'UttirnoNoticeBot/0.2 (+https://example.com)',
    resolver: async () => [{ address: '8.8.8.8', family: 4 }],
    limiter: instantLimiter(),
    now: () => testNow,
    transport: async (r) => ({
      status: 200,
      headers: { 'content-type': r.url.pathname === '/robots.txt' ? 'text/plain' : 'text/html' },
      body: Buffer.from(
        r.url.pathname === '/robots.txt'
          ? 'User-agent: *\nAllow: /'
          : (pages[r.url.pathname + r.url.search] ?? ''),
      ),
    }),
  });
}
it('R07 follows pagination, details, sibling roles and attachment inventory', async () => {
  const c = makeClient({
    '/list':
      '<article class="job"><h2>Listing</h2><a class="more" href="/detail/a">A</a></article><a class="next" href="/list?page=2">Next</a>',
    '/list?page=2':
      '<article class="job"><h2>Second</h2><a class="more" href="/detail/b">B</a></article>',
    '/detail/a':
      '<article><h1>A</h1><a class="related" href="/detail/b">B</a><a class="pdf" href="/docs/a.pdf">PDF</a></article>',
    '/detail/b': '<article><h1>B</h1></article>',
  });
  const run = await discover(c);
  expect(run.complete).toBe(true);
  expect(run.pages).toHaveLength(4);
  expect(run.attachments).toEqual(['https://notices.example/docs/a.pdf']);
  expect(run.candidates.map((c) => c.title)).toContain('B');
});
it('pagination loops and configured budgets never report complete', async () => {
  const loop = await discover(
    makeClient({
      '/list': '<article class="job"><h2>A</h2></article><a class="next" href="/list">Loop</a>',
    }),
  );
  expect(loop.errors).toContain('PAGINATION_LOOP');
  expect(loop.complete).toBe(false);
  const limited = await discover(
    makeClient(
      {
        '/list':
          '<article class="job"><h2>A</h2></article><a class="next" href="/list?page=2">Next</a>',
      },
      1,
    ),
  );
  expect(limited.truncated).toBe(true);
  expect(limited.complete).toBe(false);
});
