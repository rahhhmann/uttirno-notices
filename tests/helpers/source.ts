// SYNTHETIC: ephemeral test approvals for reserved example domains; never real source authorization.
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  SourceConfigSchema,
  canonical,
  type SourceConfig,
  type SignedSource,
} from '@uttirno/source-config';
import { HostLimiter } from '../../apps/agent/src/fetch/limiter.js';
export const testNow = new Date('2026-11-03T00:00:00.000Z');
export function syntheticSource(overrides: Record<string, unknown> = {}) {
  const keys = generateKeyPairSync('ed25519');
  const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const config = SourceConfigSchema.parse({
    schemaVersion: 1,
    id: 'synthetic-source',
    version: 1,
    authority: 'SYNTHETIC authority',
    sourceClass: 'government_authority',
    state: 'active',
    ownershipEvidence: [{ url: 'https://notices.example/about', note: 'SYNTHETIC fixture only' }],
    collection: 'permitted_public',
    display: 'permission_pending',
    policyEvidence: [{ url: 'https://notices.example/terms', note: 'SYNTHETIC test policy' }],
    adapterSamples: [
      {
        sha256: 'a'.repeat(64),
        expectedCandidates: 1,
        checkedBy: 'synthetic-reviewer',
        checkedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    reviewedBy: 'synthetic-reviewer',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
    origins: [
      { origin: 'https://notices.example', paths: [{ prefix: '/', queryKeys: ['page', 'jobId'] }] },
    ],
    seeds: ['https://notices.example/list'],
    adapter: {
      kind: 'html',
      items: '.job',
      title: 'h2',
      detailLink: 'a.more',
      fields: [],
      minItems: 1,
      maxItems: 200,
    },
    robots: { missingReviewed: false, maxAgeSeconds: 3600 },
    limits: {},
    ...overrides,
  });
  const resign = (c: SourceConfig): SignedSource => ({
    config: c,
    approval: {
      keyId: 'synthetic-key',
      signature: sign(null, Buffer.from(canonical(c)), keys.privateKey).toString('base64'),
    },
  });
  return { config, bundle: resign(config), trust: { 'synthetic-key': publicKey }, resign };
}
export function instantLimiter() {
  let clock = 0;
  return new HostLimiter(
    () => clock,
    async (ms) => {
      clock += ms;
    },
  );
}
