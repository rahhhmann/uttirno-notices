import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
const payload = z.strictObject({
  v: z.literal(1),
  scope: z.string().max(200),
  filter: z.string().length(64),
  after: z.string().min(1).max(200),
  asOf: z.iso.datetime(),
  expires: z.number().int(),
});
export class CursorError extends Error {
  constructor() {
    super('INVALID_CURSOR');
  }
}
export class CursorCodec {
  constructor(private readonly secret: string) {
    if (secret.length < 32) throw new Error('CURSOR_SECRET_REQUIRED');
  }
  fingerprint(filters: unknown) {
    return createHash('sha256').update(JSON.stringify(filters)).digest('hex');
  }
  encode(scope: string, filter: string, after: string, asOf: string) {
    const body = Buffer.from(
      JSON.stringify({ v: 1, scope, filter, after, asOf, expires: Date.now() + 900000 }),
    ).toString('base64url');
    return `${body}.${createHmac('sha256', this.secret).update(body).digest('base64url')}`;
  }
  decode(value: string, scope: string, filter: string) {
    try {
      if (value.length > 3000) throw new Error();
      const [body, signature, extra] = value.split('.');
      if (!body || !signature || extra) throw new Error();
      const expected = createHmac('sha256', this.secret).update(body).digest('base64url');
      if (
        signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      )
        throw new Error();
      const parsed = payload.parse(JSON.parse(Buffer.from(body, 'base64url').toString()));
      if (parsed.scope !== scope || parsed.filter !== filter || parsed.expires < Date.now())
        throw new Error();
      return parsed;
    } catch {
      throw new CursorError();
    }
  }
}
