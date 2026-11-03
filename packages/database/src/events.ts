import { randomUUID } from 'node:crypto';
import {
  LocatedEvidenceSchema,
  EventKindSchema,
  DocumentTextSchema,
  type LocatedEvidence,
  type EventKind,
} from '@uttirno/contracts';
import { isCriticalEvent, verifyDocument } from '@uttirno/domain';
import { transaction, requireRole, audit, gate, type DatabaseOptions } from './shared.js';
export class EventRepository {
  constructor(private readonly options: DatabaseOptions) {}
  async record(
    actor: string,
    input: {
      circularId: string;
      kind: EventKind;
      targets: string[];
      textVersion: string;
      evidence: LocatedEvidence;
      reason: string;
    },
  ) {
    EventKindSchema.parse(input.kind);
    const evidence = LocatedEvidenceSchema.parse(input.evidence);
    if (
      !input.reason.trim() ||
      !input.targets.length ||
      input.targets.length > 1000 ||
      new Set(input.targets).size !== input.targets.length
    )
      throw new Error('INVALID_EVENT');
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['operator', 'administrator']);
      const stored = (
        await c.query('SELECT document FROM artifact_text_versions WHERE text_version=$1', [
          input.textVersion,
        ])
      ).rows[0];
      if (!stored) throw new Error('DOCUMENT_NOT_PERSISTED');
      const doc = verifyDocument(DocumentTextSchema.parse(stored.document));
      const { row, config } = await gate(
        c,
        this.options,
        doc.sourceId,
        'collection',
        doc.configFingerprint,
        true,
      );
      const circular = (
        await c.query('SELECT * FROM circulars WHERE id=$1 FOR UPDATE', [input.circularId])
      ).rows[0];
      if (!circular || circular.authority_id !== row.authority_id)
        throw new Error('EVENT_ISSUER_MISMATCH');
      const page = doc.pages.find((p) => p.page === evidence.page);
      if (
        evidence.sourceId !== doc.sourceId ||
        evidence.textVersion !== doc.textVersion ||
        evidence.artifactSha256 !== doc.artifactSha256 ||
        !page ||
        evidence.start >= evidence.end ||
        page.text.slice(evidence.start, evidence.end) !== evidence.quote
      )
        throw new Error('EVENT_EVIDENCE_MISMATCH');
      const targets = await c.query(
        'SELECT id,post_key FROM positions WHERE circular_id=$1 AND id=ANY($2::uuid[]) ORDER BY post_key',
        [input.circularId, input.targets],
      );
      if (targets.rowCount !== input.targets.length) throw new Error('EVENT_TARGET_SCOPE_MISMATCH');
      const label = config.eventLabels?.[input.kind];
      if (
        !label ||
        evidence.quote !== `${label}: ${targets.rows.map((r) => r.post_key).join(', ')}`
      )
        throw new Error('EVENT_MEANING_NOT_VERIFIED');
      const duplicate = (
        await c.query(
          "SELECT id FROM recruitment_events WHERE circular_id=$1 AND kind=$2 AND text_version=$3 AND targets=$4::uuid[] AND state<>'rejected'",
          [input.circularId, input.kind, input.textVersion, [...input.targets].sort()],
        )
      ).rows[0];
      if (duplicate) return duplicate.id as string;
      const id = randomUUID();
      await c.query(
        'INSERT INTO recruitment_events(id,circular_id,kind,targets,evidence,text_version,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          id,
          input.circularId,
          input.kind,
          [...input.targets].sort(),
          JSON.stringify(evidence),
          input.textVersion,
          actor,
        ],
      );
      if (isCriticalEvent(input.kind)) {
        await c.query(
          'UPDATE published_positions SET suppressed=true,reason=$2 WHERE position_id=ANY($1::uuid[])',
          [input.targets, `PENDING_${input.kind.toUpperCase()}`],
        );
        await c.query(
          "INSERT INTO outbox_events(id,dedupe_key,topic,payload) VALUES($1,$2,'suppression',$3)",
          [
            randomUUID(),
            `event:${id}`,
            JSON.stringify({ eventId: id, positionIds: input.targets }),
          ],
        );
      }
      await audit(c, actor, 'event_recorded', id, {
        kind: input.kind,
        reason: input.reason,
        targets: input.targets,
      });
      return id;
    });
  }
  async decide(
    actor: string,
    id: string,
    decision: 'approved' | 'rejected',
    reason: string,
    attestation?: { textVersion: string; acceptedQualityPages: number[] },
  ) {
    if (!reason.trim() || !['approved', 'rejected'].includes(decision))
      throw new Error('INVALID_EVENT_DECISION');
    await transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['reviewer', 'administrator']);
      const event = (await c.query('SELECT * FROM recruitment_events WHERE id=$1', [id])).rows[0];
      if (!event) throw new Error('EVENT_NOT_FOUND');
      if (decision === 'approved') {
        const stored = (
          await c.query('SELECT document FROM artifact_text_versions WHERE text_version=$1', [
            event.text_version,
          ])
        ).rows[0];
        const doc = verifyDocument(DocumentTextSchema.parse(stored?.document));
        await gate(c, this.options, doc.sourceId, 'display', doc.configFingerprint, true);
        if (
          attestation?.textVersion !== doc.textVersion ||
          doc.pages.some(
            (p) => p.flags.length && !attestation.acceptedQualityPages.includes(p.page),
          )
        )
          throw new Error('EVENT_DOCUMENT_REVIEW_REQUIRED');
      }
      await c.query('SELECT id FROM circulars WHERE id=$1 FOR UPDATE', [event.circular_id]);
      const current = (
        await c.query('SELECT * FROM recruitment_events WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      if (current.state !== 'pending') throw new Error('EVENT_REVIEW_CONFLICT');
      if (current.created_by === actor) throw new Error('TWO_PERSON_REVIEW_REQUIRED');
      if (decision === 'approved' && ['amendment', 'extension'].includes(current.kind))
        throw new Error('REPLACEMENT_REVISION_REQUIRED');
      if (decision === 'approved' && current.kind === 'cancellation')
        await c.query(
          "UPDATE positions SET recruitment_state='cancelled' WHERE id=ANY($1::uuid[])",
          [current.targets],
        );
      await c.query('UPDATE recruitment_events SET state=$2,resolved_by=$3 WHERE id=$1', [
        id,
        decision,
        actor,
      ]);
      await audit(c, actor, 'event_reviewed', id, { decision, reason });
    });
  }
  async restore(
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
          'SELECT p.*,r.source_id,r.fingerprint,r.circular_id,r.created_by,r.generation FROM published_positions p JOIN circular_revisions r ON r.id=p.circular_revision_id WHERE p.position_id=$1',
          [positionId],
        )
      ).rows[0];
      if (!initial) throw new Error('POSITION_NOT_PUBLISHED');
      await gate(c, this.options, initial.source_id, 'display', initial.fingerprint, true);
      const circular = (
        await c.query('SELECT generation FROM circulars WHERE id=$1 FOR UPDATE', [
          initial.circular_id,
        ])
      ).rows[0];
      const published = (
        await c.query('SELECT * FROM published_positions WHERE position_id=$1 FOR UPDATE', [
          positionId,
        ])
      ).rows[0];
      if (
        published.revision_id !== expectedRevision ||
        circular.generation !== expectedGeneration ||
        initial.generation !== expectedGeneration
      )
        throw new Error('STALE_RESTORE');
      if (initial.created_by === actor) throw new Error('TWO_PERSON_REVIEW_REQUIRED');
      if (
        (
          await c.query(
            "SELECT 1 FROM recruitment_events WHERE $1=ANY(targets) AND kind IN('amendment','extension','cancellation') AND state='pending'",
            [positionId],
          )
        ).rowCount ||
        (
          await c.query("SELECT 1 FROM positions WHERE id=$1 AND recruitment_state='cancelled'", [
            positionId,
          ])
        ).rowCount
      )
        throw new Error('CRITICAL_EVENT_REVIEW_REQUIRED');
      const actionId = randomUUID();
      await c.query(
        "INSERT INTO review_actions(id,circular_revision_id,actor_id,action,reason,expected_generation) VALUES($1,$2,$3,'restored',$4,$5)",
        [actionId, initial.circular_revision_id, actor, reason, expectedGeneration],
      );
      await c.query(
        'UPDATE published_positions SET suppressed=false,reason=NULL,review_action_id=$2 WHERE position_id=$1',
        [positionId, actionId],
      );
      await audit(c, actor, 'position_restored', positionId, { expectedRevision, reason });
      await c.query(
        "INSERT INTO outbox_events(id,dedupe_key,topic,payload) VALUES($1,$2,'publication',$3)",
        [randomUUID(), `restore:${actionId}`, JSON.stringify({ positionId })],
      );
    });
  }
}
