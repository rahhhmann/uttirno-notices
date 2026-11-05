// SYNTHETIC sources/staff except explicitly labelled captured BPSC offline HTML.
import { expect, it } from 'vitest';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { m5Context } from '../helpers/m5.js';
import { ArtifactArchive } from '../../apps/agent/src/documents/archive.js';
import { extractPdf } from '../../apps/agent/src/documents/native.js';
import { configFingerprint } from '@uttirno/source-config';
it('M6 R02/R06 offline source preview proves captured selectors without activating source or making network calls', async () => {
  const c = await m5Context();
  try {
    const reviewer = await c.session('reviewer-sub'),
      approver = await c.session('approver-sub');
    const bundle = JSON.parse(await readFile('config/sources/bpsc-noncadre.draft.json', 'utf8'));
    const body = {
      bundle,
      url: bundle.config.seeds[0],
      sample: await readFile('tests/fixtures/real/bpsc-noncadre.fragment.html', 'utf8'),
      expectedCandidates: 2,
    };
    expect((await c.post(reviewer, '/v1/admin/source-preview', body)).statusCode).toBe(403);
    const result = await c.post(approver, '/v1/admin/source-preview', body);
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json()).toMatchObject({ state: 'needs_review', matchesExpected: true });
    expect(result.json().items).toHaveLength(2);
    const wrong = await c.post(approver, '/v1/admin/source-preview', {
      ...body,
      expectedCandidates: 3,
    });
    expect(wrong.json().matchesExpected).toBe(false);
    const assessment = await c.app.inject({
      url: `/v1/admin/sources/${c.source.config.id}/assessment`,
      headers: { cookie: approver.cookie },
    });
    expect(assessment.statusCode, assessment.body).toBe(200);
    expect(assessment.json().collection.allowed).toBe(true);
    expect((await c.database.pool.query('SELECT count(*) FROM sources')).rows[0].count).toBe('1');
  } finally {
    await c.close();
  }
}, 30000);
it('M6 R13/R18 original snapshot and private case reads enforce roles, retention and content hashes', async () => {
  const c = await m5Context();
  try {
    const reviewer = await c.session('reviewer-sub'),
      op = await c.session('operator-sub'),
      item = await c.makeDocument(),
      run = await c.beginRun();
    const draft = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle: item.bundle,
      inventory: item.inventory,
    });
    if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    const info = await c.app.inject({
      url: `/v1/admin/documents/${item.doc.textVersion}/original-info`,
      headers: { cookie: reviewer.cookie },
    });
    expect(info.statusCode, info.body).toBe(200);
    expect(info.json().sha256).toBe(item.doc.artifactSha256);
    expect(info.body).not.toContain(c.root);
    const original = await c.app.inject({
      url: `/v1/admin/documents/${item.doc.textVersion}/original`,
      headers: { cookie: reviewer.cookie },
    });
    expect(original.statusCode, original.body).toBe(200);
    expect(original.headers['content-disposition']).toContain('attachment');
    expect(original.body).toContain('SYN-ENG');
    expect(
      (await c.app.inject(`/v1/admin/documents/${item.doc.textVersion}/original`)).statusCode,
    ).toBe(401);
    const context = await c.app.inject({
      url: `/v1/admin/revisions/${draft.revisionId}/context`,
      headers: { cookie: reviewer.cookie },
    });
    expect(context.json()).toMatchObject({ state: 'draft', currentGeneration: 1 });
    expect(
      (
        await c.app.inject({
          url: `/v1/admin/revisions/${draft.revisionId}/context`,
          headers: { cookie: op.cookie },
        })
      ).statusCode,
    ).toBe(403);
    await writeFile(path.join(c.root, 'bytes', item.doc.artifactSha256), 'SYNTHETIC tamper');
    expect(
      (
        await c.app.inject({
          url: `/v1/admin/documents/${item.doc.textVersion}/original`,
          headers: { cookie: reviewer.cookie },
        })
      ).statusCode,
    ).toBe(422);
    const epoch = (await c.database.pool.query('SELECT control_epoch FROM sources')).rows[0]
      .control_epoch;
    await c.sources.controls('approver', c.source.config.id, {
      expectedEpoch: epoch,
      collectionHalted: true,
      displayHalted: true,
      reason: 'SYNTHETIC takedown',
    });
    expect(
      (
        await c.app.inject({
          url: `/v1/admin/documents/${item.doc.textVersion}/original-info`,
          headers: { cookie: reviewer.cookie },
        })
      ).statusCode,
    ).toBe(422);
  } finally {
    await c.close();
  }
}, 30000);
it('M6 R02/R04 canary rejects unbounded configurations and accepts only a signed one-page budget', async () => {
  const c = await m5Context(true, {
    sourceOverrides: {
      limits: {
        intervalMs: 4000,
        timeoutMs: 1000,
        maxBytes: 1048576,
        maxTotalBytes: 2097152,
        maxRequests: 5,
        maxPages: 1,
        maxRedirects: 1,
        retries: 0,
      },
    },
  });
  try {
    const op = await c.session('operator-sub'),
      result = await c.post(op, `/v1/admin/sources/${c.source.config.id}/canary`, {
        reason: 'SYNTHETIC bounded canary',
      });
    expect(result.statusCode, result.body).toBe(200);
    const stage = (
      await c.database.pool.query('SELECT payload FROM stage_runs WHERE run_id=$1', [
        result.json().runId,
      ])
    ).rows[0].payload;
    expect(stage.inputKey).toBe('canary');
    const changed = c.source.resign({
      ...c.source.config,
      version: 2,
      limits: { ...c.source.config.limits, maxPages: 2 },
    });
    await c.sources.register('approver', 'synthetic-authority', changed);
    expect(
      (
        await c.post(op, `/v1/admin/sources/${c.source.config.id}/canary`, {
          reason: 'SYNTHETIC unbounded canary rejection',
        })
      ).statusCode,
    ).toBe(422);
  } finally {
    await c.close();
  }
}, 30000);

it('M6 R09/R13 retained PDF page is rendered as bounded PNG, with no active document served inline', async () => {
  const c = await m5Context();
  try {
    const clock = (await c.database.pool.query<{ now: Date }>('SELECT clock_timestamp() AS now'))
      .rows[0]?.now;
    if (!clock) throw new Error('SYNTHETIC_CLOCK_REQUIRED');
    const archive = new ArtifactArchive({
      now: () => clock,
      root: c.root,
      load: () => c.sources.current(c.source.config.id),
      keys: c.options.keys,
    });
    const bytes = await readFile('tests/fixtures/documents/table.pdf'),
      capture = await archive.capture(
        bytes,
        'https://notices.example/notice.pdf',
        'application/pdf',
      );
    const doc = await extractPdf(bytes, {
      sourceId: c.source.config.id,
      configFingerprint: configFingerprint(c.source.config),
    });
    await archive.storeText(capture.captureId, doc);
    await c.documents.put('operator', capture, doc);
    const reviewer = await c.session('reviewer-sub');
    const image = await c.app.inject({
      url: `/v1/admin/documents/${doc.textVersion}/pages/1`,
      headers: { cookie: reviewer.cookie },
    });
    expect(image.statusCode, image.body.slice(0, 100)).toBe(200);
    expect(image.headers['content-type']).toContain('image/png');
    expect(image.rawPayload.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(image.rawPayload.readUInt32BE(16)).toBeLessThanOrEqual(1400);
    expect(image.rawPayload.readUInt32BE(20)).toBeLessThanOrEqual(1400);
    expect((await c.app.inject(`/v1/admin/documents/${doc.textVersion}/pages/1`)).statusCode).toBe(
      401,
    );
    expect(
      (
        await c.app.inject({
          url: `/v1/admin/documents/${doc.textVersion}/pages/2`,
          headers: { cookie: reviewer.cookie },
        })
      ).statusCode,
    ).toBe(404);
  } finally {
    await c.close();
  }
}, 30000);
