import {
  AdminReviewSnapshotSchema,
  RevisionBundleSchema,
  InventorySchema,
  DocumentTextSchema,
  type Role,
} from '@uttirno/contracts';
import { transaction, requireRole, digest, type DatabaseOptions } from './shared.js';
import { authorizeSource, SignedSourceSchema } from '@uttirno/source-config';
const readers: Role[] = ['operator', 'reviewer', 'source_approver', 'administrator'];
export class AdminReadRepository {
  constructor(private readonly options: DatabaseOptions) {}
  async list(
    actor: string,
    resource: 'sources' | 'runs' | 'revisions' | 'duplicates' | 'events' | 'audit' | 'stages',
    after: string | null,
    limit: number,
  ) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('INVALID_LIMIT');
    const specs = {
      sources:
        'SELECT id,authority_id,current_fingerprint,collection_halted,display_halted,control_epoch,reason,next_due,last_checked,last_success FROM sources',
      runs: 'SELECT id,source_id,fingerprint,state,inventory,created_at,finished_at,request_count,total_bytes FROM source_runs',
      revisions:
        'SELECT id,circular_id,generation,source_id,fingerprint,created_by,parent_id,created_at FROM circular_revisions',
      duplicates:
        'SELECT id,source_id,run_id,reason,resolved_by,resolution,created_at FROM duplicate_candidates',
      events:
        'SELECT id,circular_id,kind,targets,state,text_version,created_by,resolved_by,resolved_revision,created_at FROM recruitment_events',
      audit: 'SELECT id,actor_id,action,entity_id,details,created_at FROM audit_events',
      stages:
        'SELECT id,run_id,payload,state,attempts,max_attempts,available_at,lease_until,checkpoint,error_code,updated_at FROM stage_runs',
    } as const;
    const sql = specs[resource];
    if (!sql) throw new Error('UNKNOWN_RESOURCE');
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, resource === 'audit' ? ['administrator'] : readers);
      const rows = (
        await c.query(`${sql} WHERE ($1::text IS NULL OR id::text>$1) ORDER BY id::text LIMIT $2`, [
          after,
          limit + 1,
        ])
      ).rows;
      return {
        items: rows.slice(0, limit),
        next: rows.length > limit ? (rows[limit - 1]?.id as string) : null,
      };
    });
  }
  async source(actor: string, id: string) {
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, readers);
      const row = (
        await c.query(
          'SELECT s.*,v.bundle FROM sources s JOIN source_config_versions v ON v.source_id=s.id AND v.fingerprint=s.current_fingerprint WHERE s.id=$1',
          [id],
        )
      ).rows[0];
      return row ?? null;
    });
  }
  async review(actor: string, id: string) {
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['reviewer', 'administrator']);
      const row = (await c.query('SELECT * FROM circular_revisions WHERE id=$1', [id])).rows[0];
      if (!row) return null;
      const bundle = RevisionBundleSchema.parse(row.bundle),
        inventory = InventorySchema.parse(row.inventory);
      const versions = [...bundle.entries.map((e) => e.textVersion), ...bundle.supportingDocuments];
      const documents = [];
      for (const version of versions) {
        const document = await this.document(actor, version);
        if (!document) throw new Error('RETENTION_NOT_PERMITTED');
        documents.push(document);
      }
      return AdminReviewSnapshotSchema.parse({
        id: row.id,
        generation: row.generation,
        sourceId: row.source_id,
        createdBy: row.created_by,
        bundle,
        inventory,
        documents,
        attestation: {
          bundleDigest: digest(bundle),
          inventoryDigest: digest(inventory),
          textVersions: versions,
          acceptedQualityPages: {},
          supportingReviews: {},
        },
      });
    });
  }
  async document(actor: string, version: string) {
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, readers);
      const row = (
        await c.query(
          `SELECT t.document FROM artifact_text_versions t WHERE text_version=$1 AND EXISTS(
      SELECT 1 FROM artifact_captures a WHERE a.sha256=t.document->>'artifactSha256' AND a.source_id=t.document->>'sourceId' AND a.fingerprint=t.document->>'configFingerprint' AND a.expires_at>clock_timestamp())`,
          [version],
        )
      ).rows[0];
      if (!row) return null;
      const doc = DocumentTextSchema.parse(row.document);
      const source = (
        await c.query(
          'SELECT v.bundle,s.collection_halted,s.display_halted FROM sources s JOIN source_config_versions v ON v.source_id=s.id AND v.fingerprint=s.current_fingerprint WHERE s.id=$1',
          [doc.sourceId],
        )
      ).rows[0];
      if (!source || (source.collection_halted && source.display_halted))
        throw new Error('RETENTION_NOT_PERMITTED');
      const config = authorizeSource(
        SignedSourceSchema.parse(source?.bundle),
        await this.options.keys(),
      );
      if (!config.retention || Date.parse(config.retention.expiresAt) <= Date.now())
        throw new Error('RETENTION_NOT_PERMITTED');
      return doc;
    });
  }
}
