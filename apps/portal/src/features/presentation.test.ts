import { expect, it } from 'vitest';
import { factText, locale, unknown } from './presentation.js';
import { safeLink, settings } from '../lib/settings.js';
it('keeps unknown/conflicting states distinct and rejects active/credential URLs', () => {
  expect(factText({ status: 'not_stated' }, 'en')).toBe('Not stated in notice');
  expect(unknown('conflicting', 'en')).toBe('Conflicting information');
  expect(unknown('closed', 'bn')).toBe('আবেদন বন্ধ');
  expect(locale('ar')).toBe('bn');
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,test',
    'https://user:password@example.org',
  ])
    expect(safeLink(url)).toBeNull();
  expect(safeLink('https://notices.example/apply')).toBe('https://notices.example/apply');
  expect(() => settings({ PORTAL_API_ORIGIN: 'https://api.example/path' })).toThrow();
  expect(() => settings({ PORTAL_HOME_URL: 'http://example.org' })).toThrow();
  expect(() =>
    settings({
      PORTAL_PREPARATION_LINKS:
        '[{"category":"bank","label":"Test","url":"https://evil.example/"}]',
    }),
  ).toThrow();
  expect(
    settings({
      PORTAL_PREPARATION_LINKS:
        '[{"category":"SYNTHETIC","label":"SYNTHETIC","url":"https://uttirno.org/"}]',
    }).preparation,
  ).toHaveLength(1);
});
