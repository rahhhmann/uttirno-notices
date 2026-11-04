// SYNTHETIC provider and staff. No live sources or production identities.
import { expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { withSessionAuthorization } from '@uttirno/database';
import { m5Context } from '../helpers/m5.js';
it('R18 role matrix, expired sessions, strict mutations, encrypted state and last-admin protection', async () => {
  const c = await m5Context();
  try {
    const op = await c.session('operator-sub'),
      reviewer = await c.session('reviewer-sub'),
      approver = await c.session('approver-sub'),
      admin = await c.session('admin-sub');
    for (const session of [op, reviewer, approver]) {
      expect(
        (await c.app.inject({ url: '/v1/admin/audit', headers: { cookie: session.cookie } }))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await c.post(session, '/v1/admin/identities', {
            actorId: 'intruder',
            issuer: c.provider.issuer,
            subject: 'intruder',
            roles: ['administrator'],
            reason: 'SYNTHETIC forbidden',
          })
        ).statusCode,
      ).toBe(403);
    }
    expect(
      (await c.app.inject({ url: '/v1/admin/audit', headers: { cookie: admin.cookie } }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await c.post(admin, '/v1/admin/identities/administrator/disable', {
          reason: 'SYNTHETIC last-admin',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await c.post(op, `/v1/admin/sources/${c.source.config.id}/runs`, {
          reason: 'SYNTHETIC spoof',
          actor: 'administrator',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await c.app.inject({
          method: 'POST',
          url: `/v1/admin/sources/${c.source.config.id}/runs`,
          payload: { reason: 'SYNTHETIC missing-key' },
          headers: { cookie: op.cookie, origin: c.env.ADMIN_ORIGIN, 'x-csrf-token': op.csrf },
        })
      ).statusCode,
    ).toBe(400);
    const begin = await c.app.inject('/v1/admin/auth/login');
    const authorization = new URL(String(begin.headers.location));
    const row = (
      await c.database.pool.query(
        'SELECT * FROM login_transactions ORDER BY expires_at DESC LIMIT 1',
      )
    ).rows[0];
    expect(row.encrypted_payload).not.toContain(authorization.searchParams.get('nonce'));
    expect(row.encrypted_payload).not.toContain('codeVerifier');
    const authorized = await fetch(authorization, { redirect: 'manual' }),
      callback = new URL(authorized.headers.get('location') ?? '');
    expect(
      (
        await c.app.inject({
          url: callback.pathname + callback.search,
          headers: { cookie: `uttirno_dev_login=${'x'.repeat(43)}` },
        })
      ).statusCode,
    ).toBe(401);
    const hash = createHash('sha256')
      .update(op.cookie.split('=')[1] ?? '')
      .digest('hex');
    await c.database.pool.query(
      "UPDATE admin_sessions SET idle_expires_at=clock_timestamp()-interval '1 second' WHERE token_hash=$1",
      [hash],
    );
    expect(
      (await c.app.inject({ url: '/v1/admin/session', headers: { cookie: op.cookie } })).statusCode,
    ).toBe(401);
    await c.database.pool.query(
      "UPDATE admin_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE actor_id='reviewer'",
    );
    expect(
      (await c.app.inject({ url: '/v1/admin/session', headers: { cookie: reviewer.cookie } }))
        .statusCode,
    ).toBe(401);
    await c.database.pool.query("DELETE FROM admin_roles WHERE actor_id='approver'");
    expect(
      (await c.app.inject({ url: '/v1/admin/session', headers: { cookie: approver.cookie } }))
        .statusCode,
    ).toBe(401);
  } finally {
    await c.close();
  }
}, 60000);

it('R18 revoked sessions cannot execute or replay a previously authorized write', async () => {
  const c = await m5Context();
  try {
    const op = await c.session('operator-sub');
    const hash = c.tokenHash(op.cookie.split('=')[1] ?? '');
    const key = randomUUID();
    let writes = 0;
    const action = () =>
      withSessionAuthorization(op.actorId, hash, () =>
        c.identity.idempotent(op.actorId, ['operator'], key, { synthetic: true }, async () => {
          writes++;
          return { ok: true };
        }),
      );
    expect(await action()).toEqual({ ok: true });
    expect(await action()).toEqual({ ok: true });
    expect(writes).toBe(1);
    await c.identity.revoke(op.actorId, hash);
    await expect(action()).rejects.toThrow('SESSION_EXPIRED');
    expect(writes).toBe(1);
  } finally {
    await c.close();
  }
}, 60000);
