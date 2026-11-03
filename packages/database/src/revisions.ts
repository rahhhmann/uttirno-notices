import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  DocumentTextSchema,
  RevisionBundleSchema,
  InventorySchema,
  type RevisionBundle,
  type Inventory,
  type DocumentText,
  type PositionExtraction,
} from '@uttirno/contracts';
import { extractPositions, identityPart, verifyDocument } from '@uttirno/domain';
import { configFingerprint, canonical, type SourceConfig } from '@uttirno/source-config';
import {
  transaction,
  requireRole,
  audit,
  gate,
  digest,
  assertWriter,
  type WriteFence,
  type DatabaseOptions,
} from './shared.js';
export type DraftInput = {
  sourceId: string;
  runId: string;
  bundle: RevisionBundle;
  inventory: Inventory;
};
export async function bundleDocuments(
  client: PoolClient,
  bundle: RevisionBundle,
  sourceId: string,
  fp: string,
) {
  const docs = new Map<string, DocumentText>();
  for (const entry of bundle.entries) {
    if (docs.has(entry.textVersion)) throw new Error('DUPLICATE_DOCUMENT_ENTRY');
    const row = (
      await client.query('SELECT document FROM artifact_text_versions WHERE text_version=$1', [
        entry.textVersion,
      ])
    ).rows[0];
    if (!row) throw new Error('DOCUMENT_NOT_PERSISTED');
    const document = verifyDocument(DocumentTextSchema.parse(row.document));
    if (document.sourceId !== sourceId || document.configFingerprint !== fp)
      throw new Error('DOCUMENT_SOURCE_MISMATCH');
    const baseline = extractPositions(document, entry.plan);
    if (canonical(baseline) !== canonical(entry.positions))
      throw new Error('DRAFT_NOT_REPRODUCIBLE');
    docs.set(entry.textVersion, document);
  }
  for (const version of bundle.supportingDocuments) {
    if (docs.has(version)) throw new Error('DUPLICATE_DOCUMENT_ENTRY');
    const row = (
      await client.query('SELECT document FROM artifact_text_versions WHERE text_version=$1', [
        version,
      ])
    ).rows[0];
    if (!row) throw new Error('DOCUMENT_NOT_PERSISTED');
    const document = verifyDocument(DocumentTextSchema.parse(row.document));
    if (document.sourceId !== sourceId || document.configFingerprint !== fp)
      throw new Error('DOCUMENT_SOURCE_MISMATCH');
    docs.set(version, document);
  }
  return docs;
}
function memoFrom(documents: Map<string, DocumentText>, config: SourceConfig): string | null {
  const label = config.identityLabels?.memo;
  if (!label) return null;
  const values = new Set<string>();
  for (const doc of documents.values())
    for (const page of doc.pages)
      for (const line of page.text.split('\n'))
        if (line.startsWith(`${label}: `)) values.add(identityPart(line.slice(label.length + 2)));
  return values.size === 1 ? ([...values][0] ?? null) : null;
}
export class RevisionRepository {
  constructor(private readonly options: DatabaseOptions) {}
  async stage(actor: string, input: DraftInput, fence?: WriteFence) {
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['operator', 'administrator']);
      return this.store(c, actor, input, undefined, fence);
    });
  }
  private async store(
    c: PoolClient,
    creator: string,
    input: DraftInput,
    manual?: { memo: string; postKeys: Record<string, string> },
    fence?: WriteFence,
  ) {
    const bundle = RevisionBundleSchema.parse(input.bundle),
      inventory = InventorySchema.parse(input.inventory);
    const { row, config } = await gate(
      c,
      this.options,
      input.sourceId,
      'collection',
      undefined,
      true,
    );
    await assertWriter(c, input.sourceId, fence);
    const run = (await c.query('SELECT * FROM source_runs WHERE id=$1 FOR UPDATE', [input.runId]))
      .rows[0];
    const fp = configFingerprint(config);
    if (!run || run.source_id !== input.sourceId || run.fingerprint !== fp)
      throw new Error('RUN_SOURCE_MISMATCH');
    if (!run.inventory) throw new Error('DISCOVERY_INVENTORY_REQUIRED');
    const docs = await bundleDocuments(c, bundle, input.sourceId, fp);
    const memo = manual ? identityPart(manual.memo) : memoFrom(docs, config);
    const items = bundle.entries.flatMap((entry) =>
      entry.positions.map((position) => ({ entry, position })),
    );
    const keys = items.map(({ position }) => {
      const fact = position.fields.postCode;
      return (
        manual?.postKeys[position.positionId] ??
        (fact.status === 'stated' ? identityPart(fact.candidate.raw) : null)
      );
    });
    if (!memo || keys.some((v) => v === null) || new Set(keys).size !== keys.length) {
      const id = randomUUID();
      await c.query(
        'INSERT INTO duplicate_candidates(id,source_id,run_id,payload,reason) VALUES($1,$2,$3,$4,$5)',
        [
          id,
          input.sourceId,
          input.runId,
          JSON.stringify({ creator, input: { ...input, bundle, inventory } }),
          'AMBIGUOUS_ISSUER_MEMO_POST_IDENTITY',
        ],
      );
      await audit(c, creator, 'identity_review_required', id, { sourceId: input.sourceId });
      return { state: 'needs_identity_review' as const, candidateId: id };
    }
    const postKeys = keys.map((key) => identityPart(key ?? ''));
    const circularId = randomUUID();
    await c.query(
      'INSERT INTO circulars(id,authority_id,memo) VALUES($1,$2,$3) ON CONFLICT(authority_id,memo) DO NOTHING',
      [circularId, row.authority_id, memo],
    );
    const circular = (
      await c.query('SELECT * FROM circulars WHERE authority_id=$1 AND memo=$2 FOR UPDATE', [
        row.authority_id,
        memo,
      ])
    ).rows[0];
    const contentDigest = digest({ bundle, inventory, fp, memo, postKeys });
    const old = (
      await c.query(
        'SELECT id,generation FROM circular_revisions WHERE circular_id=$1 AND content_digest=$2',
        [circular.id, contentDigest],
      )
    ).rows[0];
    if (old)
      return {
        state: 'draft' as const,
        revisionId: old.id as string,
        generation: old.generation as number,
        replayed: true,
      };
    const generation = Number(circular.generation) + 1,
      id = randomUUID();
    const parent =
      (
        await c.query(
          'SELECT id FROM circular_revisions WHERE circular_id=$1 ORDER BY generation DESC LIMIT 1',
          [circular.id],
        )
      ).rows[0]?.id ?? null;
    await c.query(
      'INSERT INTO circular_revisions(id,circular_id,run_id,generation,source_id,fingerprint,inventory,bundle,created_by,parent_id,content_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [
        id,
        circular.id,
        input.runId,
        generation,
        input.sourceId,
        fp,
        JSON.stringify(inventory),
        JSON.stringify(bundle),
        creator,
        parent,
        contentDigest,
      ],
    );
    await c.query('UPDATE circulars SET generation=$2 WHERE id=$1', [circular.id, generation]);
    for (const [i, item] of items.entries()) {
      await c.query(
        'INSERT INTO positions(id,circular_id,post_key) VALUES($1,$2,$3) ON CONFLICT(circular_id,post_key) DO NOTHING',
        [randomUUID(), circular.id, postKeys[i]],
      );
      const positionId = (
        await c.query('SELECT id FROM positions WHERE circular_id=$1 AND post_key=$2', [
          circular.id,
          postKeys[i],
        ])
      ).rows[0].id;
      const revisionId = randomUUID();
      await c.query(
        'INSERT INTO position_revisions(id,position_id,circular_revision_id,text_version,value) VALUES($1,$2,$3,$4,$5)',
        [revisionId, positionId, id, item.entry.textVersion, JSON.stringify(item.position)],
      );
      await this.evidence(c, revisionId, item.position);
    }
    for (const doc of docs.values()) {
      const captures = await c.query(
        'SELECT url,sha256 FROM artifact_captures WHERE source_id=$1 AND fingerprint=$2 AND sha256=$3',
        [input.sourceId, fp, doc.artifactSha256],
      );
      for (const capture of captures.rows)
        await c.query(
          'INSERT INTO source_listings(source_id,url,sha256,circular_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [input.sourceId, capture.url, capture.sha256, circular.id],
        );
    }
    await audit(c, creator, 'draft_created', id, { generation, sourceId: input.sourceId });
    return { state: 'draft' as const, revisionId: id, generation, replayed: false };
  }
  private async evidence(c: PoolClient, id: string, position: PositionExtraction) {
    for (const [field, fact] of Object.entries(position.fields)) {
      const candidates =
        fact.status === 'stated'
          ? [fact.candidate]
          : fact.status === 'conflicting'
            ? fact.candidates
            : [];
      for (const [ordinal, candidate] of candidates.entries())
        await c.query(
          'INSERT INTO field_evidence(revision_id,field,ordinal,evidence) VALUES($1,$2,$3,$4)',
          [id, field, ordinal, JSON.stringify(candidate)],
        );
    }
    const route = position.fields.applicationUrl;
    if (route.status === 'stated')
      await c.query(
        'INSERT INTO application_routes(revision_id,destination,instructions) VALUES($1,$2,$3)',
        [
          id,
          route.candidate.normalized,
          JSON.stringify({
            steps: position.fields.applicationSteps,
            documents: position.fields.documents,
            fee: position.fields.fee,
            paymentDeadline: position.fields.paymentDeadline,
          }),
        ],
      );
  }
  async resolveIdentity(
    actor: string,
    id: string,
    decision: { memo: string; postKeys: Record<string, string>; reason: string },
  ) {
    if (!decision.reason.trim()) throw new Error('REASON_REQUIRED');
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['reviewer', 'administrator']);
      const candidate = (
        await c.query('SELECT * FROM duplicate_candidates WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      if (!candidate || candidate.resolved_by) throw new Error('IDENTITY_REVIEW_CONFLICT');
      if (candidate.payload.creator === actor) throw new Error('TWO_PERSON_REVIEW_REQUIRED');
      const result = await this.store(
        c,
        candidate.payload.creator,
        candidate.payload.input,
        decision,
      );
      if (result.state !== 'draft') throw new Error('IDENTITY_RESOLUTION_INCOMPLETE');
      await c.query('UPDATE duplicate_candidates SET resolved_by=$2,resolution=$3 WHERE id=$1', [
        id,
        actor,
        JSON.stringify(decision),
      ]);
      await audit(c, actor, 'identity_resolved', id, { decision, revisionId: result.revisionId });
      return result;
    });
  }
}
