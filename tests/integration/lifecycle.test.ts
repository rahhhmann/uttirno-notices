// biome-ignore-all lint/style/noNonNullAssertion: Synthetic records are checked before their IDs are used.
import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PublicReadRepository } from '@uttirno/database';
import { TaxonomySchema } from '@uttirno/contracts';
import { m4Context } from '../helpers/m4.js';
import type { DocumentText } from '@uttirno/contracts';
function evidence(doc: DocumentText, quote: string) {
  const start = doc.pages[0]!.text.indexOf(quote);
  if (start < 0) throw new Error('SYNTHETIC_QUOTE_MISSING');
  return {
    sourceId: doc.sourceId,
    artifactSha256: doc.artifactSha256,
    textVersion: doc.textVersion,
    scopeId: 'engineer',
    page: 1,
    start,
    end: start + quote.length,
    quote,
  };
}
async function publishedFixture() {
  const c = await m4Context(),
    item = await c.makeDocument(),
    run = await c.beginRun();
  const draft = await c.revisions.stage('operator', {
    sourceId: c.source.config.id,
    runId: run.runId,
    bundle: item.bundle,
    inventory: item.inventory,
  });
  if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
  await c.publication.approve(
    'reviewer',
    draft.revisionId,
    1,
    await c.attestation(item),
    'SYNTHETIC approved initial',
  );
  const circularId = (
    await c.database.pool.query('SELECT circular_id FROM circular_revisions WHERE id=$1', [
      draft.revisionId,
    ])
  ).rows[0].circular_id as string;
  const target = (await c.database.pool.query("SELECT id FROM positions WHERE post_key='SYN-ENG'"))
    .rows[0].id as string;
  return { c, item, run, draft, circularId, target };
}
it('R16/R17 scoped critical amendment suppresses affected old facts until a verified replacement resolves it', async () => {
  const f = await publishedFixture(),
    { c } = f;
  try {
    const updated = await c.makeDocument({ note: 'Amendment: SYN-ENG', deadline: '17/12/2026' });
    const eventId = await c.events.record('operator', {
      circularId: f.circularId,
      kind: 'amendment',
      targets: [f.target],
      textVersion: updated.doc.textVersion,
      evidence: evidence(updated.doc, 'Amendment: SYN-ENG'),
      reason: 'SYNTHETIC authority correction',
    });
    const visible = await c.publication.publicPositions();
    expect(visible).toHaveLength(1);
    expect(visible[0]?.positionId).not.toBe(f.target);
    await expect(
      c.events.decide('reviewer', eventId, 'approved', 'needs corrected revision', {
        textVersion: updated.doc.textVersion,
        acceptedQualityPages: [],
      }),
    ).rejects.toThrow('REPLACEMENT_REVISION_REQUIRED');
    const oldEvidence = structuredClone(f.item.bundle);
    oldEvidence.entries[0]!.plan.version = 'synthetic-reprocess-old-evidence-v2';
    const staleReplacement = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: f.run.runId,
      bundle: oldEvidence,
      inventory: f.item.inventory,
    });
    if (staleReplacement.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    const oldAttestation = await c.attestation({ ...f.item, bundle: oldEvidence });
    await expect(
      c.publication.approve(
        'reviewer',
        staleReplacement.revisionId,
        staleReplacement.generation,
        oldAttestation,
        'cannot clear correction with old document',
        [eventId],
      ),
    ).rejects.toThrow('CORRECTION_NOT_IN_REPLACEMENT_EVIDENCE');
    const replacement = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: f.run.runId,
      bundle: updated.bundle,
      inventory: updated.inventory,
    });
    if (replacement.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    await expect(
      c.publication.approve(
        'reviewer',
        replacement.revisionId,
        replacement.generation,
        await c.attestation(updated),
        'not yet linked',
      ),
    ).rejects.toThrow('CRITICAL_EVENT_REVIEW_REQUIRED');
    await c.publication.approve(
      'reviewer',
      replacement.revisionId,
      replacement.generation,
      await c.attestation(updated),
      'SYNTHETIC original correction reviewed',
      [eventId],
    );
    expect(await c.publication.publicPositions()).toHaveLength(2);
    expect(
      (
        await c.database.pool.query(
          'SELECT state,resolved_revision FROM recruitment_events WHERE id=$1',
          [eventId],
        )
      ).rows[0],
    ).toMatchObject({ state: 'approved', resolved_revision: replacement.revisionId });
  } finally {
    await c.close();
  }
});
it('R13/R16 wrong-meaning event quotes fail; rejecting a cancellation requires explicit versioned restore', async () => {
  const f = await publishedFixture(),
    { c } = f;
  try {
    const notice = await c.makeDocument({ note: 'Cancellation: SYN-ENG' });
    await expect(
      c.events.record('operator', {
        circularId: f.circularId,
        kind: 'cancellation',
        targets: [f.target],
        textVersion: notice.doc.textVersion,
        evidence: evidence(notice.doc, 'Memo: SYN-2026-001'),
        reason: 'wrong meaning',
      }),
    ).rejects.toThrow('EVENT_MEANING_NOT_VERIFIED');
    const event = await c.events.record('operator', {
      circularId: f.circularId,
      kind: 'cancellation',
      targets: [f.target],
      textVersion: notice.doc.textVersion,
      evidence: evidence(notice.doc, 'Cancellation: SYN-ENG'),
      reason: 'SYNTHETIC cancellation candidate',
    });
    const revision = (
      await c.database.pool.query(
        'SELECT revision_id FROM published_positions WHERE position_id=$1',
        [f.target],
      )
    ).rows[0].revision_id as string;
    await expect(c.events.restore('reviewer', f.target, revision, 1, 'premature')).rejects.toThrow(
      'CRITICAL_EVENT_REVIEW_REQUIRED',
    );
    await expect(
      c.database.pool.query(
        'UPDATE published_positions SET suppressed=false WHERE position_id=$1',
        [f.target],
      ),
    ).rejects.toThrow('NEW_REVIEW_REQUIRED');
    await c.events.decide(
      'reviewer',
      event,
      'rejected',
      'SYNTHETIC original reviewed, classification rejected',
    );
    expect(await c.publication.publicPositions()).toHaveLength(1);
    await expect(
      c.events.restore('reviewer', f.target, '00000000-0000-4000-8000-000000000000', 1, 'stale'),
    ).rejects.toThrow('STALE_RESTORE');
    await c.events.restore(
      'reviewer',
      f.target,
      revision,
      1,
      'SYNTHETIC explicit original-fact restoration',
    );
    expect(await c.publication.publicPositions()).toHaveLength(2);
  } finally {
    await c.close();
  }
});
it('R16 approved cancellation is terminal; exam/admit/result events cannot reopen a closed position', async () => {
  const f = await publishedFixture(),
    { c } = f;
  try {
    // SYNTHETIC pre-existing closed state, representing a previously verified closure.
    await c.database.pool.query("UPDATE positions SET recruitment_state='closed' WHERE id=$1", [
      f.target,
    ]);
    for (const [kind, label] of [
      ['exam', 'Exam'],
      ['admit', 'Admit'],
      ['result', 'Result'],
    ] as const) {
      const quote = `${label}: SYN-ENG`,
        notice = await c.makeDocument({ note: quote });
      const id = await c.events.record('operator', {
        circularId: f.circularId,
        kind,
        targets: [f.target],
        textVersion: notice.doc.textVersion,
        evidence: evidence(notice.doc, quote),
        reason: 'SYNTHETIC notice-level event only',
      });
      await c.events.decide('reviewer', id, 'approved', 'SYNTHETIC original event reviewed', {
        textVersion: notice.doc.textVersion,
        acceptedQualityPages: [],
      });
      expect(
        (
          await c.database.pool.query('SELECT recruitment_state FROM positions WHERE id=$1', [
            f.target,
          ])
        ).rows[0].recruitment_state,
      ).toBe('closed');
    }
    const notice = await c.makeDocument({ note: 'Cancellation: SYN-ENG' });
    const id = await c.events.record('operator', {
      circularId: f.circularId,
      kind: 'cancellation',
      targets: [f.target],
      textVersion: notice.doc.textVersion,
      evidence: evidence(notice.doc, 'Cancellation: SYN-ENG'),
      reason: 'SYNTHETIC cancellation',
    });
    const publicRead = new PublicReadRepository(
      c.options,
      TaxonomySchema.parse(JSON.parse(await readFile('config/taxonomy/search.v1.json', 'utf8'))),
    );
    expect(await publicRead.events(f.target)).toBeNull();
    await expect(
      c.events.decide('reviewer', id, 'approved', 'missing original review'),
    ).rejects.toThrow('EVENT_DOCUMENT_REVIEW_REQUIRED');
    await c.events.decide('reviewer', id, 'approved', 'SYNTHETIC original cancellation reviewed', {
      textVersion: notice.doc.textVersion,
      acceptedQualityPages: [],
    });
    expect(
      (
        await c.database.pool.query('SELECT recruitment_state FROM positions WHERE id=$1', [
          f.target,
        ])
      ).rows[0].recruitment_state,
    ).toBe('cancelled');
    expect(await publicRead.job(f.target)).toBeNull();
    expect(await publicRead.events(f.target)).toMatchObject({
      status: 'cancelled',
      events: expect.arrayContaining([expect.objectContaining({ kind: 'cancellation' })]),
    });
    c.setKeys({});
    expect(await publicRead.events(f.target)).toBeNull();
    c.setKeys(c.source.trust);
    expect(await c.publication.publicPositions()).toHaveLength(1);
  } finally {
    await c.close();
  }
});
it('R16/R28 failed fetch/disappearance never cancels; display revocation and external trust removal hide data', async () => {
  const f = await publishedFixture(),
    { c } = f;
  try {
    await c.execution.fail(f.run.claim, 'HTTP_NOT_SUCCESSFUL', { permanent: true });
    expect(
      (await c.database.pool.query('SELECT count(*) FROM recruitment_events')).rows[0].count,
    ).toBe('0');
    expect(await c.publication.publicPositions()).toHaveLength(2);
    c.setKeys({});
    expect(await c.publication.publicPositions()).toHaveLength(0);
    c.setKeys(c.source.trust);
    const epoch = (await c.database.pool.query('SELECT control_epoch FROM sources')).rows[0]
      .control_epoch;
    await c.sources.controls('approver', c.source.config.id, {
      collectionHalted: true,
      displayHalted: true,
      expectedEpoch: epoch,
      reason: 'SYNTHETIC policy revocation',
    });
    expect(await c.publication.publicPositions()).toHaveLength(0);
    expect(
      (await c.database.pool.query('SELECT count(*) FROM published_positions')).rows[0].count,
    ).toBe('2');
  } finally {
    await c.close();
  }
});
