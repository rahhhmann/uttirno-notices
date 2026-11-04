// biome-ignore-all lint/style/noNonNullAssertion: Synthetic records and IDs are asserted in each fixture flow.
import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDatabase, migrate, tablesFor, migrationNames } from '@uttirno/database';
import { m4Context, integrationEnvironment } from '../helpers/m4.js';
import { sealText } from '../helpers/extraction.js';
import { RevisionBundleSchema } from '@uttirno/contracts';
import { createHash } from 'node:crypto';
import { canonical, configFingerprint } from '@uttirno/source-config';
function assertTestSchema(schema: string) {
  if (!/^m4_test_[a-f0-9]{32}$/.test(schema)) throw new Error('UNSAFE_TEST_SCHEMA');
}
it('R29 empty -> previous schema -> guarded schema upgrade, data preservation, checksums and Drizzle mapping', async () => {
  const env = integrationEnvironment(),
    schema = `m4_test_${randomUUID().replaceAll('-', '')}`,
    db = createDatabase(env.DATABASE_URL, schema);
  try {
    await migrate(db.pool, schema, 1);
    await db.pool.query(
      'INSERT INTO artifacts(sha256,size,media_type,storage_key) VALUES($1,10,$2,$1)',
      ['a'.repeat(64), 'text/plain'],
    );
    await migrate(db.pool, schema, 2);
    expect(
      (await db.pool.query("SELECT to_regclass('admin_sessions') AS name")).rows[0].name,
    ).toBeNull();
    await Promise.all([migrate(db.pool, schema), migrate(db.pool, schema)]);
    expect(
      (await db.pool.query("SELECT to_regclass('admin_sessions') AS name")).rows[0].name,
    ).not.toBeNull();
    expect((await db.db.select().from(tablesFor(schema).artifacts))[0]?.size).toBe(10);
    expect((await db.pool.query('SELECT count(*) FROM schema_migrations')).rows[0].count).toBe(
      String(migrationNames.length),
    );
    await expect(db.pool.query('UPDATE artifacts SET size=11')).rejects.toThrow(
      'IMMUTABLE_HISTORY',
    );
    await db.pool.query(
      "UPDATE schema_migrations SET checksum='tampered' WHERE name='0001_core.sql'",
    );
    await expect(migrate(db.pool, schema)).rejects.toThrow('MIGRATION_CHECKSUM_MISMATCH');
  } finally {
    assertTestSchema(schema);
    await db.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await db.close();
  }
});
it('R15/R17 same URL changed bytes makes immutable draft; published revision survives ingestion and replay', async () => {
  const c = await m4Context();
  try {
    const first = await c.makeDocument(),
      run = await c.beginRun();
    const input = {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle: first.bundle,
      inventory: first.inventory,
    };
    const draft = await c.revisions.stage('operator', input);
    expect(draft.state).toBe('draft');
    if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    expect(await c.publication.publicPositions()).toEqual([]);
    await c.publication.approve(
      'reviewer',
      draft.revisionId,
      draft.generation,
      await c.attestation(first),
      'SYNTHETIC original review',
    );
    const before = await c.publication.publicPositions();
    expect(before).toHaveLength(2);
    const replay = await c.revisions.stage('operator', input);
    expect(replay).toMatchObject({ revisionId: draft.revisionId, replayed: true });
    const changed = await c.makeDocument({ deadline: '17/12/2026' });
    const second = await c.revisions.stage('operator', {
      ...input,
      bundle: changed.bundle,
      inventory: changed.inventory,
    });
    if (second.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    expect(second.generation).toBe(2);
    expect((await c.publication.publicPositions()).map((v) => v.revisionId)).toEqual(
      before.map((v) => v.revisionId),
    );
    await expect(
      c.publication.approve(
        'reviewer',
        draft.revisionId,
        draft.generation,
        await c.attestation(first),
        'stale',
      ),
    ).rejects.toThrow('STALE_REVIEW');
    await c.publication.approve(
      'reviewer',
      second.revisionId,
      second.generation,
      await c.attestation(changed),
      'SYNTHETIC updated review',
    );
    expect((await c.database.pool.query('SELECT count(*) FROM circulars')).rows[0].count).toBe('1');
    expect(
      (await c.database.pool.query('SELECT count(*) FROM circular_revisions')).rows[0].count,
    ).toBe('2');
    expect((await c.database.pool.query('SELECT count(*) FROM positions')).rows[0].count).toBe('2');
    await expect(c.database.pool.query("UPDATE position_revisions SET value='{}'")).rejects.toThrow(
      'IMMUTABLE_HISTORY',
    );
    await expect(c.database.pool.query('DELETE FROM audit_events')).rejects.toThrow(
      'IMMUTABLE_HISTORY',
    );
  } finally {
    await c.close();
  }
});
it('R15 ambiguous memo/post identity queues accountable manual resolution instead of URL/title merge', async () => {
  const c = await m4Context();
  try {
    const item = await c.makeDocument({ memo: false, postCode: false }),
      run = await c.beginRun();
    const result = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle: item.bundle,
      inventory: item.inventory,
    });
    expect(result.state).toBe('needs_identity_review');
    if (result.state !== 'needs_identity_review') throw new Error('EXPECTED_REVIEW');
    expect((await c.database.pool.query('SELECT count(*) FROM circulars')).rows[0].count).toBe('0');
    await expect(
      c.revisions.resolveIdentity('operator', result.candidateId, {
        memo: 'SYN-2026-001',
        postKeys: { engineer: 'SYN-ENG', analyst: 'SYN-ANA' },
        reason: 'invalid self grant',
      }),
    ).rejects.toThrow('ACTOR_NOT_AUTHORIZED');
    expect(
      await c.revisions.resolveIdentity('reviewer', result.candidateId, {
        memo: 'SYN-2026-001',
        postKeys: { engineer: 'SYN-ENG', analyst: 'SYN-ANA' },
        reason: 'SYNTHETIC manual original-document identity review',
      }),
    ).toMatchObject({ state: 'draft' });
    expect(
      (await c.database.pool.query('SELECT resolved_by FROM duplicate_candidates')).rows[0]
        .resolved_by,
    ).toBe('reviewer');
  } finally {
    await c.close();
  }
});
it('R13/R17 wrong sibling, unsupported destination and partial attachment/position inventory cannot publish', async () => {
  const c = await m4Context();
  try {
    const item = await c.makeDocument(),
      run = await c.beginRun();
    const forged = structuredClone(item.bundle);
    forged.entries[0]!.positions[0]!.fields.qualifications =
      forged.entries[0]!.positions[1]!.fields.qualifications;
    await expect(
      c.revisions.stage('operator', {
        sourceId: c.source.config.id,
        runId: run.runId,
        bundle: forged,
        inventory: item.inventory,
      }),
    ).rejects.toThrow('DRAFT_NOT_REPRODUCIBLE');
    for (const inventory of [
      { ...item.inventory, artifactHashes: [...item.inventory.artifactHashes, 'c'.repeat(64)] },
      { ...item.inventory, positionKeys: ['SYN-ENG'] },
    ]) {
      const draft = await c.revisions.stage('operator', {
        sourceId: c.source.config.id,
        runId: run.runId,
        bundle: item.bundle,
        inventory,
      });
      if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
      const attest = await c.attestation({ ...item, inventory });
      await expect(
        c.publication.approve('reviewer', draft.revisionId, draft.generation, attest, 'incomplete'),
      ).rejects.toThrow(/INCOMPLETE_/);
    }
    const unsafe = await c.makeDocument({ apply: 'https://evil.example/apply' });
    const draft = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle: unsafe.bundle,
      inventory: unsafe.inventory,
    });
    if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    await expect(
      c.publication.approve(
        'reviewer',
        draft.revisionId,
        draft.generation,
        await c.attestation(unsafe),
        'unsafe apply',
      ),
    ).rejects.toThrow('VERIFICATION_FAILED');
    expect(await c.publication.publicPositions()).toHaveLength(0);
    expect(
      (await c.database.pool.query("SELECT count(*) FROM outbox_events WHERE topic='publication'"))
        .rows[0].count,
    ).toBe('0');
  } finally {
    await c.close();
  }
});
it('R17 concurrent approvals serialize, worker/operator cannot approve and original creator cannot self-review', async () => {
  const c = await m4Context();
  try {
    const item = await c.makeDocument(),
      run = await c.beginRun();
    const draft = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle: item.bundle,
      inventory: item.inventory,
    });
    if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    const attest = await c.attestation(item);
    await expect(
      c.publication.approve('operator', draft.revisionId, 1, attest, 'operator denied'),
    ).rejects.toThrow('ACTOR_NOT_AUTHORIZED');
    await c.database.pool.query(
      "INSERT INTO admin_roles(actor_id,role) VALUES('operator','reviewer')",
    );
    await expect(
      c.publication.approve('operator', draft.revisionId, 1, attest, 'self-review denied'),
    ).rejects.toThrow('TWO_PERSON_REVIEW_REQUIRED');
    const results = await Promise.allSettled(
      ['reviewer', 'reviewer2'].map((actor) =>
        c.publication.approve(actor, draft.revisionId, 1, attest, 'SYNTHETIC concurrent review'),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      (await c.database.pool.query("SELECT count(*) FROM outbox_events WHERE topic='publication'"))
        .rows[0].count,
    ).toBe('1');
  } finally {
    await c.close();
  }
});
it('R02/R28 link-only permission cannot publish copied fields and disabled reviewers cannot approve', async () => {
  const c = await m4Context({ display: 'link_only' });
  try {
    const item = await c.makeDocument(),
      run = await c.beginRun();
    const draft = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle: item.bundle,
      inventory: item.inventory,
    });
    if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    await expect(
      c.publication.approve(
        'reviewer',
        draft.revisionId,
        draft.generation,
        await c.attestation(item),
        'link-only cannot copy',
      ),
    ).rejects.toThrow('SOURCE_HALTED');
    await c.database.pool.query("UPDATE admin_identities SET disabled=true WHERE id='reviewer'");
    await expect(
      c.publication.approve(
        'reviewer',
        draft.revisionId,
        draft.generation,
        await c.attestation(item),
        'disabled',
      ),
    ).rejects.toThrow('ACTOR_NOT_AUTHORIZED');
    expect(await c.publication.publicPositions()).toHaveLength(0);
  } finally {
    await c.close();
  }
});
it('R07/R13 supporting attachments require complete inventory, explicit applicability and quality review', async () => {
  const c = await m4Context();
  try {
    const item = await c.makeDocument(),
      url = 'https://notices.example/instructions.txt';
    const content = 'SYNTHETIC supporting notice. No additional eligibility, fees or deadlines.';
    const capture = await c.archive.capture(Buffer.from(content), url, 'text/plain');
    const document = sealText({
      schemaVersion: 1,
      sourceId: c.source.config.id,
      configFingerprint: configFingerprint(c.source.config),
      artifactSha256: capture.sha256,
      engine: 'SYNTHETIC-support-v1',
      pages: [
        {
          page: 1,
          width: 600,
          height: 900,
          method: 'text',
          text: content,
          words: [],
          flags: ['layout_review'],
        },
      ],
    });
    await c.documents.put('operator', capture, document);
    const run = await c.beginRun([c.url, url]);
    const bundle = RevisionBundleSchema.parse({
      ...item.bundle,
      supportingDocuments: [document.textVersion],
    });
    const inventory = {
      ...item.inventory,
      artifactHashes: [...item.inventory.artifactHashes, document.artifactSha256],
    };
    const draft = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle,
      inventory,
    });
    if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
    const attestation = {
      ...(await c.attestation(item)),
      bundleDigest: hash(bundle),
      inventoryDigest: hash(inventory),
      textVersions: [item.doc.textVersion, document.textVersion],
      supportingReviews: {} as Record<string, string>,
      acceptedQualityPages: { [item.doc.textVersion]: [] } as Record<string, number[]>,
    };
    await expect(
      c.publication.approve('reviewer', draft.revisionId, 1, attestation, 'unreviewed supplement'),
    ).rejects.toThrow('SUPPORTING_DOCUMENT_REVIEW_REQUIRED');
    attestation.supportingReviews[document.textVersion] =
      'SYNTHETIC original supporting document reviewed: explicitly no additional conditions.';
    await expect(
      c.publication.approve('reviewer', draft.revisionId, 1, attestation, 'quality unresolved'),
    ).rejects.toThrow('DOCUMENT_QUALITY_REVIEW_REQUIRED');
    attestation.acceptedQualityPages[document.textVersion] = [1];
    await c.publication.approve(
      'reviewer',
      draft.revisionId,
      1,
      attestation,
      'SYNTHETIC all attachments independently reviewed',
    );
    expect(await c.publication.publicPositions()).toHaveLength(2);
  } finally {
    await c.close();
  }
});
