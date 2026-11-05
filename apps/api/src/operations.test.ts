import { it, expect } from 'vitest';
import Fastify from 'fastify';
import { registerOperations } from './operations.js';
it('R23/R24 protected metrics and correlated logs never include query strings, cookies, tokens or bodies', async () => {
  const app = Fastify(),
    logs: Record<string, unknown>[] = [];
  registerOperations(app, { token: 's'.repeat(32), log: (entry) => logs.push(entry) });
  app.get('/sample', async () => ({ ok: true }));
  try {
    const response = await app.inject({
      url: '/sample?private=DO_NOT_LOG',
      headers: { cookie: 'DO_NOT_LOG', authorization: 'DO_NOT_LOG' },
    });
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(JSON.stringify(logs)).not.toContain('DO_NOT_LOG');
    expect((await app.inject('/internal/metrics')).statusCode).toBe(404);
    const metrics = await app.inject({
      url: '/internal/metrics',
      headers: { authorization: `Bearer ${'s'.repeat(32)}` },
    });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.body).toContain('uttirno_http_requests_total');
  } finally {
    await app.close();
  }
});
