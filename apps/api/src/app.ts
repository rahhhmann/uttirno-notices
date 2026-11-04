import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { ApiErrorSchema } from '@uttirno/contracts';
import type { DependencyHealth } from '@uttirno/infrastructure';
import type { ApiOptions } from './app-options.js';
import { createAuth, AuthError } from './auth/session.js';
import { CursorCodec, CursorError } from './cursor.js';
import { registerPublic } from './routes/public.js';
import { registerAdmin } from './routes/admin.js';
export function createApp(check: () => Promise<DependencyHealth>, options?: ApiOptions) {
  const app = Fastify({
    logger: false,
    bodyLimit: 2097152,
    requestTimeout: 30000,
    connectionTimeout: 10000,
    genReqId: () => randomUUID(),
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  app.register(async (api) => {
    await api.register(cookie);
    await api.register(rateLimit, { max: options?.rateLimitMax ?? 120, timeWindow: 60000 });
    await api.register(swagger, {
      openapi: {
        openapi: '3.1.0',
        info: { title: 'Uttirno API', version: '1.0.0' },
        components: {
          securitySchemes: {
            adminCookie: {
              type: 'apiKey',
              in: 'cookie',
              name: options?.env.API_PUBLIC_ORIGIN.startsWith('https:')
                ? '__Host-uttirno_session'
                : 'uttirno_dev_session',
            },
          },
        },
      },
    });
    api.addHook('onRoute', (route) => {
      if (!route.url.startsWith('/v1/')) {
        route.schema = { ...route.schema, hide: true };
        return;
      }
      const authenticated =
        route.url.startsWith('/v1/admin') &&
        !['/v1/admin/auth/login', '/v1/admin/auth/callback'].includes(route.url);
      route.schema = { ...route.schema, security: authenticated ? [{ adminCookie: [] }] : [] };
      route.schema.response = {
        ...Object.fromEntries(
          [400, 401, 403, 404, 409, 413, 422, 429, 503].map((code) => [
            code,
            z.toJSONSchema(ApiErrorSchema, { target: 'draft-7' }),
          ]),
        ),
        ...(route.schema.response as Record<string, unknown> | undefined),
      };
      if (authenticated && route.method === 'POST')
        route.schema.headers = {
          type: 'object',
          required: route.url.endsWith('/auth/logout')
            ? ['origin', 'x-csrf-token']
            : ['origin', 'x-csrf-token', 'idempotency-key'],
          properties: {
            origin: { type: 'string' },
            'x-csrf-token': { type: 'string' },
            'idempotency-key': { type: 'string', format: 'uuid' },
          },
        };
      const names = [...route.url.matchAll(/:([A-Za-z_]+)/g)].flatMap((m) => (m[1] ? [m[1]] : []));
      if (names.length)
        route.schema.params = {
          type: 'object',
          required: names,
          properties: Object.fromEntries(names.map((name) => [name, { type: 'string' }])),
        };
    });
    api.addHook('onRequest', async (request, reply) => {
      reply
        .header('Cache-Control', 'no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .header('Referrer-Policy', 'no-referrer')
        .header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      const admin = request.url.startsWith('/v1/admin'),
        origin = request.headers.origin;
      if (admin && origin && origin !== options?.env.ADMIN_ORIGIN)
        throw new AuthError('ORIGIN_REJECTED', 403);
      if (admin && origin) {
        reply
          .header('Access-Control-Allow-Origin', origin)
          .header('Access-Control-Allow-Credentials', 'true')
          .header('Vary', 'Origin');
      }
      if (!admin) reply.header('Access-Control-Allow-Origin', '*');
      if (request.method === 'OPTIONS') {
        if (admin && origin !== options?.env.ADMIN_ORIGIN)
          throw new AuthError('ORIGIN_REJECTED', 403);
        return reply
          .header('Access-Control-Allow-Methods', 'GET, POST')
          .header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Idempotency-Key')
          .code(204)
          .send();
      }
    });
    api.options('/*', async (_request, reply) => reply.code(204).send());
    api.setNotFoundHandler((request, reply) =>
      reply.code(404).send({
        error: { code: 'NOT_FOUND', message: 'Record not found.', requestId: request.id },
      }),
    );
    api.setErrorHandler((error, request, reply) => {
      const message = error instanceof Error ? error.message : '';
      let status = 503,
        code = 'SERVICE_UNAVAILABLE';
      const record = error && typeof error === 'object' ? error : {};
      if (error instanceof AuthError) {
        status = error.status;
        code = error.code;
      } else if (
        error instanceof ZodError ||
        error instanceof CursorError ||
        'validation' in record
      ) {
        status = 400;
        code = 'INVALID_REQUEST';
      } else if (message.endsWith('_NOT_FOUND')) {
        status = 404;
        code = 'NOT_FOUND';
      } else if (message === 'ACTOR_NOT_AUTHORIZED') {
        status = 403;
        code = 'FORBIDDEN';
      } else if (message === 'SESSION_EXPIRED') {
        status = 401;
        code = 'UNAUTHENTICATED';
      } else if (
        /^(STALE_|.*_CONFLICT$|.*ALREADY_|LAST_ADMINISTRATOR_REQUIRED|TWO_PERSON_)/.test(message)
      ) {
        status = 409;
        code = 'CONFLICT';
      } else if (
        /^(VERIFICATION_FAILED|INCOMPLETE_|.*_REQUIRED$|.*_MISMATCH$|SOURCE_|COLLECTION_|POLICY_|UNTRUSTED_|INVALID_|RETENTION_|FULL_DISPLAY_|EVENT_MEANING|CORRECTION_|CANCELLED_)/.test(
          message,
        )
      ) {
        status = 422;
        code = 'POLICY_OR_EVIDENCE_REJECTED';
      } else if ('statusCode' in record && record.statusCode === 429) {
        status = 429;
        code = 'RATE_LIMITED';
      } else if ('statusCode' in record && record.statusCode === 413) {
        status = 413;
        code = 'REQUEST_TOO_LARGE';
      } else if ('statusCode' in record && record.statusCode === 400) {
        status = 400;
        code = 'INVALID_REQUEST';
      }
      return reply.code(status).send({
        error: {
          code,
          message:
            status === 503 ? 'Service temporarily unavailable.' : 'Request could not be accepted.',
          requestId: request.id,
        },
      });
    });
    api.get('/health/live', async () => ({ status: 'ok' }));
    api.get('/health/ready', async (_request, reply) => {
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
    if (options) {
      const auth = createAuth(options.database, options.env),
        cursor = new CursorCodec(options.env.API_CURSOR_SECRET);
      registerPublic(api, options.database, options.taxonomy, cursor);
      auth.register(api);
      registerAdmin(api, options.database, auth, cursor);
    } else
      api.get('/v1/jobs', async () => {
        throw new AuthError('API_NOT_CONFIGURED', 503);
      });
    api.get('/v1/openapi.json', { schema: { hide: true } }, async () => api.swagger());
  });
  return app;
}
