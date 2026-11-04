import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  IdentityRepository,
  type DatabaseOptions,
  withSessionAuthorization,
} from '@uttirno/database';
import { z } from 'zod';
import { SessionSchema, type Role } from '@uttirno/contracts';
import type { ApiEnvironment } from '@uttirno/env';
import { OidcProvider } from './oidc.js';
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
const transactionSchema = z.strictObject({
  state: z.string().min(32),
  nonce: z.string().min(32),
  verifier: z.string().min(32),
});
export class AuthError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}
export function createAuth(options: DatabaseOptions, env: ApiEnvironment) {
  const identities = new IdentityRepository(options),
    secure = new URL(env.API_PUBLIC_ORIGIN).protocol === 'https:';
  const sessionName = secure ? '__Host-uttirno_session' : 'uttirno_dev_session',
    loginName = secure ? '__Host-uttirno_login' : 'uttirno_dev_login';
  const cookie = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };
  const provider = env.AUTH_ISSUER
    ? new OidcProvider({
        issuer: env.AUTH_ISSUER,
        clientId: env.AUTH_CLIENT_ID ?? '',
        clientSecret: env.AUTH_CLIENT_SECRET ?? '',
        redirectUri: env.AUTH_REDIRECT_URI ?? '',
        allowedOrigins: env.AUTH_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? [],
        allowLoopbackHttp: env.NODE_ENV !== 'production' && env.AUTH_ALLOW_HTTP_LOOPBACK === 'true',
      })
    : undefined;
  const csrf = (token: string) =>
    createHmac('sha256', env.API_SESSION_SECRET).update(`csrf-v1:${token}`).digest('base64url');
  const encrypt = (value: unknown) => {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', Buffer.from(env.AUTH_STATE_KEY ?? '', 'hex'), iv);
    return Buffer.concat([
      iv,
      cipher.update(JSON.stringify(value)),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString('base64url');
  };
  const decrypt = (value: string) => {
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.length < 29) throw new AuthError('LOGIN_FAILED', 401);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(env.AUTH_STATE_KEY ?? '', 'hex'),
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(-16));
    return transactionSchema.parse(
      JSON.parse(
        Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString(),
      ),
    );
  };
  async function principal(request: FastifyRequest, roles?: Role[]) {
    const token = request.cookies[sessionName];
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthError('UNAUTHENTICATED', 401);
    const session = await identities.session(tokenHash(token));
    if (!session) throw new AuthError('UNAUTHENTICATED', 401);
    if (roles && !roles.some((role) => session.roles.includes(role)))
      throw new AuthError('FORBIDDEN', 403);
    return { ...session, token, tokenHash: tokenHash(token) };
  }
  function checkCsrf(request: FastifyRequest, token: string) {
    if (request.headers.origin !== env.ADMIN_ORIGIN) throw new AuthError('CSRF_REJECTED', 403);
    const supplied = request.headers['x-csrf-token'],
      expected = csrf(token);
    if (
      typeof supplied !== 'string' ||
      supplied.length !== expected.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      throw new AuthError('CSRF_REJECTED', 403);
    if (request.headers['sec-fetch-site'] === 'cross-site')
      throw new AuthError('CSRF_REJECTED', 403);
  }
  function register(app: FastifyInstance) {
    app.get('/v1/admin/auth/login', async (_request, reply) => {
      if (!provider) throw new AuthError('AUTH_NOT_CONFIGURED', 503);
      try {
        const begin = await provider.begin(),
          browser = randomBytes(32).toString('base64url');
        await identities.startLogin(
          tokenHash(begin.transaction.state),
          tokenHash(browser),
          encrypt(begin.transaction),
        );
        return reply.setCookie(loginName, browser, { ...cookie, maxAge: 300 }).redirect(begin.url);
      } catch {
        throw new AuthError('LOGIN_FAILED', 503);
      }
    });
    app.get('/v1/admin/auth/callback', async (request, reply) => {
      if (!provider) throw new AuthError('AUTH_NOT_CONFIGURED', 503);
      reply.clearCookie(loginName, cookie);
      try {
        const query = z
          .strictObject({
            code: z.string().max(2000).optional(),
            state: z.string().min(32).max(300),
            iss: z.string().max(2000).optional(),
            error: z.string().max(100).optional(),
            error_description: z.string().max(500).optional(),
          })
          .parse(request.query);
        const browser = request.cookies[loginName];
        if (!browser || !/^[A-Za-z0-9_-]{43}$/.test(browser))
          throw new Error('MISSING_LOGIN_BINDING');
        const encrypted = await identities.consumeLogin(tokenHash(query.state), tokenHash(browser));
        if (!encrypted) throw new Error('INVALID_LOGIN_STATE');
        const transaction = decrypt(encrypted),
          url = new URL(env.AUTH_REDIRECT_URI ?? '');
        for (const [key, value] of Object.entries(query))
          if (value !== undefined) url.searchParams.set(key, value);
        const identity = await provider.callback(url, transaction),
          token = randomBytes(32).toString('base64url');
        await identities.createSession(identity.issuer, identity.subject, tokenHash(token));
        const previous = request.cookies[sessionName];
        if (previous) {
          const old = await identities.session(tokenHash(previous));
          if (old) await identities.revoke(old.actorId, tokenHash(previous));
        }
        return reply
          .setCookie(sessionName, token, { ...cookie, maxAge: 28800 })
          .redirect(`${env.ADMIN_ORIGIN}/`);
      } catch {
        reply.clearCookie(sessionName, cookie);
        throw new AuthError('LOGIN_FAILED', 401);
      }
    });
    app.get('/v1/admin/session', async (request) => {
      const p = await principal(request);
      return SessionSchema.parse({
        actorId: p.actorId,
        roles: p.roles,
        expiresAt: p.expiresAt,
        csrfToken: csrf(p.token),
      });
    });
    app.post('/v1/admin/auth/logout', async (request, reply) => {
      const p = await principal(request);
      checkCsrf(request, p.token);
      z.strictObject({}).parse(request.body);
      await identities.revoke(p.actorId, p.tokenHash);
      return reply.clearCookie(sessionName, cookie).send({ ok: true });
    });
  }
  return {
    register,
    principal,
    checkCsrf,
    identities,
    authorized: <T>(actor: string, hash: string, action: () => Promise<T>) =>
      withSessionAuthorization(actor, hash, action),
  };
}
