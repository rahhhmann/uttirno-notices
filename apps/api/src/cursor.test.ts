import { expect, it, vi } from 'vitest';
import { CursorCodec } from './cursor.js';
it('R20 cursors reject tampering, different filters/scopes and expiry', () => {
  const codec = new CursorCodec('SYNTHETIC-secret-'.repeat(3));
  const filter = codec.fingerprint({ q: 'বাংলা', limit: 1 });
  const token = codec.encode('jobs', filter, 'synthetic-id', '2026-11-04T00:00:00.000Z');
  expect(codec.decode(token, 'jobs', filter).after).toBe('synthetic-id');
  expect(() => codec.decode(`${token}x`, 'jobs', filter)).toThrow('INVALID_CURSOR');
  expect(() => codec.decode(token, 'admin', filter)).toThrow('INVALID_CURSOR');
  expect(() => codec.decode(token, 'jobs', codec.fingerprint({ q: 'other' }))).toThrow(
    'INVALID_CURSOR',
  );
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 900001);
  expect(() => codec.decode(token, 'jobs', filter)).toThrow('INVALID_CURSOR');
});
