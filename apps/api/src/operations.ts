import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { operationsSnapshot, type DatabaseOptions } from '@uttirno/database';
export type OperationsOptions = {
  token?: string | undefined;
  log?: (entry: Record<string, unknown>) => void;
};
export function registerOperations(
  app: FastifyInstance,
  options: OperationsOptions,
  database?: DatabaseOptions,
  check?: () => Promise<Record<string, boolean>>,
) {
  const counters = new Map<string, { count: number; seconds: number }>();
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? 'unmatched';
    const key = `method="${request.method}",route="${route}",status="${reply.statusCode}"`;
    const value = counters.get(key) ?? { count: 0, seconds: 0 };
    value.count++;
    value.seconds += reply.elapsedTime / 1000;
    counters.set(key, value);
    try {
      options.log?.({
        event: 'http_response',
        requestId: request.id,
        method: request.method,
        route,
        status: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      });
    } catch {
      /* Logging cannot change request correctness. */
    }
  });
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });
  app.get(
    '/internal/metrics',
    { config: { rateLimit: false }, schema: { hide: true } },
    async (request, reply) => {
      const expected = options.token;
      const supplied = request.headers.authorization;
      if (
        !expected ||
        expected.length < 32 ||
        typeof supplied !== 'string' ||
        Buffer.byteLength(supplied) !== Buffer.byteLength(expected) + 7 ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(`Bearer ${expected}`))
      )
        return reply.code(404).send();
      const lines = [
        '# TYPE uttirno_http_requests_total counter',
        '# TYPE uttirno_http_duration_seconds_sum counter',
      ];
      if (check) {
        let failed = 1;
        try {
          failed = Object.values(await check()).filter((value) => !value).length;
        } catch {}
        lines.push(`uttirno_dependency_failures ${failed}`);
      }
      for (const [key, value] of counters) {
        lines.push(
          `uttirno_http_requests_total{${key}} ${value.count}`,
          `uttirno_http_duration_seconds_sum{${key}} ${value.seconds}`,
        );
      }
      if (database)
        for (const [key, value] of Object.entries(await operationsSnapshot(database.pool)))
          lines.push(`uttirno_${key} ${value}`);
      return reply
        .type('text/plain; version=0.0.4')
        .header('Cache-Control', 'no-store')
        .send(lines.join('\n') + '\n');
    },
  );
}
