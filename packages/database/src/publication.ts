import { randomUUID } from 'node:crypto';
import { RevisionBundleSchema, InventorySchema, type DocumentText } from '@uttirno/contracts';
import { verifyExtraction } from '@uttirno/domain';
import { assertSourceUrl } from '@uttirno/source-config';
import { bundleDocuments } from './revisions.js';
import { transaction, requireRole, audit, gate, digest, type DatabaseOptions } from './shared.js';
export type ReviewAttestation = {
  bundleDigest: string;
  inventoryDigest: string;
  textVersions: string[];
  acceptedQualityPages: Record<string, number[]>;
  supportingReviews: Record<string, string>;
};
function sameSet(a: string[], b: string[]) {
  return (
    a.length === new Set(a).size &&
    b.length === new Set(b).size &&
    a.length === b.length &&
    a.every((v) => b.includes(v))
  );
}
export class PublicationRepository {
  constructor(private readonly options: DatabaseOptions) {}
  async approve(
    actor: string,
    id: string,
    expectedGeneration: number,
    attestation: ReviewAttestation,
    reason: string,
    resolves: string[] = [],
  ) {
    if (!reason.trim()) throw new Error('REASON_REQUIRED');
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['reviewer', 'administrator']);
      const revision = (await c.query('SELECT * FROM circular_revisions WHERE id=$1', [id]))
        .rows[0];
      if (!revision) throw new Error('REVISION_NOT_FOUND');
      const { config } = await gate(
        c,
        this.options,
        revision.source_id,
        'display',
        revision.fingerprint,
        true,
      );
      const circular = (
        await c.query('SELECT * FROM circulars WHERE id=$1 FOR UPDATE', [revision.circular_id])
      ).rows[0];
      if (circular.generation !== expectedGeneration || revision.generation !== expectedGeneration)
        throw new Error('STALE_REVIEW');
      if (revision.created_by === actor) throw new Error('TWO_PERSON_REVIEW_REQUIRED');
      if (
        (
          await c.query(
            "SELECT 1 FROM review_actions WHERE circular_revision_id=$1 AND action IN('approved','rejected')",
            [id],
          )
        ).rowCount
      )
        throw new Error('REVISION_ALREADY_REVIEWED');
      const bundle = RevisionBundleSchema.parse(revision.bundle),
        inventory = InventorySchema.parse(revision.inventory);
      const docs = await bundleDocuments(c, bundle, revision.source_id, revision.fingerprint);
      if (
        attestation.bundleDigest !== digest(bundle) ||
        attestation.inventoryDigest !== digest(inventory) ||
        !sameSet(attestation.textVersions, [...docs.keys()])
      )
        throw new Error('REVIEW_ATTESTATION_MISMATCH');
      if (bundle.supportingDocuments.some((v) => !attestation.supportingReviews[v]?.trim()))
        throw new Error('SUPPORTING_DOCUMENT_REVIEW_REQUIRED');
      for (const version of bundle.supportingDocuments) {
        const doc = docs.get(version);
        if (
          !doc ||
          doc.pages.some(
            (p) => p.flags.length && !attestation.acceptedQualityPages[version]?.includes(p.page),
          )
        )
          throw new Error('DOCUMENT_QUALITY_REVIEW_REQUIRED');
      }
      if (
        !sameSet(
          inventory.artifactHashes,
          [...docs.values()].map((d) => d.artifactSha256),
        )
      )
        throw new Error('INCOMPLETE_ATTACHMENT_COVERAGE');
      const postKeys = (
        await c.query(
          'SELECT p.post_key FROM positions p JOIN position_revisions r ON r.position_id=p.id WHERE r.circular_revision_id=$1',
          [id],
        )
      ).rows.map((r) => r.post_key as string);
      if (!sameSet(postKeys, inventory.positionKeys))
        throw new Error('INCOMPLETE_POSITION_COVERAGE');
      const run = (
        await c.query('SELECT inventory FROM source_runs WHERE id=$1 FOR SHARE', [revision.run_id])
      ).rows[0];
      const manifest = run?.inventory as { complete: boolean; documentUrls: string[] } | null;
      if (!manifest?.complete || !manifest.documentUrls?.length)
        throw new Error('DISCOVERY_INCOMPLETE');
      const captures = await c.query(
        'SELECT url,sha256 FROM artifact_captures WHERE source_id=$1 AND fingerprint=$2 AND expires_at>clock_timestamp() AND sha256=ANY($3::text[]) AND url=ANY($4::text[])',
        [revision.source_id, revision.fingerprint, inventory.artifactHashes, manifest.documentUrls],
      );
      if (!sameSet([...new Set(captures.rows.map((r) => r.url as string))], manifest.documentUrls))
        throw new Error('DISCOVERY_ATTACHMENT_COVERAGE_MISMATCH');
      for (const document of docs.values())
        if (!captures.rows.some((r) => r.sha256 === document.artifactSha256))
          throw new Error('ARTIFACT_RETENTION_EXPIRED');
      for (const entry of bundle.entries) {
        const document = docs.get(entry.textVersion) as DocumentText;
        const result = verifyExtraction(
          document,
          entry.plan,
          entry.positions,
          {
            expectedArtifacts: inventory.artifactHashes,
            inspectedArtifacts: [...docs.values()].map((d) => d.artifactSha256),
            expectedPositions: entry.plan.positions.map((p) => p.id),
            scopeReview: {
              textVersion: document.textVersion,
              plan: entry.plan,
              reviewedBy: actor,
              acceptedQualityPages: attestation.acceptedQualityPages[document.textVersion] ?? [],
            },
          },
          (url) => {
            try {
              assertSourceUrl(config, url);
              return true;
            } catch {
              return false;
            }
          },
        );
        if (!result.eligibleForReview)
          throw new Error(`VERIFICATION_FAILED:${result.errors.join(',')}`);
      }
      const pending = (
        await c.query(
          "SELECT * FROM recruitment_events WHERE circular_id=$1 AND state='pending' AND kind IN('amendment','extension','cancellation') FOR UPDATE",
          [revision.circular_id],
        )
      ).rows;
      if (
        !sameSet(
          resolves,
          pending.map((e) => e.id),
        ) ||
        pending.some((e) => e.kind === 'cancellation')
      )
        throw new Error('CRITICAL_EVENT_REVIEW_REQUIRED');
      for (const event of pending) {
        const corrected = (
          await c.query(
            'SELECT position_id FROM position_revisions WHERE circular_revision_id=$1 AND text_version=$2',
            [id, event.text_version],
          )
        ).rows.map((r) => r.position_id);
        if (!(event.targets as string[]).every((target) => corrected.includes(target)))
          throw new Error('CORRECTION_NOT_IN_REPLACEMENT_EVIDENCE');
      }
      if (
        (
          await c.query(
            "SELECT 1 FROM positions p JOIN position_revisions r ON r.position_id=p.id WHERE r.circular_revision_id=$1 AND p.recruitment_state='cancelled'",
            [id],
          )
        ).rowCount
      )
        throw new Error('CANCELLED_POSITION_CANNOT_REOPEN');
      const actionId = randomUUID();
      await c.query(
        "INSERT INTO review_actions(id,circular_revision_id,actor_id,action,reason,expected_generation,attestation) VALUES($1,$2,$3,'approved',$4,$5,$6)",
        [actionId, id, actor, reason, expectedGeneration, JSON.stringify(attestation)],
      );
      // Positions omitted from a reviewed complete replacement remain suppressed, never silently deleted.
      await c.query(
        "UPDATE recruitment_events SET state='approved',resolved_by=$2,resolved_revision=$3 WHERE id=ANY($1::uuid[])",
        [pending.map((event) => event.id), actor, id],
      );
      await c.query(
        "UPDATE published_positions SET suppressed=true,reason='OMITTED_FROM_REVIEWED_REVISION' WHERE position_id IN(SELECT id FROM positions WHERE circular_id=$1) AND position_id NOT IN(SELECT position_id FROM position_revisions WHERE circular_revision_id=$2)",
        [revision.circular_id, id],
      );
      const values = await c.query(
        'SELECT id,position_id FROM position_revisions WHERE circular_revision_id=$1',
        [id],
      );
      for (const value of values.rows)
        await c.query(
          'INSERT INTO published_positions(position_id,revision_id,circular_revision_id,review_action_id) VALUES($1,$2,$3,$4) ON CONFLICT(position_id) DO UPDATE SET revision_id=excluded.revision_id,circular_revision_id=excluded.circular_revision_id,review_action_id=excluded.review_action_id,suppressed=false,reason=NULL,published_at=clock_timestamp()',
          [value.position_id, value.id, id, actionId],
        );
      await audit(c, actor, 'revision_approved', id, { expectedGeneration, resolves });
      await c.query(
        "INSERT INTO outbox_events(id,dedupe_key,topic,payload) VALUES($1,$2,'publication',$3)",
        [
          randomUUID(),
          `publication:${id}`,
          JSON.stringify({ revisionId: id, positionIds: values.rows.map((v) => v.position_id) }),
        ],
      );
      await gate(c, this.options, revision.source_id, 'display', revision.fingerprint); // re-read external trust before commit
      return { revisionId: id, actionId };
    });
  }
  async reject(actor: string, id: string, expectedGeneration: number, reason: string) {
    if (!reason.trim()) throw new Error('REASON_REQUIRED');
    await transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['reviewer', 'administrator']);
      const revision = (await c.query('SELECT * FROM circular_revisions WHERE id=$1', [id]))
        .rows[0];
      if (!revision) throw new Error('REVISION_NOT_FOUND');
      const circular = (
        await c.query('SELECT generation FROM circulars WHERE id=$1 FOR UPDATE', [
          revision.circular_id,
        ])
      ).rows[0];
      if (circular.generation !== expectedGeneration || revision.generation !== expectedGeneration)
        throw new Error('STALE_REVIEW');
      if (revision.created_by === actor) throw new Error('TWO_PERSON_REVIEW_REQUIRED');
      if (
        (
          await c.query(
            "SELECT 1 FROM review_actions WHERE circular_revision_id=$1 AND action IN('approved','rejected')",
            [id],
          )
        ).rowCount
      )
        throw new Error('REVISION_ALREADY_REVIEWED');
      await c.query(
        "INSERT INTO review_actions(id,circular_revision_id,actor_id,action,reason,expected_generation) VALUES($1,$2,$3,'rejected',$4,$5)",
        [randomUUID(), id, actor, reason, expectedGeneration],
      );
      await audit(c, actor, 'revision_rejected', id, { reason });
    });
  }
  async publicPositions() {
    return transaction(this.options.pool, async (c) => {
      const rows = (
        await c.query(
          'SELECT position_id,revision_id,value,source_id,published_at FROM public_positions ORDER BY position_id LIMIT 1000',
        )
      ).rows;
      const result = [];
      for (const row of rows) {
        try {
          await gate(c, this.options, row.source_id, 'display');
          result.push({
            positionId: row.position_id,
            revisionId: row.revision_id,
            value: row.value,
            publishedAt: row.published_at,
          });
        } catch {
          /* Invalid current signature/policy never becomes a public row. */
        }
      }
      return result;
    });
  }
  async suppress(
    actor: string,
    positionId: string,
    expectedRevision: string,
    expectedGeneration: number,
    reason: string,
  ) {
    if (!reason.trim()) throw new Error('REASON_REQUIRED');
    await transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['reviewer', 'administrator']);
      const initial = (
        await c.query(
          'SELECT p.*,r.source_id,r.circular_id FROM published_positions p JOIN circular_revisions r ON r.id=p.circular_revision_id WHERE p.position_id=$1',
          [positionId],
        )
      ).rows[0];
      if (!initial) throw new Error('POSITION_NOT_PUBLISHED');
      await c.query('SELECT id FROM sources WHERE id=$1 FOR UPDATE', [initial.source_id]);
      const circular = (
        await c.query('SELECT generation FROM circulars WHERE id=$1 FOR UPDATE', [
          initial.circular_id,
        ])
      ).rows[0];
      const current = (
        await c.query('SELECT * FROM published_positions WHERE position_id=$1 FOR UPDATE', [
          positionId,
        ])
      ).rows[0];
      if (circular.generation !== expectedGeneration || current.revision_id !== expectedRevision)
        throw new Error('STALE_REVIEW');
      await c.query(
        "INSERT INTO review_actions(id,circular_revision_id,actor_id,action,reason,expected_generation) VALUES($1,$2,$3,'suppressed',$4,$5)",
        [randomUUID(), initial.circular_revision_id, actor, reason, expectedGeneration],
      );
      await c.query(
        'UPDATE published_positions SET suppressed=true,reason=$2 WHERE position_id=$1',
        [positionId, reason],
      );
      await audit(c, actor, 'position_suppressed', positionId, { expectedRevision, reason });
      await c.query(
        "INSERT INTO outbox_events(id,dedupe_key,topic,payload) VALUES($1,$2,'suppression',$3)",
        [randomUUID(), `manual-suppression:${randomUUID()}`, JSON.stringify({ positionId })],
      );
    });
  }
}
