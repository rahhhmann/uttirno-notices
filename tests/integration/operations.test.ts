import { it, expect } from 'vitest';
import { createApp } from '../../apps/api/src/app.js';
import { Redis } from 'ioredis';
import {
  SourceRepository,
  RevisionRepository,
  PublicationRepository,
  operationsSnapshot,
} from '@uttirno/database';
import { m4Context, integrationEnvironment } from '../helpers/m4.js';
import { m5Context } from '../helpers/m5.js';
import { runtimeRoles } from '../helpers/operations.js';
import { probeMetrics } from '../../scripts/monitor.mjs';
import Fastify from 'fastify';
import { registerOperations } from '../../apps/api/src/operations.js';
it('R18/R24 separate physical runtime roles preserve stage/review and deny worker identity/publication/history writes', async () => {
  const c = await m4Context();
  let roles: Awaited<ReturnType<typeof runtimeRoles>> | undefined;
  try {
    roles = await runtimeRoles(c);
    const worker = { ...c.options, pool: roles.worker.pool },
      api = { ...c.options, pool: roles.api.pool };
    await expect(roles.worker.pool.query('SELECT * FROM admin_sessions')).rejects.toThrow(
      'permission denied',
    );
    await expect(
      roles.worker.pool.query("UPDATE admin_roles SET role='administrator'"),
    ).rejects.toThrow('permission denied');
    await expect(roles.worker.pool.query('DELETE FROM audit_events')).rejects.toThrow(
      'permission denied',
    );
    await expect(
      roles.worker.pool.query('UPDATE published_positions SET suppressed=false'),
    ).rejects.toThrow('permission denied');
    await expect(roles.api.pool.query('CREATE TABLE forbidden(id integer)')).rejects.toThrow(
      'permission denied',
    );
    const item = await c.makeDocument(),
      run = await c.beginRun();
    const draft = await new RevisionRepository(worker).stage('operator', {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle: item.bundle,
      inventory: item.inventory,
    });
    if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    await new PublicationRepository(api).approve(
      'reviewer',
      draft.revisionId,
      1,
      await c.attestation(item),
      'SYNTHETIC restricted role review',
    );
    expect(await c.publication.publicPositions()).toHaveLength(2);
    await expect(
      roles.api.pool.query("UPDATE schema_migrations SET checksum='tampered'"),
    ).rejects.toThrow('permission denied');
    expect((await new SourceRepository(worker).current(c.source.config.id)).config.id).toBe(
      c.source.config.id,
    );
  } finally {
    await roles?.close();
    await c.close();
  }
});
it('R26 Redis quota is shared across API instances, forwarded spoofing is ignored and Redis loss fails closed', async () => {
  const c = await m5Context(),
    redis = new Redis(integrationEnvironment().REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
  // The API identity fixture does not own infrastructure credentials; use its guarded local server env.
  await redis.connect();
  const options = {
    env: c.env,
    database: c.options,
    taxonomy: c.taxonomy,
    rateLimitRedis: redis,
    rateLimitMax: 2,
  };
  const a = createApp(async () => ({ database: true, redis: true, storage: true }), options),
    b = createApp(async () => ({ database: true, redis: true, storage: true }), options);
  const ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;
  try {
    expect(
      (
        await a.inject({
          url: '/v1/jobs',
          remoteAddress: ip,
          headers: { 'x-forwarded-for': '203.0.113.1' },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await b.inject({
          url: '/v1/jobs',
          remoteAddress: ip,
          headers: { 'x-forwarded-for': '203.0.113.2' },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await a.inject({
          url: '/v1/jobs',
          remoteAddress: ip,
          headers: { 'x-forwarded-for': '203.0.113.3' },
        })
      ).statusCode,
    ).toBe(429);
    redis.disconnect();
    expect((await b.inject({ url: '/v1/jobs', remoteAddress: '192.0.2.254' })).statusCode).toBe(
      503,
    );
  } finally {
    await a.close();
    await b.close();
    redis.disconnect();
    await c.close();
  }
});
it('R22/R24 injected drift creates an owned alert; existing source controls support reviewed recovery', async () => {
  const c = await m4Context();
  const observer = Fastify();
  registerOperations(observer, { token: 's'.repeat(32) }, c.options);
  try {
    const run = await c.beginRun();
    await c.execution.fail(run.claim, 'SYNTHETIC_DRIFT', { permanent: true, drift: true });
    const signals = await operationsSnapshot(c.database.pool);
    const origin = await observer.listen({ host: '127.0.0.1', port: 0 }),
      received: unknown[] = [];
    const alerts = await probeMetrics(
      origin,
      's'.repeat(32),
      { uttirno_dead_stages: 1 },
      'SYNTHETIC on-call',
      async (signal: unknown) => {
        received.push(signal);
      },
    );
    expect(received).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ active: true, owner: 'SYNTHETIC on-call' });
    expect(signals.collection_paused).toBe(1);
    const epoch = (
      await c.database.pool.query('SELECT control_epoch FROM sources WHERE id=$1', [
        c.source.config.id,
      ])
    ).rows[0].control_epoch;
    await c.sources.controls('approver', c.source.config.id, {
      collectionHalted: false,
      displayHalted: false,
      expectedEpoch: epoch,
      reason: 'SYNTHETIC reviewed drift recovery',
    });
    expect((await operationsSnapshot(c.database.pool)).collection_paused).toBe(0);
    expect(
      (
        await c.database.pool.query(
          "SELECT count(*) FROM audit_events WHERE action='source_drift_pause'",
        )
      ).rows[0].count,
    ).toBe('1');
  } finally {
    await observer.close();
    await c.close();
  }
});
