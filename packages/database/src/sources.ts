import { randomUUID } from 'node:crypto';
import {
  SignedSourceSchema,
  authorizeSource,
  configFingerprint,
  canonical,
  SourcePolicyError,
  type SignedSource,
} from '@uttirno/source-config';
import { StageJobSchema } from '@uttirno/contracts';
import { stageId } from '@uttirno/domain';
import {
  transaction,
  requireRole,
  audit,
  sourceRow,
  gate,
  insertStage,
  type DatabaseOptions,
} from './shared.js';
export class SourceRepository {
  constructor(private readonly options: DatabaseOptions) {}
  async registerAuthority(actor: string, id: string, name: string, evidence: unknown) {
    if (!id.trim() || !name.trim() || !evidence) throw new Error('INVALID_AUTHORITY');
    await transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['source_approver', 'administrator']);
      await c.query('INSERT INTO authorities(id,name,evidence,created_by) VALUES($1,$2,$3,$4)', [
        id,
        name,
        JSON.stringify(evidence),
        actor,
      ]);
      await audit(c, actor, 'authority_registered', id, {});
    });
  }
  async register(actor: string, authorityId: string, input: unknown) {
    const bundle = SignedSourceSchema.parse(input);
    const config = bundle.config;
    const fp = configFingerprint(config);
    if (config.state === 'active') authorizeSource(bundle, await this.options.keys());
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['source_approver', 'administrator']);
      const authority = (
        await c.query('SELECT name FROM authorities WHERE id=$1 FOR SHARE', [authorityId])
      ).rows[0];
      if (
        !authority ||
        authority.name.normalize('NFC').trim() !== config.authority.normalize('NFC').trim()
      )
        throw new Error('ISSUER_BINDING_MISMATCH');
      await c.query(
        'INSERT INTO sources(id,authority_id) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',
        [config.id, authorityId],
      );
      const existing = (await c.query('SELECT * FROM sources WHERE id=$1 FOR UPDATE', [config.id]))
        .rows[0];
      if (existing.authority_id !== authorityId) throw new Error('ISSUER_REASSIGNMENT_DENIED');
      await c.query(
        'INSERT INTO source_config_versions(source_id,fingerprint,version,bundle) VALUES($1,$2,$3,$4) ON CONFLICT(source_id,fingerprint) DO NOTHING',
        [config.id, fp, config.version, JSON.stringify(bundle)],
      );
      const stored = (
        await c.query(
          'SELECT bundle FROM source_config_versions WHERE source_id=$1 AND fingerprint=$2',
          [config.id, fp],
        )
      ).rows[0];
      if (canonical(SignedSourceSchema.parse(stored.bundle)) !== canonical(bundle))
        throw new Error('CONFIG_VERSION_IMMUTABLE');
      if (existing.current_fingerprint && existing.current_fingerprint !== fp) {
        await c.query(
          "UPDATE stage_runs SET state='blocked',lease_token=NULL,lease_until=NULL,error_code='SOURCE_CONFIG_STALE' WHERE run_id IN(SELECT id FROM source_runs WHERE source_id=$1 AND state IN('queued','running')) AND state IN('queued','retry','running')",
          [config.id],
        );
        await c.query(
          "UPDATE source_runs SET state='blocked',finished_at=clock_timestamp() WHERE source_id=$1 AND state IN('queued','running')",
          [config.id],
        );
      }
      // Re-registering a signed version cannot silently clear an emergency pause.
      await c.query(
        'UPDATE sources SET current_fingerprint=$2,control_epoch=control_epoch+1 WHERE id=$1',
        [config.id, fp],
      );
      await c.query(
        'INSERT INTO source_policy_reviews(id,source_id,fingerprint,actor_id,decision) VALUES($1,$2,$3,$4,$5)',
        [
          randomUUID(),
          config.id,
          fp,
          actor,
          JSON.stringify({
            collection: config.collection,
            display: config.display,
            retention: config.retention ?? null,
          }),
        ],
      );
      await audit(c, actor, 'source_config_registered', config.id, { fingerprint: fp });
      return fp;
    });
  }
  async controls(
    actor: string,
    id: string,
    input: {
      collectionHalted: boolean;
      displayHalted: boolean;
      reason: string;
      expectedEpoch: number;
    },
  ) {
    if (!input.reason.trim()) throw new Error('REASON_REQUIRED');
    await transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['source_approver', 'administrator']);
      const row = await sourceRow(c, id, true);
      if (row.control_epoch !== input.expectedEpoch) throw new Error('SOURCE_CONTROL_CONFLICT');
      if (!input.collectionHalted) authorizeSource(row.bundle, await this.options.keys());
      if (!input.displayHalted) {
        const config = authorizeSource(
          row.bundle,
          await this.options.keys(),
          new Date(),
          'display',
        );
        if (config.display !== 'permitted') throw new Error('FULL_DISPLAY_NOT_PERMITTED');
      }
      await c.query(
        'UPDATE sources SET collection_halted=$2,display_halted=$3,reason=$4,control_epoch=control_epoch+1 WHERE id=$1',
        [id, input.collectionHalted, input.displayHalted, input.reason],
      );
      if (input.collectionHalted)
        await c.query(
          "UPDATE stage_runs SET state='blocked',lease_token=NULL,lease_until=NULL,error_code='SOURCE_HALTED' WHERE run_id IN(SELECT id FROM source_runs WHERE source_id=$1) AND state IN('queued','retry','running')",
          [id],
        );
      if (input.collectionHalted)
        await c.query(
          "UPDATE source_runs SET state='blocked',finished_at=clock_timestamp() WHERE source_id=$1 AND state IN('queued','running')",
          [id],
        );
      await audit(c, actor, 'source_controls', id, input);
      if (input.displayHalted)
        await c.query(
          "INSERT INTO outbox_events(id,dedupe_key,topic,payload) VALUES($1,$2,'suppression',$3)",
          [
            randomUUID(),
            `source:${id}:${row.control_epoch + 1}`,
            JSON.stringify({ sourceId: id, displayHalted: true }),
          ],
        );
    });
  }
  async current(id: string): Promise<SignedSource> {
    return transaction(this.options.pool, async (c) =>
      SignedSourceSchema.parse((await gate(c, this.options, id, 'collection')).row.bundle),
    );
  }
  async schedule(actor: string, id: string, reason = 'scheduled', inputKey = 'discovery') {
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['operator', 'administrator']);
      const { row } = await gate(c, this.options, id, 'collection', undefined, true);
      const active = await c.query(
        "SELECT id FROM source_runs WHERE source_id=$1 AND state IN('queued','running')",
        [id],
      );
      if (active.rows[0]) return active.rows[0].id as string;
      const runId = randomUUID();
      await c.query(
        "INSERT INTO source_runs(id,source_id,fingerprint,state) VALUES($1,$2,$3,'queued')",
        [runId, id, row.current_fingerprint],
      );
      const payload = StageJobSchema.parse({
        schemaVersion: 1,
        runId,
        sourceId: id,
        fingerprint: row.current_fingerprint,
        stage: 'discover',
        inputKey,
        generation: 0,
      });
      await insertStage(c, stageId(payload), payload);
      await c.query(
        "UPDATE sources SET next_due=clock_timestamp()+interval_seconds*interval '1 second' WHERE id=$1",
        [id],
      );
      await audit(c, actor, 'run_scheduled', runId, { sourceId: id, reason });
      return runId;
    });
  }
  async due(actor: string) {
    const ids = (
      await this.options.pool.query(
        'SELECT id FROM sources WHERE next_due<=clock_timestamp() AND not_before<=clock_timestamp() AND NOT collection_halted ORDER BY next_due LIMIT 20',
      )
    ).rows as { id: string }[];
    const scheduled: string[] = [];
    const blocked: Array<{ sourceId: string; code: string }> = [];
    for (const row of ids) {
      try {
        scheduled.push(await this.schedule(actor, row.id));
      } catch (error) {
        if (
          error instanceof SourcePolicyError ||
          (error instanceof Error && error.message === 'SOURCE_HALTED')
        )
          blocked.push({
            sourceId: row.id,
            code: error instanceof SourcePolicyError ? error.code : 'SOURCE_HALTED',
          });
        else throw error;
      }
    }
    return { scheduled, blocked };
  }
}
