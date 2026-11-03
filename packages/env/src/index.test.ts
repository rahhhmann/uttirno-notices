import { it, expect } from 'vitest';
import { parseServerEnvironment, ConfigurationError } from './index.js';
const base = {
  DATABASE_URL: 'postgresql://synthetic:password@localhost:55432/test',
  REDIS_URL: 'redis://localhost:56379',
  S3_ENDPOINT: 'http://localhost:54566',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'synthetic-test',
  S3_ACCESS_KEY_ID: 'test',
  S3_SECRET_ACCESS_KEY: 'test',
};
it('AI key is optional for deterministic development', () => {
  expect(
    parseServerEnvironment({ ...base, LLM_PROVIDER: '', LLM_API_KEY: '', LLM_MODEL: '' })
      .LLM_PROVIDER,
  ).toBeUndefined();
});
it('selected AI provider requires key and model', () => {
  expect(() => parseServerEnvironment({ ...base, LLM_PROVIDER: 'openai' })).toThrow(
    ConfigurationError,
  );
});
it('fails deterministically without disclosing secret values', () => {
  try {
    parseServerEnvironment({ ...base, DATABASE_URL: 'private-secret' });
    throw new Error('expected rejection');
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigurationError);
    expect(String(e)).toContain('DATABASE_URL');
    expect(String(e)).not.toContain('private-secret');
  }
});
it.each(['https://localhost/db', 'file:///database'])(
  'rejects invalid DB scheme %s',
  (DATABASE_URL) => {
    expect(() => parseServerEnvironment({ ...base, DATABASE_URL })).toThrow(ConfigurationError);
  },
);
it('rejects invalid port and plaintext production storage', () => {
  expect(() => parseServerEnvironment({ ...base, PORT: 0 })).toThrow();
  expect(() => parseServerEnvironment({ ...base, NODE_ENV: 'production' })).toThrow();
});
