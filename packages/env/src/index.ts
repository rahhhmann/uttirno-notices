import { z } from 'zod';
export { parseApiEnvironment, type ApiEnvironment } from './api.js';
import { fileURLToPath } from 'node:url';
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optionalText = z.preprocess(blankToUndefined, z.string().trim().min(1).optional());
function url(protocols: string[]) {
  return z
    .string()
    .url()
    .refine((v) => {
      try {
        return protocols.includes(new URL(v).protocol);
      } catch {
        return false;
      }
    }, 'Unsupported protocol');
}
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: url(['postgres:', 'postgresql:']),
  REDIS_URL: url(['redis:', 'rediss:']),
  S3_ENDPOINT: url(['http:', 'https:']),
  S3_REGION: z.string().trim().min(1),
  S3_BUCKET: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  S3_ACCESS_KEY_ID: z.string().trim().min(1),
  S3_SECRET_ACCESS_KEY: z.string().trim().min(1),
  LLM_PROVIDER: z.preprocess(blankToUndefined, z.enum(['openai', 'anthropic']).optional()),
  LLM_API_KEY: optionalText,
  LLM_MODEL: optionalText,
});
export type ServerEnvironment = z.infer<typeof serverSchema>;
export class ConfigurationError extends Error {
  constructor(readonly fields: readonly string[]) {
    super(`Invalid server configuration: ${fields.join(', ')}`);
    this.name = 'ConfigurationError';
  }
}
export function parseServerEnvironment(input: Record<string, unknown>): ServerEnvironment {
  const result = serverSchema.safeParse(input);
  if (!result.success)
    throw new ConfigurationError([
      ...new Set(result.error.issues.map((i) => String(i.path[0] ?? 'environment'))),
    ]);
  const env = result.data;
  if (env.LLM_PROVIDER && (!env.LLM_API_KEY || !env.LLM_MODEL))
    throw new ConfigurationError(['LLM_API_KEY', 'LLM_MODEL']);
  if (!env.LLM_PROVIDER && (env.LLM_API_KEY || env.LLM_MODEL))
    throw new ConfigurationError(['LLM_PROVIDER']);
  if (env.NODE_ENV === 'production' && new URL(env.S3_ENDPOINT).protocol !== 'https:')
    throw new ConfigurationError(['S3_ENDPOINT']);
  return env;
}
export function loadServerEnvironment(): ServerEnvironment {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)));
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
      throw new ConfigurationError(['ENV_FILE']);
  }
  return parseServerEnvironment(process.env);
}
