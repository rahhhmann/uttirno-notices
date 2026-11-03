// biome-ignore-all lint/style/noNonNullAssertion: Synthetic lease/claim values are asserted before reuse.
import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { m4Context } from '../helpers/m4.js';
import { ExecutionRepository } from '@uttirno/database';
it('R21 stale lease tokens cannot commit; checkpoints survive recovery and retries stop at a dead letter', async () => {
  const c = await m4Context();
  try {
    const run = await c.beginRun();
    await c.execution.checkpoint(run.claim, { step: 'synthetic-one' });
    await c.database.pool.query(
      "UPDATE stage_runs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
      [run.claim.id],
    );
    await c.database.pool.query(
      "UPDATE resource_leases SET expires_at=clock_timestamp()-interval '1 second'",
    );
    const recovered = await c.execution.claim(run.claim.id, 'operator');
    expect(recovered?.checkpoint).toEqual({ step: 'synthetic-one' });
    expect(recovered?.token).not.toBe(run.claim.token);
    await expect(c.execution.complete(run.claim, {})).rejects.toThrow('STAGE_LEASE_LOST');
    await c.execution.fail(recovered!, 'SYNTHETIC_TRANSIENT');
    const state = (
      await c.database.pool.query(
        'SELECT state,available_at,attempts FROM stage_runs WHERE id=$1',
        [run.claim.id],
      )
    ).rows[0];
    expect(state.state).toBe('retry');
    expect(state.attempts).toBe(2);
    expect(state.available_at.getTime()).toBeGreaterThan(Date.now());
    // SYNTHETIC clock fast-forward, not a production delay override.
    await c.database.pool.query(
      'UPDATE stage_runs SET available_at=clock_timestamp() WHERE id=$1',
      [run.claim.id],
    );
    const last = await c.execution.claim(run.claim.id, 'operator');
    expect(last?.attempt).toBe(3);
    await c.execution.fail(last!, 'SYNTHETIC_POISON');
    expect((await c.execution.deadLetters())[0]).toMatchObject({
      id: run.claim.id,
      attempts: 3,
      error_code: 'SYNTHETIC_POISON',
    });
    expect(await c.execution.claim(run.claim.id, 'operator')).toBeNull();
    const rerun = await c.execution.rerun(
      'operator',
      run.runId,
      'SYNTHETIC recorded retry after repair',
    );
    expect(rerun).not.toBe(run.runId);
    expect(
      (await c.database.pool.query("SELECT count(*) FROM audit_events WHERE action='run_rerun'"))
        .rows[0].count,
    ).toBe('1');
  } finally {
    await c.close();
  }
});
it('R21 source stage exclusivity, heartbeat, revocation and reconfigured jobs are enforced at execution', async () => {
  const c = await m4Context();
  try {
    const runId = await c.sources.schedule('operator', c.source.config.id);
    expect(await c.sources.schedule('operator', c.source.config.id)).toBe(runId);
    const id = (await c.database.pool.query('SELECT id FROM stage_runs WHERE run_id=$1', [runId]))
      .rows[0].id;
    const claims = await Promise.all([
      c.execution.claim(id, 'operator'),
      c.execution.claim(id, 'operator'),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const claim = claims.find(Boolean)!;
    await c.execution.heartbeat(claim);
    const epoch = (await c.database.pool.query('SELECT control_epoch FROM sources')).rows[0]
      .control_epoch;
    await c.sources.controls('approver', c.source.config.id, {
      collectionHalted: true,
      displayHalted: true,
      expectedEpoch: epoch,
      reason: 'SYNTHETIC stop in-flight',
    });
    await expect(c.execution.complete(claim, { bad: 'stale commit' })).rejects.toThrow(
      'SOURCE_HALTED',
    );
    expect(await c.execution.claim(id, 'operator')).toBeNull();
    expect(
      (await c.database.pool.query('SELECT checkpoint FROM stage_runs WHERE id=$1', [id])).rows[0]
        .checkpoint,
    ).toBeNull();
  } finally {
    await c.close();
  }
});
it('R04/R21 source budgets persist across worker stages and excessive Retry-After is never shortened', async () => {
  const c = await m4Context({ limits: { maxRequests: 1, maxTotalBytes: 128 } });
  try {
    const { claim } = await c.beginRun();
    await c.execution.reserveRequest(claim);
    await expect(c.execution.reserveRequest(claim)).rejects.toThrow('REQUEST_BUDGET');
    await expect(c.execution.recordResponse(claim, 129)).rejects.toThrow('BYTE_BUDGET');
    expect(
      (await c.database.pool.query('SELECT total_bytes FROM source_runs')).rows[0].total_bytes,
    ).toBe('129');
    await c.execution.fail(claim, 'RETRY_LATER', { retryAfterMs: 7200000 });
    const row = (
      await c.database.pool.query('SELECT available_at FROM stage_runs WHERE id=$1', [claim.id])
    ).rows[0];
    expect(row.available_at.getTime() - Date.now()).toBeGreaterThan(7195000);
    await expect(c.sources.current(c.source.config.id)).rejects.toThrow('RETRY_LATER');
  } finally {
    await c.close();
  }
});
it('R04 distributed per-host requests serialize across clients, minimum interval and global cooldown hold', async () => {
  const c = await m4Context();
  try {
    const other = new ExecutionRepository(c.options),
      host = `synthetic-${randomUUID()}.example`;
    let active = 0,
      max = 0;
    const starts: number[] = [];
    const action = async () => {
      active++;
      max = Math.max(max, active);
      starts.push(Date.now());
      await delay(30);
      active--;
      return 'synthetic';
    };
    await Promise.all([
      c.execution.withHost(host, 4000, action),
      other.withHost(host, 4000, action),
    ]);
    expect(max).toBe(1);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(3950);
    await c.execution.deferHost(host, 120000);
    await expect(other.withHost(host, 4000, action)).rejects.toThrow('RETRY_LATER');
    expect(starts).toHaveLength(2);
  } finally {
    await c.close();
  }
});
it('R22 layout drift pauses further collection, keeps prior public projection and records audit', async () => {
  const c = await m4Context();
  try {
    const { claim } = await c.beginRun();
    await c.execution.fail(claim, 'SOURCE_DISCOVERY_DRIFT', { permanent: true, drift: true });
    const row = (
      await c.database.pool.query('SELECT collection_halted,display_halted,reason FROM sources')
    ).rows[0];
    expect(row).toMatchObject({
      collection_halted: true,
      display_halted: false,
      reason: 'SOURCE_DISCOVERY_DRIFT',
    });
    expect(
      (
        await c.database.pool.query(
          "SELECT count(*) FROM audit_events WHERE action='source_drift_pause'",
        )
      ).rows[0].count,
    ).toBe('1');
    await expect(c.sources.current(c.source.config.id)).rejects.toThrow('SOURCE_HALTED');
  } finally {
    await c.close();
  }
});
it('R17/R21 outbox delivery claims are exclusive and token-fenced; ack requires the owning lease', async () => {
  const c = await m4Context();
  try {
    await c.sources.schedule('operator', c.source.config.id);
    const results = await Promise.all([c.outbox.claim('stage'), c.outbox.claim('stage')]);
    expect(results.flat()).toHaveLength(1);
    const event = results.flat()[0]!;
    await expect(c.outbox.acknowledge({ ...event, token: randomUUID() })).rejects.toThrow(
      'OUTBOX_LEASE_LOST',
    );
    await c.outbox.acknowledge(event);
    expect(await c.outbox.claim('stage')).toHaveLength(0);
  } finally {
    await c.close();
  }
});
it('R21 source configuration changes invalidate queued work and stale writers cannot insert artifacts', async () => {
  const c = await m4Context();
  try {
    const item = await c.makeDocument(),
      run = await c.beginRun();
    await c.database.pool.query(
      "UPDATE stage_runs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
      [run.claim.id],
    );
    await c.database.pool.query(
      "UPDATE resource_leases SET expires_at=clock_timestamp()-interval '1 second'",
    );
    const replacement = await c.execution.claim(run.claim.id, 'operator');
    expect(replacement).not.toBeNull();
    await expect(c.documents.put('operator', item.capture, item.doc, run.claim)).rejects.toThrow(
      'STAGE_LEASE_LOST',
    );
    const revised = c.source.resign({ ...c.source.config, version: 2 });
    const wrongIssuer = c.source.resign({
      ...c.source.config,
      version: 2,
      authority: 'SYNTHETIC unrelated authority',
    });
    await expect(
      c.sources.register('approver', 'synthetic-authority', wrongIssuer),
    ).rejects.toThrow('ISSUER_BINDING_MISMATCH');
    await c.sources.register('approver', 'synthetic-authority', revised);
    expect(await c.execution.claim(run.claim.id, 'operator')).toBeNull();
    await expect(c.execution.complete(replacement!, {})).rejects.toThrow('SOURCE_CONFIG_STALE');
    expect(
      (await c.database.pool.query('SELECT state FROM source_runs WHERE id=$1', [run.runId]))
        .rows[0].state,
    ).toBe('blocked');
  } finally {
    await c.close();
  }
});
