import { z } from 'zod';
import { ConfigurationError } from './index.js';
const optional = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional());
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PUBLIC_ORIGIN: z.string().url(),
  ADMIN_ORIGIN: z.string().url(),
  API_CURSOR_SECRET: z.string().min(32).max(256),
  API_SESSION_SECRET: z.string().min(32).max(256),
  SOURCE_TRUST_KEYS_FILE: optional,
  AUTH_ISSUER: optional,
  AUTH_CLIENT_ID: optional,
  AUTH_CLIENT_SECRET: optional,
  AUTH_REDIRECT_URI: optional,
  AUTH_ALLOWED_ORIGINS: optional,
  AUTH_STATE_KEY: optional,
  AUTH_ALLOW_HTTP_LOOPBACK: z.enum(['true', 'false']).default('false'),
});
export type ApiEnvironment = z.infer<typeof schema>;
export function parseApiEnvironment(input: Record<string, unknown>): ApiEnvironment {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new ConfigurationError([...new Set(parsed.error.issues.map((i) => String(i.path[0])))]);
  const env = parsed.data;
  const bad: string[] = [];
  const origin = (name: 'API_PUBLIC_ORIGIN' | 'ADMIN_ORIGIN') => {
    const u = new URL(env[name]);
    if (
      u.origin !== env[name] ||
      u.username ||
      u.password ||
      !['https:', 'http:'].includes(u.protocol) ||
      (u.protocol === 'http:' &&
        (env.NODE_ENV === 'production' ||
          !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)))
    )
      bad.push(name);
  };
  origin('API_PUBLIC_ORIGIN');
  origin('ADMIN_ORIGIN');
  const fields = [
    'AUTH_ISSUER',
    'AUTH_CLIENT_ID',
    'AUTH_CLIENT_SECRET',
    'AUTH_REDIRECT_URI',
    'AUTH_ALLOWED_ORIGINS',
    'AUTH_STATE_KEY',
  ] as const;
  if (fields.some((k) => env[k]) && fields.some((k) => !env[k]))
    bad.push(...fields.filter((k) => !env[k]));
  if (env.AUTH_ISSUER) {
    try {
      const allowed = env.AUTH_ALLOWED_ORIGINS?.split(',').map((v) => v.trim()) ?? [];
      for (const address of [env.AUTH_ISSUER, ...allowed]) {
        const u = new URL(address);
        if (
          u.username ||
          u.password ||
          u.hash ||
          u.search ||
          !['https:', 'http:'].includes(u.protocol) ||
          (u.protocol === 'http:' &&
            (env.NODE_ENV === 'production' ||
              env.AUTH_ALLOW_HTTP_LOOPBACK !== 'true' ||
              !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)))
        )
          bad.push('AUTH_ISSUER');
      }
      if (
        allowed.some((v) => new URL(v).origin !== v) ||
        !allowed.includes(new URL(env.AUTH_ISSUER).origin)
      )
        bad.push('AUTH_ALLOWED_ORIGINS');
      if (env.AUTH_REDIRECT_URI !== `${env.API_PUBLIC_ORIGIN}/v1/admin/auth/callback`)
        bad.push('AUTH_REDIRECT_URI');
      if (!/^[a-f0-9]{64}$/.test(env.AUTH_STATE_KEY ?? '')) bad.push('AUTH_STATE_KEY');
    } catch {
      bad.push('AUTH_ISSUER');
    }
  }
  if (env.NODE_ENV === 'production' && !env.SOURCE_TRUST_KEYS_FILE)
    bad.push('SOURCE_TRUST_KEYS_FILE');
  if (env.NODE_ENV === 'production' && !env.AUTH_ISSUER) bad.push('AUTH_ISSUER');
  if (env.API_CURSOR_SECRET === env.API_SESSION_SECRET) bad.push('API_SESSION_SECRET');
  if (env.NODE_ENV === 'production') {
    for (const key of ['API_CURSOR_SECRET', 'API_SESSION_SECRET'] as const)
      if (/REPLACE|SYNTHETIC|^(.)\1+$/i.test(env[key])) bad.push(key);
    if (env.AUTH_STATE_KEY && /^(.)\1+$/.test(env.AUTH_STATE_KEY)) bad.push('AUTH_STATE_KEY');
  }
  if (bad.length) throw new ConfigurationError([...new Set(bad)]);
  return env;
}
