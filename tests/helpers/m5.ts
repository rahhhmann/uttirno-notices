import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { parseApiEnvironment } from '@uttirno/env';
import { IdentityRepository } from '@uttirno/database';
import { TaxonomySchema, type Role } from '@uttirno/contracts';
import { createApp } from '../../apps/api/src/app.js';
import { m4Context } from './m4.js';
import { oidcFixture } from './oidc.js';
export async function m5Context(
  registerSource = true,
  settings: {
    apiPublicOrigin?: string;
    adminOrigin?: string;
    sourceOverrides?: Record<string, unknown>;
  } = {},
) {
  const c = await m4Context(settings.sourceOverrides ?? {}, registerSource),
    provider = await oidcFixture(
      `${settings.apiPublicOrigin ?? 'http://127.0.0.1:4000'}/v1/admin/auth/callback`,
    );
  const env = parseApiEnvironment({
    NODE_ENV: 'test',
    API_PUBLIC_ORIGIN: settings.apiPublicOrigin ?? 'http://127.0.0.1:4000',
    ADMIN_ORIGIN: settings.adminOrigin ?? 'http://127.0.0.1:3001',
    API_CURSOR_SECRET: 'SYNTHETIC-cursor-secret-not-real-000000',
    API_SESSION_SECRET: 'SYNTHETIC-session-secret-not-real-000000',
    AUTH_ISSUER: provider.issuer,
    AUTH_CLIENT_ID: provider.clientId,
    AUTH_CLIENT_SECRET: provider.clientSecret,
    AUTH_REDIRECT_URI: `${settings.apiPublicOrigin ?? 'http://127.0.0.1:4000'}/v1/admin/auth/callback`,
    AUTH_ALLOWED_ORIGINS: provider.issuer,
    AUTH_STATE_KEY: 'a'.repeat(64),
    AUTH_ALLOW_HTTP_LOOPBACK: 'true',
  });
  const taxonomy = TaxonomySchema.parse(
    JSON.parse(await readFile('config/taxonomy/search.v1.json', 'utf8')),
  );
  const identity = new IdentityRepository(c.options);
  await identity.bootstrap({
    actorId: 'administrator',
    issuer: provider.issuer,
    subject: 'admin-sub',
    roles: ['administrator'],
    reason: 'SYNTHETIC explicit bootstrap',
  });
  for (const [actor, role] of [
    ['operator', 'operator'],
    ['reviewer', 'reviewer'],
    ['reviewer2', 'reviewer'],
    ['approver', 'source_approver'],
  ] as const)
    await identity.provision('administrator', {
      actorId: actor,
      issuer: provider.issuer,
      subject: `${actor}-sub`,
      roles: [role],
      reason: 'SYNTHETIC explicit role binding',
    });
  const app = createApp(async () => ({ database: true, redis: true, storage: true }), {
    env,
    database: c.options,
    taxonomy,
    rateLimitMax: 2000,
    archiveRoot: c.root,
  });
  await app.ready();
  async function login(subject: string) {
    provider.setSubject(subject);
    const begin = await app.inject('/v1/admin/auth/login');
    if (begin.statusCode !== 302) throw new Error(`SYNTHETIC_LOGIN_START_${begin.statusCode}`);
    const loginCookie = begin.cookies.find((cookie) => cookie.name === 'uttirno_dev_login');
    if (!loginCookie) throw new Error('SYNTHETIC_LOGIN_COOKIE');
    const authorized = await fetch(String(begin.headers.location), { redirect: 'manual' }),
      callback = new URL(authorized.headers.get('location') ?? '');
    const response = await app.inject({
      url: callback.pathname + callback.search,
      headers: { cookie: `${loginCookie.name}=${loginCookie.value}` },
    });
    const cookie = response.cookies.find((item) => item.name === 'uttirno_dev_session');
    return {
      response,
      cookie: cookie ? `${cookie.name}=${cookie.value}` : null,
      begin,
      callback,
      loginCookie,
    };
  }
  async function session(subject: string) {
    const result = await login(subject);
    if (!result.cookie || result.response.statusCode !== 302)
      throw new Error('SYNTHETIC_LOGIN_FAILED');
    const response = await app.inject({
      url: '/v1/admin/session',
      headers: { cookie: result.cookie, origin: env.ADMIN_ORIGIN },
    });
    return {
      cookie: result.cookie,
      csrf: response.json().csrfToken as string,
      actorId: response.json().actorId as string,
      roles: response.json().roles as Role[],
    };
  }
  async function post(
    session: { cookie: string; csrf: string },
    url: string,
    body: unknown,
    key = randomUUID(),
  ) {
    return app.inject({
      method: 'POST',
      url,
      payload: body as Record<string, unknown>,
      headers: {
        cookie: session.cookie,
        origin: env.ADMIN_ORIGIN,
        'x-csrf-token': session.csrf,
        'idempotency-key': key,
      },
    });
  }
  const { archive: _privateArchive, ...context } = c;
  return {
    ...context,
    provider,
    env,
    taxonomy,
    identity,
    app,
    login,
    session,
    post,
    tokenHash: (token: string) => createHash('sha256').update(token).digest('hex'),
    close: async () => {
      await app.close();
      await provider.close();
      await c.close();
    },
  };
}
