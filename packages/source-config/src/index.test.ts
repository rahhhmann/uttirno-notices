import { describe, it, expect } from 'vitest';
import { syntheticSource, testNow } from '../../../tests/helpers/source.js';
import {
  SourceConfigSchema,
  authorizeSource,
  assertSourceUrl,
  configFingerprint,
} from './index.js';
describe('R01/R02 signed official-source gates', () => {
  it('a source proposal cannot override the global marketplace exclusion', () => {
    const s = syntheticSource();
    for (const origin of ['https://bdjobs.com', 'https://jobs.bdjobs.com'])
      expect(
        SourceConfigSchema.safeParse({
          ...s.config,
          origins: [{ origin, paths: [{ prefix: '/' }] }],
          seeds: [`${origin}/jobs`],
        }).success,
      ).toBe(false);
  });
  it('cannot activate without recorded adapter fixture verification', () => {
    const s = syntheticSource();
    expect(SourceConfigSchema.safeParse({ ...s.config, adapterSamples: [] }).success).toBe(false);
  });
  it('accepts a trusted signed source without granting display permission', () => {
    const s = syntheticSource();
    expect(authorizeSource(s.bundle, s.trust, testNow).id).toBe(s.config.id);
    expect(() => authorizeSource(s.bundle, s.trust, testNow, 'display')).toThrow(
      'DISPLAY_NOT_PERMITTED',
    );
  });
  it('an official-looking suffix or approval fields alone never authorize', () => {
    const s = syntheticSource();
    expect(() => authorizeSource({ config: s.config }, s.trust, testNow)).toThrow(
      'UNTRUSTED_APPROVAL',
    );
    expect(
      SourceConfigSchema.safeParse({ ...s.config, sourceClass: 'private_portal' }).success,
    ).toBe(false);
  });
  it('rejects unknown keys and tampered config versions/selectors', () => {
    const s = syntheticSource();
    expect(() => authorizeSource(s.bundle, {}, testNow)).toThrow('UNTRUSTED_APPROVAL');
    expect(() =>
      authorizeSource({ ...s.bundle, config: { ...s.config, version: 2 } }, s.trust, testNow),
    ).toThrow('INVALID_APPROVAL_SIGNATURE');
  });
  it.each(['candidate', 'paused', 'disabled'] as const)('blocks signed %s sources', (state) => {
    const s = syntheticSource({ state });
    expect(() => authorizeSource(s.bundle, s.trust, testNow)).toThrow('SOURCE_NOT_ACTIVE');
  });
  it.each(['unknown', 'permission_pending', 'manual_only', 'blocked', 'revoked'] as const)(
    'cannot activate collection=%s',
    (collection) => {
      const s = syntheticSource();
      expect(SourceConfigSchema.safeParse({ ...s.config, collection }).success).toBe(false);
    },
  );
  it.each([{ expiresAt: '2026-10-01T00:00:00.000Z' }, { reviewedAt: '2026-11-04T00:00:00.000Z' }])(
    'rejects expired or future policy',
    (change) => {
      const s = syntheticSource(change);
      expect(() => authorizeSource(s.bundle, s.trust, testNow)).toThrow('POLICY_EXPIRED_OR_FUTURE');
    },
  );
  it('configuration fingerprint is stable and no executable transforms pass', () => {
    const s = syntheticSource();
    expect(configFingerprint({ ...s.config })).toBe(configFingerprint(s.config));
    expect(
      SourceConfigSchema.safeParse({
        ...s.config,
        adapter: { ...s.config.adapter, script: 'fetch(secret)' },
      }).success,
    ).toBe(false);
  });
});
describe('R03 exact URL scope', () => {
  it('malformed origin/seed values return validation failure instead of throwing raw input errors', () => {
    const s = syntheticSource();
    expect(
      SourceConfigSchema.safeParse({
        ...s.config,
        origins: [{ origin: 'secret-invalid-url', paths: [{ prefix: '/' }] }],
      }).success,
    ).toBe(false);
    expect(
      SourceConfigSchema.safeParse({ ...s.config, seeds: ['secret-invalid-url'] }).success,
    ).toBe(false);
  });
  it.each([
    'https://notices.example.evil.com/list',
    'https://user:secret@notices.example/list',
    'https://notices.example:444/list',
    'http://notices.example/list',
    'https://127.0.0.1/list',
    'https://notices.example/list#fragment',
    'https://notices.example/list?token=private',
    'https://notices.example/%252e%252e/private',
  ])('rejects %s', (url) => {
    expect(() => assertSourceUrl(syntheticSource().config, url)).toThrow();
  });
  it('requires reviewed HTTP exceptions and rejects wildcard/IP origins', () => {
    const s = syntheticSource();
    for (const origin of ['https://*.example', 'http://notices.example', 'https://127.0.0.1']) {
      expect(
        SourceConfigSchema.safeParse({
          ...s.config,
          origins: [{ origin, paths: [{ prefix: '/', queryKeys: [] }] }],
          seeds: [`${origin}/list`],
        }).success,
      ).toBe(false);
    }
  });
});
