// biome-ignore-all lint/style/noNonNullAssertion: Fixture inventory and page counts are asserted in this test.
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { extractPdf } from '../../apps/agent/src/documents/native.js';
import { sha256, validateText } from '../../apps/agent/src/documents/archive.js';
import { ArtifactArchive } from '../../apps/agent/src/documents/archive.js';
import { acquireJobDocument } from '../../apps/agent/src/documents/pipeline.js';
import { SourceClient } from '../../apps/agent/src/fetch/client.js';
import { syntheticSource, testNow, instantLimiter } from '../helpers/source.js';
it('R09 real Poppler/Tesseract handles synthetic mixed-language text, tables, columns, scan and mixed pages', async () => {
  const manifest = JSON.parse(await readFile('tests/fixtures/documents/manifest.json', 'utf8')) as {
    files: Array<{ file: string; sha256: string }>;
  };
  for (const file of [
    'mixed-text.pdf',
    'table.pdf',
    'columns.pdf',
    'scanned.pdf',
    'mixed-pages.pdf',
  ]) {
    const bytes = await readFile(`tests/fixtures/documents/${file}`);
    expect(sha256(bytes)).toBe(manifest.files.find((f) => f.file === file)!.sha256);
    const text = validateText(
      await extractPdf(bytes, {
        sourceId: 'synthetic-benchmark',
        configFingerprint: 'b'.repeat(64),
      }),
    );
    expect(text.pages.length).toBe(file === 'mixed-pages.pdf' ? 2 : 1);
    expect(text.pages[0]!.text).toContain('SYNTHETIC');
    if (file === 'scanned.pdf') {
      expect(text.pages[0]!.method).toBe('ocr');
      expect(text.pages[0]!.flags).toContain('ocr_review');
      expect(text.pages[0]!.words.some((w) => w.confidence !== null)).toBe(true);
    } else expect(text.pages[0]!.method).toBe('text');
    if (['mixed-text.pdf', 'scanned.pdf', 'mixed-pages.pdf', 'table.pdf'].includes(file))
      expect(text.pages.map((p) => p.text).join('\n')).toMatch(/[\u0980-\u09FF]/);
    if (file === 'mixed-pages.pdf') expect(text.pages[1]!.method).toBe('ocr');
  }
}, 120000);
it('R09 real parser rejects malformed PDF without returning partial success', async () => {
  await expect(
    extractPdf(await readFile('tests/fixtures/documents/malformed.pdf'), {
      sourceId: 'synthetic-benchmark',
      configFingerprint: 'b'.repeat(64),
    }),
  ).rejects.toThrow('DOCUMENT_PROCESS_FAILED');
});
it('R08 bounded broker -> private archive -> actual PDF extraction preserves lineage; revocation blocks reuse', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'uttirno-pipeline-test-'));
  const source = syntheticSource({
    retention: {
      permitted: true,
      maxDays: 1,
      expiresAt: '2027-01-01T00:00:00.000Z',
      evidence: { url: 'https://notices.example/terms', note: 'SYNTHETIC retention' },
    },
  });
  let bundle = source.bundle;
  let requests = 0;
  const bytes = await readFile('tests/fixtures/documents/mixed-text.pdf');
  const client = new SourceClient({
    load: async () => bundle,
    keys: source.trust,
    now: () => testNow,
    limiter: instantLimiter(),
    userAgent: 'UttirnoTest/0.3 (+https://example.com)',
    resolver: async () => [{ address: '8.8.8.8', family: 4 }],
    transport: async (req) => {
      requests++;
      return {
        status: 200,
        headers: {
          'content-type': req.url.pathname === '/robots.txt' ? 'text/plain' : 'application/pdf',
        },
        body: req.url.pathname === '/robots.txt' ? Buffer.from('User-agent: *\nAllow: /') : bytes,
      };
    },
  });
  const archive = new ArtifactArchive({
    root,
    load: async () => bundle,
    keys: async () => source.trust,
    now: () => testNow,
  });
  try {
    const result = await acquireJobDocument(client, archive, 'https://notices.example/notice.pdf');
    expect(result.publicationApproved).toBe(false);
    expect(result.state).toBe('needs_review');
    const text = await archive.readText(result.captureId, result.textVersion);
    expect(text.artifactSha256).toBe(sha256(bytes));
    expect(text.pages[0]!.text).toContain('Engineer');
    expect((await archive.read(result.captureId)).capture.response?.status).toBe(200);
    const before = requests;
    bundle = source.resign({ ...source.config, collection: 'revoked' });
    await expect(
      acquireJobDocument(client, archive, 'https://notices.example/notice.pdf'),
    ).rejects.toThrow();
    expect(requests).toBe(before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
