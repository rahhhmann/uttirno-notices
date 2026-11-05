import { it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { validateRelease } from './release-preflight.mjs';
it('R29 release preflight rejects mutable image tags', () => {
  expect(() => validateRelease({}, {}, {}, ['repo/app:latest'])).toThrow(
    'IMMUTABLE_IMAGE_REQUIRED',
  );
});
it('R24 preflight requires distinct DB identities and reports syntax validation separately from live verification', () => {
  const worker = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://worker:fixture@db.example/uttirno?sslmode=verify-full',
    REDIS_URL: 'rediss://redis.example',
    S3_ENDPOINT: 'https://objects.example',
    S3_REGION: 'test',
    S3_BUCKET: 'synthetic-fixture',
    S3_ACCESS_KEY_ID: 'fixture',
    S3_SECRET_ACCESS_KEY: 'fixture',
  };
  const api = {
    ...worker,
    DATABASE_URL: 'postgresql://api:fixture@db.example/uttirno?sslmode=verify-full',
    API_PUBLIC_ORIGIN: 'https://staff.example',
    ADMIN_ORIGIN: 'https://staff.example',
    API_CURSOR_SECRET: randomBytes(32).toString('hex'),
    API_SESSION_SECRET: randomBytes(32).toString('hex'),
    SOURCE_TRUST_KEYS_FILE: '/private/trust.json',
    AUTH_ISSUER: 'https://issuer.example',
    AUTH_CLIENT_ID: 'fixture',
    AUTH_CLIENT_SECRET: 'fixture',
    AUTH_REDIRECT_URI: 'https://staff.example/v1/admin/auth/callback',
    AUTH_ALLOWED_ORIGINS: 'https://issuer.example',
    AUTH_STATE_KEY: randomBytes(32).toString('hex'),
    OPERATIONS_TOKEN: randomBytes(32).toString('hex'),
  };
  const images = [
    `registry.example/app@sha256:${'a'.repeat(64)}`,
    `registry.example/parser@sha256:${'b'.repeat(64)}`,
  ];
  expect(() => validateRelease(api, worker, api, images)).toThrow(
    'SEPARATE_DATABASE_CREDENTIALS_REQUIRED',
  );
  expect(
    validateRelease(
      api,
      worker,
      { DATABASE_URL: 'postgresql://owner:fixture@db.example/uttirno?sslmode=verify-full' },
      images,
    ),
  ).toMatchObject({ configurationValid: true, liveDeploymentVerified: false });
});
