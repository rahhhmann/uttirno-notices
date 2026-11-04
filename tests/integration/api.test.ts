// SYNTHETIC authorities, staff and OIDC accounts. Actual Fastify/HTTP, signed OIDC protocol and PostgreSQL transactions.
import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PublicApiClient, AdminApiClient } from '@uttirno/api-client';
import { m5Context } from '../helpers/m5.js';
it('R18 actual OIDC signature/state/nonce/PKCE flow binds issuer+subject to DB roles and opaque sessions', async () => {
  const c = await m5Context();
  try {
    const operator = await c.session('operator-sub');
    expect(operator.actorId).toBe('operator');
    expect(operator.roles).toEqual(['operator']);
    expect(c.provider.requests).toContain('/jwks');
    const session = (await c.database.pool.query('SELECT token_hash,actor_id FROM admin_sessions'))
      .rows[0];
    expect(session.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(session.token_hash).not.toContain(operator.cookie.split('=')[1]);
    expect(
      (
        await c.app.inject({
          url: '/v1/admin/session',
          headers: { cookie: 'uttirno_dev_session=forged' },
        })
      ).statusCode,
    ).toBe(401);
    const unknown = await c.login('unprovisioned-sub');
    expect(unknown.response.statusCode).toBe(401);
    expect(
      (await c.database.pool.query('SELECT count(*) FROM identity_bindings')).rows[0].count,
    ).toBe('5');
    expect((await c.app.inject('/v1/admin/session')).statusCode).toBe(401);
    const cross = await c.app.inject({
      url: '/v1/admin/session',
      headers: { cookie: operator.cookie, origin: 'https://evil.example' },
    });
    expect(cross.statusCode).toBe(403);
  } finally {
    await c.close();
  }
});
it.each(['nonce', 'audience', 'signature', 'expired', 'issuer', 'pkce'] as const)(
  'R18 rejects %s OIDC response without creating a session',
  async (mode) => {
    const c = await m5Context();
    try {
      c.provider.setMode(mode);
      const result = await c.login('operator-sub');
      expect(result.response.statusCode).toBe(401);
      expect(
        (await c.database.pool.query('SELECT count(*) FROM admin_sessions')).rows[0].count,
      ).toBe('0');
      expect(result.response.body).not.toContain(c.provider.clientSecret);
    } finally {
      await c.close();
    }
  },
);
it('R18 login state is browser-bound and one-use; CSRF/logout/disabled identities invalidate access', async () => {
  const c = await m5Context();
  try {
    const login = await c.login('reviewer-sub');
    expect(login.response.statusCode).toBe(302);
    const replay = await c.app.inject({
      url: login.callback.pathname + login.callback.search,
      headers: { cookie: `${login.loginCookie.name}=${login.loginCookie.value}` },
    });
    expect(replay.statusCode).toBe(401);
    const reviewer = await c.session('reviewer-sub');
    const noCsrf = await c.app.inject({
      method: 'POST',
      url: '/v1/admin/auth/logout',
      payload: {},
      headers: { cookie: reviewer.cookie, origin: c.env.ADMIN_ORIGIN },
    });
    expect(noCsrf.statusCode).toBe(400);
    const logout = await c.post(reviewer, '/v1/admin/auth/logout', {});
    expect(logout.statusCode).toBe(200);
    expect(
      (await c.app.inject({ url: '/v1/admin/session', headers: { cookie: reviewer.cookie } }))
        .statusCode,
    ).toBe(401);
    const operator = await c.session('operator-sub');
    await c.database.pool.query("UPDATE admin_identities SET disabled=true WHERE id='operator'");
    expect(
      (await c.app.inject({ url: '/v1/admin/session', headers: { cookie: operator.cookie } }))
        .statusCode,
    ).toBe(401);
    const encrypted = (await c.app.inject('/v1/admin/auth/login')).cookies.find(
      (cookie) => cookie.name === 'uttirno_dev_login',
    );
    expect(encrypted?.httpOnly).toBe(true);
  } finally {
    await c.close();
  }
});
it('R19/R20/R18 source -> draft -> authenticated review -> approved HTTP client read; Unicode search/cursors are safe', async () => {
  const c = await m5Context(false);
  try {
    const operator = await c.session('operator-sub'),
      approver = await c.session('approver-sub'),
      reviewer = await c.session('reviewer-sub');
    expect(
      (
        await c.post(approver, '/v1/admin/authorities', {
          id: 'synthetic-authority',
          name: 'SYNTHETIC authority',
          evidence: c.source.config.ownershipEvidence,
        })
      ).statusCode,
    ).toBe(200);
    const registered = await c.post(approver, '/v1/admin/sources', {
      authorityId: 'synthetic-authority',
      bundle: c.source.bundle,
    });
    expect(registered.statusCode, registered.body).toBe(200);
    const source = await c.app.inject({
      url: `/v1/admin/sources/${c.source.config.id}`,
      headers: { cookie: approver.cookie },
    });
    const control = await c.post(approver, `/v1/admin/sources/${c.source.config.id}/controls`, {
      expectedEpoch: source.json().control_epoch,
      collectionHalted: false,
      displayHalted: false,
      reason: 'SYNTHETIC source review',
    });
    expect(control.statusCode, control.body).toBe(200);
    const scheduled = await c.post(operator, `/v1/admin/sources/${c.source.config.id}/runs`, {
      reason: 'SYNTHETIC bounded acquisition',
    });
    expect(scheduled.statusCode).toBe(200);
    const runId = scheduled.json().runId as string,
      id = (await c.database.pool.query('SELECT id FROM stage_runs WHERE run_id=$1', [runId]))
        .rows[0].id;
    const claim = await c.execution.claim(id, 'operator');
    if (!claim) throw new Error('EXPECTED_CLAIM');
    await c.execution.inventory(claim, { complete: true, documentUrls: [c.url] });
    const document = await c.makeDocument();
    const staged = await c.post(operator, '/v1/admin/revisions', {
      sourceId: c.source.config.id,
      runId,
      bundle: document.bundle,
      inventory: document.inventory,
    });
    expect(staged.statusCode, staged.body).toBe(200);
    const revision = staged.json();
    expect((await c.app.inject('/v1/jobs')).json().items).toHaveLength(0);
    const snapshot = await c.app.inject({
      url: `/v1/admin/revisions/${revision.revisionId}`,
      headers: { cookie: reviewer.cookie },
    });
    expect(snapshot.statusCode, snapshot.body).toBe(200);
    const attestation = snapshot.json().attestation;
    const denied = await c.post(operator, `/v1/admin/revisions/${revision.revisionId}/approve`, {
      expectedGeneration: 1,
      attestation,
      reason: 'cannot use token role claim',
    });
    expect(denied.statusCode).toBe(403);
    const key = randomUUID(),
      body = {
        expectedGeneration: 1,
        attestation,
        reason: 'SYNTHETIC original-page and absence review',
      };
    const approved = await c.post(
      reviewer,
      `/v1/admin/revisions/${revision.revisionId}/approve`,
      body,
      key,
    );
    expect(approved.statusCode, approved.body).toBe(200);
    const replay = await c.post(
      reviewer,
      `/v1/admin/revisions/${revision.revisionId}/approve`,
      body,
      key,
    );
    expect(replay.json()).toEqual(approved.json());
    const conflict = await c.post(
      reviewer,
      `/v1/admin/revisions/${revision.revisionId}/approve`,
      { ...body, reason: 'different retry' },
      key,
    );
    expect(conflict.statusCode).toBe(409);
    expect(
      (await c.database.pool.query("SELECT count(*) FROM review_actions WHERE action='approved'"))
        .rows[0].count,
    ).toBe('1');
    const address = await c.app.listen({ host: '127.0.0.1', port: 0 });
    const client = new PublicApiClient({ baseUrl: address });
    const first = await client.jobs({ limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    const second = await client.jobs({ limit: 1, cursor: first.nextCursor ?? '' });
    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    expect((await client.jobs({ q: 'সফটওয়্যার ইঞ্জিনিয়ার' })).items).toHaveLength(1);
    expect((await client.jobs({ education: 'CSE' })).items).toHaveLength(1);
    expect((await client.jobs({ category: 'ict' })).items).toHaveLength(1);
    expect((await client.jobs({ q: "%' OR 1=1 --" })).items).toHaveLength(0);
    const detail = await client.job(first.items[0]?.id ?? '');
    expect(detail.fields.salary.fact.status).toBe('not_stated');
    expect(detail.documents[0]?.url).toBe(c.url);
    expect(JSON.stringify(detail)).not.toMatch(
      /reviewedBy|created_by|client_secret|storage_key|control_epoch/,
    );
    const invalid = await c.app.inject(
      `/v1/jobs?limit=1&q=changed&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
    );
    expect(invalid.statusCode).toBe(400);
    expect((await c.app.inject('/v1/jobs?includeDrafts=true')).statusCode).toBe(400);
    const schema = await c.app.inject('/v1/openapi.json');
    expect(schema.json().paths['/v1/jobs']).toBeDefined();
    expect(schema.json().paths['/v1/admin/revisions/{id}/approve']).toBeDefined();
    const admin = new AdminApiClient({
      baseUrl: address,
      fetch: async (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set('cookie', reviewer.cookie);
        headers.set('origin', c.env.ADMIN_ORIGIN);
        return fetch(input, { ...init, headers });
      },
    });
    expect((await admin.session()).actorId).toBe('reviewer');
    expect((await admin.review(revision.revisionId)).id).toBe(revision.revisionId);
    const changed = await c.makeDocument({ deadline: '17/12/2026' });
    const next = await c.post(operator, '/v1/admin/revisions', {
      sourceId: c.source.config.id,
      runId,
      bundle: changed.bundle,
      inventory: changed.inventory,
    });
    expect(next.statusCode, next.body).toBe(200);
    expect(
      (await c.post(reviewer, `/v1/admin/revisions/${revision.revisionId}/approve`, body))
        .statusCode,
    ).toBe(409);
    const review2 = await c.session('reviewer2-sub');
    const snapshot2 = await c.app.inject({
      url: `/v1/admin/revisions/${next.json().revisionId}`,
      headers: { cookie: reviewer.cookie },
    });
    const approvalBody = {
      expectedGeneration: next.json().generation,
      attestation: snapshot2.json().attestation,
      reason: 'SYNTHETIC concurrent review',
    };
    const raced = await Promise.all(
      [reviewer, review2].map((session) =>
        c.post(session, `/v1/admin/revisions/${next.json().revisionId}/approve`, approvalBody),
      ),
    );
    expect(raced.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const current = await client.job(first.items[0]?.id ?? '');
    const suppressed = await c.post(reviewer, `/v1/admin/positions/${current.job.id}/suppress`, {
      expectedRevision: current.job.revisionId,
      expectedGeneration: next.json().generation,
      reason: 'SYNTHETIC mismatch hold',
    });
    expect(suppressed.statusCode, suppressed.body).toBe(200);
    expect((await c.app.inject(`/v1/jobs/${current.job.id}`)).statusCode).toBe(404);
    expect((await c.app.inject(`/v1/jobs/${current.job.id}/events`)).statusCode).toBe(404);
    const state = (
      await c.app.inject({
        url: `/v1/admin/sources/${c.source.config.id}`,
        headers: { cookie: approver.cookie },
      })
    ).json();
    expect(
      (
        await c.post(approver, `/v1/admin/sources/${c.source.config.id}/controls`, {
          expectedEpoch: state.control_epoch,
          collectionHalted: true,
          displayHalted: true,
          reason: 'SYNTHETIC revoked display',
        })
      ).statusCode,
    ).toBe(200);
    expect((await client.jobs()).items).toHaveLength(0);
    expect((await c.app.inject(`/v1/jobs/${second.items[0]?.id}`)).statusCode).toBe(404);
    expect((await c.app.inject(`/v1/jobs/${second.items[0]?.id}/events`)).statusCode).toBe(404);
    expect(schema.json().paths['/v1/admin/auth/login'].get.security).toEqual([]);
    expect(schema.json().paths['/v1/admin/revisions/{id}/approve'].post.security).toEqual([
      { adminCookie: [] },
    ]);
  } finally {
    await c.close();
  }
}, 60000);
