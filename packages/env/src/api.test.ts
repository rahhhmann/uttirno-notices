import { it, expect } from 'vitest';
import { parseApiEnvironment } from './api.js';
const base = {
  API_PUBLIC_ORIGIN: 'http://127.0.0.1:4000',
  ADMIN_ORIGIN: 'http://127.0.0.1:3001',
  API_CURSOR_SECRET: 'SYNTHETIC-cursor-'.repeat(3),
  API_SESSION_SECRET: 'SYNTHETIC-session-'.repeat(3),
};
it('R18 no accidental credential-bearing errors or incomplete/unsafe OIDC configuration', () => {
  expect(parseApiEnvironment(base).AUTH_ISSUER).toBeUndefined();
  expect(() =>
    parseApiEnvironment({
      ...base,
      AUTH_ISSUER: 'https://id.example',
      AUTH_CLIENT_SECRET: 'private-secret',
    }),
  ).toThrow();
  try {
    parseApiEnvironment({
      ...base,
      AUTH_ISSUER: 'https://id.example',
      AUTH_CLIENT_SECRET: 'private-secret',
    });
  } catch (error) {
    expect(String(error)).not.toContain('private-secret');
  }
  expect(() =>
    parseApiEnvironment({ ...base, API_SESSION_SECRET: base.API_CURSOR_SECRET }),
  ).toThrow();
  expect(() => parseApiEnvironment({ ...base, ADMIN_ORIGIN: 'http://evil.example' })).toThrow();
  expect(() => parseApiEnvironment({ ...base, NODE_ENV: 'production' })).toThrow();
});
