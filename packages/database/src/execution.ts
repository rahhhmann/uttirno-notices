import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { StageJobSchema, type StageJob } from '@uttirno/contracts';
import { stageId, retryDelay } from '@uttirno/domain';
import { assertSourceUrl, SourcePolicyError } from '@uttirno/source-config';
import type { PoolClient } from 'pg';
import {
  transaction,
  gate,
  requireRole,
  audit,
  insertStage,
  type DatabaseOptions,
} from './shared.js';
export type StageClaim = {
  id: string;
  token: string;
  actorId: string;
  payload: StageJob;
  attempt: number;
  checkpoint: unknown;
};
export class ExecutionRepository {
  constructor(private readonly options: DatabaseOptions) {}
  async job(id: string) {
    const row = (await this.options.pool.query('SELECT payload FROM stage_runs WHERE id=$1', [id]))
      .rows[0];
    if (!row) throw new Error('STAGE_NOT_FOUND');
    return StageJobSchema.parse(row.payload);
  }
  private async claimRow(c: PoolClient, id: string, actor: string) {
    await requireRole(c, actor, ['operator', 'administrator']);
    const initial = (
      await c.query(
        'SELECT s.*,r.source_id,r.fingerprint,r.state AS run_state FROM stage_runs s JOIN source_runs r ON r.id=s.run_id WHERE s.id=$1',
        [id],
      )
    ).rows[0];
    if (!initial) throw new Error('STAGE_NOT_FOUND');
    await gate(c, this.options, initial.source_id, 'collection', initial.fingerprint, true);
    const row = (await c.query('SELECT * FROM stage_runs WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (
      !['queued', 'running'].includes(initial.run_state) ||
      ['complete', 'dead', 'blocked'].includes(row.state)
    )
      return null;
    const now = (await c.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0]?.now;
    if (!now || row.available_at > now || (row.lease_until && row.lease_until > now)) return null;
    if (row.attempts >= row.max_attempts) {
      await c.query(
        "UPDATE stage_runs SET state='dead',lease_token=NULL,lease_until=NULL,error_code='ATTEMPTS_EXHAUSTED' WHERE id=$1",
        [id],
      );
      await c.query(
        "UPDATE source_runs SET state='failed',finished_at=clock_timestamp() WHERE id=$1",
        [row.run_id],
      );
      return null;
    }
    const token = randomUUID();
    const acquired = await c.query(
      "INSERT INTO resource_leases(resource_key,token,expires_at) VALUES($1,$2,clock_timestamp()+interval '45 seconds') ON CONFLICT(resource_key) DO UPDATE SET token=excluded.token,fence=resource_leases.fence+1,expires_at=excluded.expires_at WHERE resource_leases.expires_at<=clock_timestamp() RETURNING fence",
      [`source:${initial.source_id}`, token],
    );
    if (!acquired.rowCount) return null;
    await c.query(
      "UPDATE stage_runs SET state='running',attempts=attempts+1,lease_token=$2,lease_until=clock_timestamp()+interval '45 seconds',updated_at=clock_timestamp(),lease_actor=$3 WHERE id=$1",
      [id, token, actor],
    );
    await c.query("UPDATE source_runs SET state='running' WHERE id=$1", [row.run_id]);
    const payload = StageJobSchema.parse(row.payload);
    if (stageId(payload) !== id) throw new Error('STAGE_IDENTITY_MISMATCH');
    return {
      id,
      token,
      actorId: actor,
      payload,
      attempt: Number(row.attempts) + 1,
      checkpoint: row.checkpoint,
    } satisfies StageClaim;
  }
  async claim(id: string, actor: string): Promise<StageClaim | null> {
    try {
      return await transaction(this.options.pool, (c) => this.claimRow(c, id, actor));
    } catch (error) {
      // Policy rejection is durable, but transient database failures must reach the dispatcher.
      const code = error instanceof Error ? error.message : '';
      if (
        !/^(SOURCE_|POLICY_|COLLECTION_|UNTRUSTED_|INVALID_APPROVAL|INVALID_SOURCE|CONFIG_)/.test(
          code,
        )
      )
        throw error;
      await transaction(this.options.pool, async (c) => {
        await c.query(
          "UPDATE stage_runs SET state='blocked',error_code=$2,lease_token=NULL,lease_until=NULL WHERE id=$1 AND state<>'complete'",
          [id, code.slice(0, 100)],
        );
        await c.query(
          "UPDATE source_runs SET state='blocked',finished_at=clock_timestamp() WHERE id=(SELECT run_id FROM stage_runs WHERE id=$1) AND state<>'complete'",
          [id],
        );
      });
      return null;
    }
  }
  private async fenced(c: PoolClient, claim: StageClaim, lock = false) {
    await requireRole(c, claim.actorId, ['operator', 'administrator']);
    await gate(
      c,
      this.options,
      claim.payload.sourceId,
      'collection',
      claim.payload.fingerprint,
      lock,
    );
    const row = (
      await c.query(
        `SELECT *,lease_until>clock_timestamp() AS lease_live FROM stage_runs WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
        [claim.id],
      )
    ).rows[0];
    const lease = (
      await c.query(
        'SELECT 1 FROM resource_leases WHERE resource_key=$1 AND token=$2 AND expires_at>clock_timestamp()',
        [`source:${claim.payload.sourceId}`, claim.token],
      )
    ).rowCount;
    if (
      row?.state !== 'running' ||
      row.lease_actor !== claim.actorId ||
      row.lease_token !== claim.token ||
      !lease ||
      !row.lease_live
    )
      throw new Error('STAGE_LEASE_LOST');
    return row;
  }
  async assertClaim(claim: StageClaim) {
    await transaction(this.options.pool, (c) => this.fenced(c, claim));
  }
  async authorize(actor: string) {
    await transaction(this.options.pool, (c) =>
      requireRole(c, actor, ['operator', 'administrator']),
    );
  }
  async heartbeat(claim: StageClaim) {
    await transaction(this.options.pool, async (c) => {
      await this.fenced(c, claim, true);
      await c.query(
        "UPDATE stage_runs SET lease_until=clock_timestamp()+interval '45 seconds' WHERE id=$1",
        [claim.id],
      );
      await c.query(
        "UPDATE resource_leases SET expires_at=clock_timestamp()+interval '45 seconds' WHERE resource_key=$1 AND token=$2",
        [`source:${claim.payload.sourceId}`, claim.token],
      );
    });
  }
  async checkpoint(claim: StageClaim, value: unknown) {
    const json = JSON.stringify(value);
    if (json.length > 1048576) throw new Error('CHECKPOINT_TOO_LARGE');
    await transaction(this.options.pool, async (c) => {
      await this.fenced(c, claim, true);
      await c.query('UPDATE stage_runs SET checkpoint=$2 WHERE id=$1', [claim.id, json]);
    });
  }
  async inventory(claim: StageClaim, input: { complete: boolean; documentUrls: string[] }) {
    if (
      !input.documentUrls.length ||
      input.documentUrls.length > 100 ||
      new Set(input.documentUrls).size !== input.documentUrls.length
    )
      throw new Error('INVALID_INVENTORY');
    await transaction(this.options.pool, async (c) => {
      await this.fenced(c, claim, true);
      const { config } = await gate(
        c,
        this.options,
        claim.payload.sourceId,
        'collection',
        claim.payload.fingerprint,
      );
      for (const url of input.documentUrls) assertSourceUrl(config, url);
      const existing = (
        await c.query('SELECT inventory FROM source_runs WHERE id=$1 FOR UPDATE', [
          claim.payload.runId,
        ])
      ).rows[0]?.inventory;
      if (existing && JSON.stringify(existing) !== JSON.stringify(input)) {
        // JSONB property order does not carry meaning.
        if (
          existing.complete !== input.complete ||
          JSON.stringify(existing.documentUrls) !== JSON.stringify(input.documentUrls)
        )
          throw new Error('INVENTORY_IMMUTABLE');
      }
      await c.query('UPDATE source_runs SET inventory=$2 WHERE id=$1', [
        claim.payload.runId,
        JSON.stringify(input),
      ]);
    });
  }
  async complete(claim: StageClaim, checkpoint: unknown, next: StageJob[] = []) {
    if (JSON.stringify(checkpoint).length > 1048576) throw new Error('CHECKPOINT_TOO_LARGE');
    await transaction(this.options.pool, async (c) => {
      await this.fenced(c, claim, true);
      for (const raw of next) {
        const job = StageJobSchema.parse(raw);
        if (
          job.runId !== claim.payload.runId ||
          job.sourceId !== claim.payload.sourceId ||
          job.fingerprint !== claim.payload.fingerprint
        )
          throw new Error('DEPENDENT_STAGE_SCOPE_MISMATCH');
        await insertStage(c, stageId(job), job);
      }
      await c.query(
        "UPDATE stage_runs SET state='complete',checkpoint=$2,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1",
        [claim.id, JSON.stringify(checkpoint)],
      );
      if (claim.payload.stage === 'document') {
        const run = (
          await c.query('SELECT inventory FROM source_runs WHERE id=$1', [claim.payload.runId])
        ).rows[0];
        const documents = (
          await c.query(
            "SELECT state FROM stage_runs WHERE run_id=$1 AND payload->>'stage'='document'",
            [claim.payload.runId],
          )
        ).rows;
        if (
          run?.inventory?.complete &&
          documents.length === run.inventory.documentUrls.length &&
          documents.every((r) => r.state === 'complete')
        ) {
          const fanIn = StageJobSchema.parse({
            ...claim.payload,
            stage: 'reconcile',
            inputKey: 'circular-bundle',
          });
          await insertStage(c, stageId(fanIn), fanIn);
        }
      }
      await c.query('DELETE FROM resource_leases WHERE resource_key=$1 AND token=$2', [
        `source:${claim.payload.sourceId}`,
        claim.token,
      ]);
      if (
        !(
          await c.query("SELECT 1 FROM stage_runs WHERE run_id=$1 AND state<>'complete' LIMIT 1", [
            claim.payload.runId,
          ])
        ).rowCount
      ) {
        await c.query(
          "UPDATE source_runs SET state='complete',finished_at=clock_timestamp() WHERE id=$1",
          [claim.payload.runId],
        );
        await c.query(
          'UPDATE sources SET last_success=clock_timestamp(),last_checked=clock_timestamp() WHERE id=$1',
          [claim.payload.sourceId],
        );
      }
    });
  }
  async fail(
    claim: StageClaim,
    code: string,
    options: { permanent?: boolean; drift?: boolean; retryAfterMs?: number } = {},
  ) {
    if (!/^[A-Z_]{1,100}$/.test(code)) code = 'STAGE_FAILED';
    await transaction(this.options.pool, async (c) => {
      // Failure recording must remain possible after policy revocation, with fencing token protection.
      await c.query('SELECT id FROM sources WHERE id=$1 FOR UPDATE', [claim.payload.sourceId]);
      const row = (await c.query('SELECT * FROM stage_runs WHERE id=$1 FOR UPDATE', [claim.id]))
        .rows[0];
      if (row?.state !== 'running' || row.lease_token !== claim.token) return;
      const dead = options.permanent || options.drift || row.attempts >= row.max_attempts;
      if (
        options.retryAfterMs !== undefined &&
        (!Number.isFinite(options.retryAfterMs) ||
          options.retryAfterMs < 0 ||
          options.retryAfterMs > 8640000000000000)
      )
        throw new Error('INVALID_RETRY_AFTER');
      const retry = Math.max(retryDelay(row.attempts), options.retryAfterMs ?? 0);
      if (options.retryAfterMs)
        await c.query(
          "UPDATE sources SET not_before=GREATEST(not_before,clock_timestamp()+$2*interval '1 millisecond'),next_due=GREATEST(next_due,clock_timestamp()+$2*interval '1 millisecond') WHERE id=$1",
          [claim.payload.sourceId, options.retryAfterMs],
        );
      await c.query(
        "UPDATE stage_runs SET state=$2,error_code=$3,available_at=clock_timestamp()+$4*interval '1 millisecond',lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=$1",
        [claim.id, dead ? 'dead' : 'retry', code, retry],
      );
      await c.query('DELETE FROM resource_leases WHERE resource_key=$1 AND token=$2', [
        `source:${claim.payload.sourceId}`,
        claim.token,
      ]);
      if (dead)
        await c.query(
          "UPDATE source_runs SET state='failed',finished_at=clock_timestamp() WHERE id=$1",
          [claim.payload.runId],
        );
      if (options.drift) {
        await c.query(
          'UPDATE sources SET collection_halted=true,reason=$2,control_epoch=control_epoch+1 WHERE id=$1',
          [claim.payload.sourceId, code],
        );
        // All remaining stages are stopped; publication is unaffected absent a critical event.
        await c.query(
          "UPDATE stage_runs SET state='blocked',error_code='SOURCE_DRIFT',lease_token=NULL,lease_until=NULL WHERE run_id=$1 AND state IN('queued','retry','running')",
          [claim.payload.runId],
        );
        await audit(c, claim.actorId, 'source_drift_pause', claim.payload.sourceId, {
          code,
          stageId: claim.id,
        });
      }
    });
  }
  async recoverable() {
    return (
      await this.options.pool.query(
        "SELECT id FROM stage_runs WHERE (state IN('queued','retry') AND available_at<=clock_timestamp()) OR (state='running' AND lease_until<=clock_timestamp()) ORDER BY updated_at LIMIT 100",
      )
    ).rows.map((r) => r.id as string);
  }
  async deadLetters() {
    return (
      await this.options.pool.query(
        "SELECT id,run_id,attempts,error_code FROM stage_runs WHERE state IN('dead','blocked') ORDER BY updated_at DESC LIMIT 100",
      )
    ).rows;
  }
  async withHost<T>(host: string, intervalMs: number, action: () => Promise<T>): Promise<T> {
    if (
      !/^[a-z0-9.-]{1,253}$/.test(host) ||
      !Number.isInteger(intervalMs) ||
      intervalMs < 4000 ||
      intervalMs > 60000
    )
      throw new Error('INVALID_HOST_LIMIT');
    const c = await this.options.pool.connect();
    let locked = false;
    let healthy = true;
    const broken = () => {
      healthy = false;
    };
    c.on('error', broken);
    try {
      const deadline = Date.now() + 60000;
      while (!locked && healthy && Date.now() < deadline) {
        locked = Boolean(
          (
            await c.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [
              `uttirno-host:${host}`,
            ])
          ).rows[0]?.locked,
        );
        if (!locked) await delay(100);
      }
      if (!locked) throw new Error('HOST_BUSY');
      const prior = (
        await c.query(
          'SELECT GREATEST(EXTRACT(EPOCH FROM(reserved_until-clock_timestamp()))*1000,EXTRACT(EPOCH FROM(last_start-clock_timestamp()))*1000+GREATEST(interval_ms,$2)) AS wait FROM host_windows WHERE host=$1',
          [host, intervalMs],
        )
      ).rows[0];
      if (prior?.wait > 60000)
        throw new SourcePolicyError('RETRY_LATER', Math.ceil(Number(prior.wait)));
      if (prior?.wait > 0) await delay(Math.ceil(Number(prior.wait)));
      if (!healthy) throw new Error('HOST_LEASE_LOST');
      await c.query(
        "INSERT INTO host_windows(host,last_start,reserved_until,interval_ms) VALUES($1,clock_timestamp(),clock_timestamp()+interval '120 seconds',$2) ON CONFLICT(host) DO UPDATE SET last_start=excluded.last_start,reserved_until=excluded.reserved_until,interval_ms=GREATEST(host_windows.interval_ms,excluded.interval_ms)",
        [host, intervalMs],
      );
      const value = await action();
      if (!healthy) throw new Error('HOST_LEASE_LOST');
      await c.query(
        "UPDATE host_windows SET reserved_until=last_start+interval_ms*interval '1 millisecond' WHERE host=$1",
        [host],
      );
      return value;
    } finally {
      if (locked && healthy)
        await c
          .query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [`uttirno-host:${host}`])
          .catch(() => {});
      c.off('error', broken);
      c.release(!healthy);
    }
  }
  async rerun(actor: string, runId: string, reason: string) {
    if (!reason.trim()) throw new Error('REASON_REQUIRED');
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['operator', 'administrator']);
      const old = (await c.query('SELECT * FROM source_runs WHERE id=$1', [runId])).rows[0];
      if (!old || !['failed', 'blocked', 'complete'].includes(old.state))
        throw new Error('RUN_NOT_TERMINAL');
      const { row } = await gate(c, this.options, old.source_id, 'collection', undefined, true);
      const id = randomUUID();
      await c.query(
        "INSERT INTO source_runs(id,source_id,fingerprint,state) VALUES($1,$2,$3,'queued')",
        [id, old.source_id, row.current_fingerprint],
      );
      const job = StageJobSchema.parse({
        schemaVersion: 1,
        sourceId: old.source_id,
        runId: id,
        fingerprint: row.current_fingerprint,
        stage: 'discover',
        inputKey: 'discovery',
        generation: 0,
      });
      await insertStage(c, stageId(job), job);
      await audit(c, actor, 'run_rerun', id, { previousRun: runId, reason });
      return id;
    });
  }
  async deferHost(host: string, milliseconds: number) {
    if (
      !/^[a-z0-9.-]{1,253}$/.test(host) ||
      !Number.isFinite(milliseconds) ||
      milliseconds < 0 ||
      milliseconds > 8640000000000000
    )
      throw new Error('INVALID_RETRY_AFTER');
    await this.options.pool.query(
      "INSERT INTO host_windows(host,last_start,reserved_until,interval_ms) VALUES($1,clock_timestamp(),clock_timestamp()+$2*interval '1 millisecond',4000) ON CONFLICT(host) DO UPDATE SET reserved_until=GREATEST(host_windows.reserved_until,excluded.reserved_until)",
      [host, milliseconds],
    );
  }
  async reserveRequest(claim: StageClaim) {
    const exceeded = await transaction(this.options.pool, async (c) => {
      await this.fenced(c, claim, true);
      const { config } = await gate(
        c,
        this.options,
        claim.payload.sourceId,
        'collection',
        claim.payload.fingerprint,
      );
      const row = (
        await c.query(
          'UPDATE source_runs SET request_count=request_count+1 WHERE id=$1 RETURNING request_count,total_bytes',
          [claim.payload.runId],
        )
      ).rows[0];
      return (
        row.request_count > config.limits.maxRequests ||
        Number(row.total_bytes) >= config.limits.maxTotalBytes
      );
    });
    if (exceeded) throw new SourcePolicyError('REQUEST_BUDGET');
  }
  async recordResponse(claim: StageClaim, bytes: number) {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('INVALID_RESPONSE_SIZE');
    const exceeded = await transaction(this.options.pool, async (c) => {
      await this.fenced(c, claim, true);
      const { config } = await gate(
        c,
        this.options,
        claim.payload.sourceId,
        'collection',
        claim.payload.fingerprint,
      );
      const row = (
        await c.query(
          'UPDATE source_runs SET total_bytes=total_bytes+$2 WHERE id=$1 RETURNING total_bytes',
          [claim.payload.runId, bytes],
        )
      ).rows[0];
      return Number(row.total_bytes) > config.limits.maxTotalBytes;
    });
    if (exceeded) throw new SourcePolicyError('BYTE_BUDGET');
  }
  async documentOutputs(claim: StageClaim) {
    return transaction(this.options.pool, async (c) => {
      await this.fenced(c, claim);
      const inventory = (
        await c.query('SELECT inventory FROM source_runs WHERE id=$1', [claim.payload.runId])
      ).rows[0]?.inventory;
      const rows = (
        await c.query(
          "SELECT s.checkpoint,t.document FROM stage_runs s LEFT JOIN artifact_text_versions t ON t.text_version=s.checkpoint->>'textVersion' WHERE s.run_id=$1 AND s.state='complete' AND s.payload->>'stage'='document' ORDER BY s.payload->>'inputKey'",
          [claim.payload.runId],
        )
      ).rows;
      return { inventory, rows };
    });
  }
}
