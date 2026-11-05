import { expect, it } from 'vitest';
import { apiOrigin, publicSettings } from './settings.js';
it('M6 host configuration rejects path injection, credentials and remote plaintext origins', () => {
  expect(apiOrigin('http://127.0.0.1:4000')).toBe('http://127.0.0.1:4000');
  for (const url of [
    'http://evil.example',
    'https://api.example/path',
    'https://user:password@api.example',
    'https://api.example?target=evil',
  ])
    expect(() => apiOrigin(url)).toThrow('INVALID_ADMIN_API_ORIGIN');
  expect(() => publicSettings({ ADMIN_HOME_URL: 'javascript:alert(1)' })).toThrow();
  expect(
    publicSettings({ ADMIN_BRAND_NAME: 'Configured brand', ADMIN_HOME_URL: 'https://uttirno.org/' })
      .brand,
  ).toBe('Configured brand');
});
