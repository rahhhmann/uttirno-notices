import Fastify from 'fastify';
import type { DependencyHealth } from '@uttirno/infrastructure';
export function createApp(check: () => Promise<DependencyHealth>) {
  const app = Fastify({ logger: false, bodyLimit: 65536 });
  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      const dependencies = await check();
      const ready = Object.values(dependencies).every(Boolean);
      return reply
        .code(ready ? 200 : 503)
        .send({ status: ready ? 'ready' : 'not_ready', dependencies });
    } catch {
      return reply.code(503).send({ status: 'not_ready' });
    }
  });
  return app;
}
