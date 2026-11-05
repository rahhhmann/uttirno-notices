import {
  AdminReviewSnapshotSchema,
  RevisionBundleSchema,
  InventorySchema,
  DocumentTextSchema,
  type Role,
} from '@uttirno/contracts';
import { transaction, requireRole, digest, type DatabaseOptions } from './shared.js';
import { authorizeSource, SignedSourceSchema, assertSourceUrl } from '@uttirno/source-config';
const readers: Role[] = ['operator', 'reviewer', 'source_approver', 'administrator'];
export class AdminReadRepository {
  constructor(private readonly options: DatabaseOptions) {}
  async assessment(actor: string, id: string) {
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, readers);
      const row = (
        await c.query(
          'SELECT s.*,v.bundle FROM sources s JOIN source_config_versions v ON v.source_id=s.id AND v.fingerprint=s.current_fingerprint WHERE s.id=$1',
          [id],
        )
      ).rows[0];
      if (!row) return null;
      const inspect = async (purpose: 'collection' | 'display') => {
        try {
          const config = authorizeSource(
            row.bundle,
            await this.options.keys(),
            new Date(),
            purpose,
          );
          if (purpose === 'display' && config.display !== 'permitted')
            throw new Error('FULL_DISPLAY_NOT_PERMITTED');
          return { allowed: true, code: 'PERMITTED' };
        } catch (error) {
          if (
            error instanceof Error &&
            /^(SOURCE_|COLLECTION_|DISPLAY_|FULL_DISPLAY_|RETENTION_|UNTRUSTED_|INVALID_|EXPIRED_|MISSING_|APPROVAL_|POLICY_|RETRY_)/.test(
              error.message,
            )
          )
            return { allowed: false, code: error.message };
          // Policy errors have an explicit safe machine code; storage failures must not become approvals.
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            typeof error.code === 'string' &&
            /^[A-Z_]+$/.test(error.code)
          )
            return { allowed: false, code: error.code };
          throw error;
        }
      };
      const history = (
        await c.query(
          'SELECT fingerprint,version,created_at FROM source_config_versions WHERE source_id=$1 ORDER BY created_at DESC LIMIT 50',
          [id],
        )
      ).rows;
      return {
        id,
        authorityId: row.authority_id,
        fingerprint: row.current_fingerprint,
        epoch: row.control_epoch,
        collectionHalted: row.collection_halted,
        displayHalted: row.display_halted,
        collection: await inspect('collection'),
        display: await inspect('display'),
        bundle: row.bundle,
        history,
      };
    });
  }
  async context(actor: string, id: string) {
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['reviewer', 'administrator']);
      const revision = (
        await c.query(
          'SELECT r.*,c.generation AS current_generation FROM circular_revisions r JOIN circulars c ON c.id=r.circular_id WHERE r.id=$1',
          [id],
        )
      ).rows[0];
      if (!revision) return null;
      const actions = (
        await c.query(
          'SELECT id,actor_id,action,reason,expected_generation,created_at FROM review_actions WHERE circular_revision_id=$1 ORDER BY created_at DESC LIMIT 100',
          [id],
        )
      ).rows;
      const decision = actions.find((a) => a.action === 'approved' || a.action === 'rejected');
      return {
        currentGeneration: revision.current_generation,
        state:
          revision.generation !== revision.current_generation
            ? 'superseded'
            : (decision?.action ?? 'draft'),
        actions,
        positions: await this.positions(c, revision.circular_id),
        events: (
          await c.query(
            'SELECT id,kind,targets,state,resolved_revision FROM recruitment_events WHERE circular_id=$1 ORDER BY created_at DESC LIMIT 200',
            [revision.circular_id],
          )
        ).rows,
      };
    });
  }
  private async positions(c: import('pg').PoolClient, circularId: string) {
    return (
      await c.query(
        'SELECT p.id,p.post_key AS "postKey",pp.revision_id AS "revisionId",c.generation,COALESCE(pp.suppressed,true) AS suppressed FROM positions p JOIN circulars c ON c.id=p.circular_id LEFT JOIN published_positions pp ON pp.position_id=p.id WHERE p.circular_id=$1 ORDER BY p.id LIMIT 1000',
        [circularId],
      )
    ).rows;
  }
  async case(actor: string, kind: 'duplicate' | 'event', id: string) {
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['reviewer', 'administrator']);
      const row = (
        await c.query(
          kind === 'duplicate'
            ? 'SELECT * FROM duplicate_candidates WHERE id=$1'
            : 'SELECT * FROM recruitment_events WHERE id=$1',
          [id],
        )
      ).rows[0];
      if (!row) return null;
      const bundle =
        kind === 'duplicate' ? RevisionBundleSchema.parse(row.payload.input.bundle) : null;
      const inventory =
        kind === 'duplicate' ? InventorySchema.parse(row.payload.input.inventory) : null;
      const versions = bundle
        ? [...bundle.entries.map((e) => e.textVersion), ...bundle.supportingDocuments]
        : [row.text_version];
      const documents = [];
      for (const version of versions) {
        const doc = await this.document(actor, version);
        if (!doc) throw new Error('RETENTION_NOT_PERMITTED');
        documents.push(doc);
      }
      const record =
        kind === 'duplicate'
          ? {
              id: row.id,
              sourceId: row.source_id,
              runId: row.run_id,
              reason: row.reason,
              creator: row.payload.creator,
              resolvedBy: row.resolved_by,
              resolution: row.resolution,
            }
          : {
              id: row.id,
              circularId: row.circular_id,
              kind: row.kind,
              targets: row.targets,
              state: row.state,
              evidence: row.evidence,
              creator: row.created_by,
              resolvedBy: row.resolved_by,
            };
      return {
        id,
        kind,
        record,
        bundle,
        inventory,
        documents,
        positions: kind === 'event' ? await this.positions(c, row.circular_id) : [],
      };
    });
  }
  async original(actor: string, version: string) {
    return transaction(this.options.pool, async (c) => {
      const doc = await this.document(actor, version);
      if (!doc) return null;
      const row = (
        await c.query(
          'SELECT a.*,b.media_type,b.size FROM artifact_captures a JOIN artifacts b ON b.sha256=a.sha256 WHERE a.source_id=$1 AND a.fingerprint=$2 AND a.sha256=$3 AND a.expires_at>clock_timestamp() ORDER BY a.captured_at DESC LIMIT 1',
          [doc.sourceId, doc.configFingerprint, doc.artifactSha256],
        )
      ).rows[0];
      if (!row) return null;
      const source = (
        await c.query(
          'SELECT v.bundle FROM sources s JOIN source_config_versions v ON v.source_id=s.id AND v.fingerprint=s.current_fingerprint WHERE s.id=$1',
          [doc.sourceId],
        )
      ).rows[0];
      assertSourceUrl(SignedSourceSchema.parse(source.bundle).config, row.url);
      return {
        textVersion: version,
        sha256: row.sha256,
        url: row.url,
        capturedAt: row.captured_at.toISOString(),
        mediaType: row.media_type,
        size: row.size,
        captureId: row.id,
      };
    });
  }
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
      revisions: `SELECT r.id,r.circular_id,r.generation,r.source_id,r.fingerprint,r.created_by,r.parent_id,r.created_at,CASE WHEN r.generation<c.generation THEN 'superseded' ELSE COALESCE((SELECT a.action FROM review_actions a WHERE a.circular_revision_id=r.id AND a.action IN('approved','rejected') ORDER BY a.created_at DESC LIMIT 1),'draft') END AS state FROM circular_revisions r JOIN circulars c ON c.id=r.circular_id`,
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
        await c.query(
          `SELECT * FROM (${sql}) inventory WHERE ($1::text IS NULL OR id::text>$1) ORDER BY id::text LIMIT $2`,
          [after, limit + 1],
        )
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
