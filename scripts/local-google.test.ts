import { expect, it } from 'vitest';
import { googleLocalEnvironment } from './local-google.mjs';
const client = () => ({
  web: {
    client_id: '123-SYNTHETIC.apps.googleusercontent.com',
    client_secret: 'SYNTHETIC-not-real',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    redirect_uris: ['http://localhost:4000/v1/admin/auth/callback'],
  },
});
it('prepares exact local callback and independent state keys without accepting substituted endpoints', () => {
  const first = googleLocalEnvironment(client());
  expect(first).toContain('API_PUBLIC_ORIGIN=http://localhost:4000\n');
  expect(first).toContain('AUTH_REDIRECT_URI=http://localhost:4000/v1/admin/auth/callback\n');
  expect(first).toMatch(/AUTH_STATE_KEY=[a-f0-9]{64}\n/);
  expect(first).not.toEqual(googleLocalEnvironment(client()));
  for (const change of [
    { token_uri: 'https://attacker.example/token' },
    { auth_uri: 'https://attacker.example/authorize' },
    { client_secret: 'secret\nSOURCE_TRUST_KEYS_FILE=attacker' },
    { redirect_uris: ['http://127.0.0.1:4000/v1/admin/auth/callback'] },
  ])
    expect(() => googleLocalEnvironment({ web: { ...client().web, ...change } })).toThrow();
  expect(() => googleLocalEnvironment({ installed: client().web })).toThrow();
});
