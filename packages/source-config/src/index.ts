import { createHash, createPublicKey, verify } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import sourceScope from './source-scope.json' with { type: 'json' };
function deniedDomain(hostname: string): boolean {
  return sourceScope.deniedDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

export class SourcePolicyError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'SourcePolicyError';
  }
}
const text = z.string().trim().min(1).max(1000);
const selector = z.string().trim().min(1).max(300);
const proof = z.strictObject({ url: z.string().url(), note: text });
const mapping = z.strictObject({
  name: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/),
  selector,
  attribute: z.enum(['href', 'src', 'datetime', 'content', 'data-id']).optional(),
  transforms: z
    .array(z.enum(['trim', 'collapse_whitespace', 'bangla_digits']))
    .max(5)
    .default(['trim']),
  required: z.boolean().default(false),
});
const htmlAdapter = z.strictObject({
  kind: z.literal('html'),
  items: selector,
  title: selector,
  detailLink: selector.optional(),
  attachments: selector.optional(),
  siblings: selector.optional(),
  next: selector.optional(),
  fields: z.array(mapping).max(30).default([]),
  minItems: z.number().int().min(0).max(1000).default(1),
  maxItems: z.number().int().min(1).max(1000).default(200),
});
const pointer = z
  .string()
  .max(300)
  .refine((v) => v === '' || /^\/(?:[^~]|~[01])*$/.test(v), 'Invalid JSON pointer');
const jsonAdapter = z.strictObject({
  kind: z.literal('json'),
  items: pointer,
  title: pointer,
  detailLink: pointer.optional(),
  attachments: pointer.optional(),
  next: pointer.optional(),
  minItems: z.number().int().min(0).max(1000).default(1),
  maxItems: z.number().int().min(1).max(1000).default(200),
});
export const AdapterSchema = z.discriminatedUnion('kind', [htmlAdapter, jsonAdapter]);
export type AdapterConfig = z.infer<typeof AdapterSchema>;
const originRule = z.strictObject({
  origin: z.string().url(),
  legacyHttpReason: text.optional(),
  paths: z
    .array(
      z.strictObject({
        prefix: z.string().startsWith('/').max(300),
        queryKeys: z.array(z.string().max(100)).max(30).default([]),
      }),
    )
    .min(1)
    .max(30),
});
export const SourceConfigSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
    version: z.number().int().min(1),
    authority: text,
    sourceClass: z.enum([
      'government_authority',
      'public_institution',
      'designated_application_platform',
    ]),
    state: z.enum(['candidate', 'active', 'paused', 'disabled']),
    ownershipEvidence: z.array(proof).min(1).max(20),
    collection: z.enum([
      'unknown',
      'permitted_public',
      'approved_api',
      'permission_pending',
      'manual_only',
      'blocked',
      'revoked',
    ]),
    display: z.enum([
      'unknown',
      'permitted',
      'link_only',
      'permission_pending',
      'blocked',
      'revoked',
    ]),
    policyEvidence: z.array(proof).max(20),
    adapterSamples: z
      .array(
        z.strictObject({
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
          expectedCandidates: z.number().int().min(0).max(1000),
          checkedBy: text,
          checkedAt: z.iso.datetime(),
        }),
      )
      .max(30)
      .default([]),
    reviewedBy: text,
    reviewedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    origins: z.array(originRule).min(1).max(20),
    seeds: z.array(z.string().url()).min(1).max(10),
    adapter: AdapterSchema,
    detailAdapter: AdapterSchema.optional(),
    render: z.strictObject({ readySelector: selector }).optional(),
    robots: z.strictObject({
      missingReviewed: z.boolean().default(false),
      maxAgeSeconds: z.number().int().min(0).max(86400).default(3600),
    }),
    limits: z.strictObject({
      intervalMs: z.number().int().min(4000).max(60000).default(4000),
      timeoutMs: z.number().int().min(100).max(30000).default(10000),
      maxBytes: z.number().int().min(128).max(10485760).default(2097152),
      maxTotalBytes: z.number().int().min(128).max(104857600).default(20971520),
      maxRequests: z.number().int().min(1).max(500).default(50),
      maxPages: z.number().int().min(1).max(100).default(20),
      maxRedirects: z.number().int().min(0).max(5).default(3),
      retries: z.number().int().min(0).max(2).default(1),
    }),
  })
  .superRefine((c, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (Date.parse(c.expiresAt) <= Date.parse(c.reviewedAt)) fail('Invalid review expiry');
    const seen = new Set<string>();
    for (const rule of c.origins) {
      let u: URL;
      try {
        u = new URL(rule.origin);
      } catch {
        fail('Invalid exact origin');
        continue;
      }
      if (
        u.origin !== rule.origin ||
        u.username ||
        u.password ||
        u.hostname.includes('*') ||
        deniedDomain(u.hostname) ||
        isIP(u.hostname.replace(/^\[|\]$/g, '')) ||
        u.hostname.endsWith('.') ||
        u.port ||
        !['https:', 'http:'].includes(u.protocol)
      )
        fail('Invalid exact origin');
      if (u.protocol === 'http:' && !rule.legacyHttpReason)
        fail('HTTP requires reviewed exception');
      if (seen.has(rule.origin)) fail('Duplicate origin');
      seen.add(rule.origin);
    }
    for (const seed of c.seeds) {
      try {
        if (!c.origins.some((o) => o.origin === new URL(seed).origin)) fail('Seed outside origins');
      } catch {
        fail('Invalid seed URL');
      }
    }
    if (
      c.state === 'active' &&
      (!c.policyEvidence.length ||
        !c.adapterSamples.length ||
        !['permitted_public', 'approved_api'].includes(c.collection))
    )
      fail('Active source has no collection approval');
  });
export type SourceConfig = z.infer<typeof SourceConfigSchema>;
export const SignedSourceSchema = z.strictObject({
  config: SourceConfigSchema,
  approval: z
    .strictObject({ keyId: text, signature: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/) })
    .optional(),
});
export type SignedSource = z.infer<typeof SignedSourceSchema>;
export type TrustKeys = Readonly<Record<string, string>>;
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return (
    '{' +
    Object.keys(record)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(record[k])}`)
      .join(',') +
    '}'
  );
}
export function configFingerprint(config: SourceConfig): string {
  return createHash('sha256').update(canonical(config)).digest('hex');
}
export function authorizeSource(
  input: unknown,
  keys: TrustKeys,
  now = new Date(),
  purpose: 'collection' | 'display' = 'collection',
): SourceConfig {
  if (!Number.isFinite(now.getTime())) throw new SourcePolicyError('INVALID_POLICY_TIME');
  const parsed = SignedSourceSchema.safeParse(input);
  if (!parsed.success) throw new SourcePolicyError('INVALID_SOURCE_CONFIG');
  const { config, approval } = parsed.data;
  if (!approval || !Object.hasOwn(keys, approval.keyId))
    throw new SourcePolicyError('UNTRUSTED_APPROVAL');
  try {
    const key = createPublicKey(keys[approval.keyId] ?? '');
    if (
      key.asymmetricKeyType !== 'ed25519' ||
      !verify(null, Buffer.from(canonical(config)), key, Buffer.from(approval.signature, 'base64'))
    )
      throw new Error('Invalid signature');
  } catch {
    throw new SourcePolicyError('INVALID_APPROVAL_SIGNATURE');
  }
  if (
    Date.parse(config.reviewedAt) > now.getTime() ||
    Date.parse(config.expiresAt) <= now.getTime()
  )
    throw new SourcePolicyError('POLICY_EXPIRED_OR_FUTURE');
  if (config.state !== 'active') throw new SourcePolicyError('SOURCE_NOT_ACTIVE');
  if (purpose === 'collection' && !['permitted_public', 'approved_api'].includes(config.collection))
    throw new SourcePolicyError('COLLECTION_NOT_PERMITTED');
  if (purpose === 'display' && !['permitted', 'link_only'].includes(config.display))
    throw new SourcePolicyError('DISPLAY_NOT_PERMITTED');
  return config;
}
export function assertSourceUrl(config: SourceConfig, input: string, robotsOnly = false): URL {
  if (input.length > 4096) throw new SourcePolicyError('URL_TOO_LONG');
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new SourcePolicyError('INVALID_URL');
  }
  if (deniedDomain(u.hostname)) throw new SourcePolicyError('EXCLUDED_SOURCE_DOMAIN');
  if (
    u.username ||
    u.password ||
    u.hash ||
    u.hostname.endsWith('.') ||
    isIP(u.hostname.replace(/^\[|\]$/g, ''))
  )
    throw new SourcePolicyError('UNSAFE_URL');
  const rule = config.origins.find((o) => o.origin === u.origin);
  if (!rule) throw new SourcePolicyError('ORIGIN_NOT_APPROVED');
  if (robotsOnly) {
    if (u.pathname !== '/robots.txt' || u.search) throw new SourcePolicyError('INVALID_ROBOTS_URL');
    return u;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(u.pathname);
  } catch {
    throw new SourcePolicyError('INVALID_PATH_ENCODING');
  }
  if (
    decoded.includes('%') ||
    decoded.includes('\\') ||
    decoded.split('/').some((p) => p === '..' || p === '.')
  )
    throw new SourcePolicyError('UNSAFE_PATH');
  const matched = rule.paths.some(
    (p) =>
      (decoded === p.prefix || (p.prefix.endsWith('/') && decoded.startsWith(p.prefix))) &&
      [...u.searchParams.keys()].every((k) => p.queryKeys.includes(k)),
  );
  if (!matched) throw new SourcePolicyError('PATH_NOT_APPROVED');
  return u;
}
