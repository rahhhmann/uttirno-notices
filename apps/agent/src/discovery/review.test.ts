import { beforeEach, expect, it, vi } from 'vitest';
import { syntheticSource } from '../../../../tests/helpers/source.js';
import { SourcePolicyError } from '@uttirno/source-config';
import type { SourceClient } from '../fetch/client.js';
import type { ArtifactArchive } from '../documents/archive.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const mocks = vi.hoisted(() => ({ discover: vi.fn(), acquire: vi.fn() }));
vi.mock('./crawl.js', () => ({ discover: mocks.discover }));
vi.mock('../documents/pipeline.js', () => ({ acquireJobDocument: mocks.acquire }));
import { collectForReview, writePrivateReview, type ReviewRun } from './review.js';
const urls = ['https://notices.example/a.pdf', 'https://notices.example/b.pdf'];
beforeEach(() => {
  vi.resetAllMocks();
  mocks.discover.mockResolvedValue({
    complete: true,
    pages: [{}],
    candidates: [
      { title: 'SYNTHETIC A', attachments: [urls[0]] },
      { title: 'SYNTHETIC B', attachments: [urls[1]] },
    ],
    attachments: urls,
    errors: [],
    quarantined: [],
  });
  mocks.acquire.mockResolvedValue({
    captureId: 'a'.repeat(64),
    artifactSha256: 'b'.repeat(64),
    textVersion: 'c'.repeat(64),
    pages: 1,
    positions: [],
    state: 'needs_review',
    publicationApproved: false,
  });
});
function fixture() {
  const config = syntheticSource({
    documentExtraction: { forceOcr: false, jobNoticeOnly: true },
  }).config;
  const current = vi.fn(async () => config);
  return {
    current,
    client: { current } as unknown as SourceClient,
    archive: {} as ArtifactArchive,
    checkpoints: [] as ReviewRun[],
  };
}
it('automatically attempts all discovered documents, checkpoints failures, and never publishes', async () => {
  const c = fixture();
  mocks.acquire.mockRejectedValueOnce(new Error('DOCUMENT_PAGE_LIMIT'));
  const run = await collectForReview(c.client, c.archive, async (r) => {
    c.checkpoints.push(structuredClone(r));
  });
  expect(mocks.acquire).toHaveBeenCalledTimes(2);
  expect(run.state).toBe('incomplete');
  expect(run.documents.map((d) => d.state)).toEqual(['failed', 'extracted_needs_mapping']);
  expect(run.publicationApproved).toBe(false);
  expect(c.checkpoints[0]?.documents).toEqual([]);
  expect(c.checkpoints.at(-1)?.documents).toHaveLength(2);
});
it('incomplete discovery does not download a partial inventory', async () => {
  const c = fixture();
  mocks.discover.mockResolvedValue({
    complete: false,
    pages: [],
    candidates: [],
    attachments: urls,
    errors: ['ADAPTER_DRIFT'],
    quarantined: [],
  });
  expect((await collectForReview(c.client, c.archive, async () => {})).state).toBe('incomplete');
  expect(mocks.acquire).not.toHaveBeenCalled();
});
it('revocation during the batch stops remaining documents without retrying or publishing', async () => {
  const c = fixture();
  mocks.acquire.mockRejectedValueOnce(new SourcePolicyError('SOURCE_NOT_ACTIVE'));
  const run = await collectForReview(c.client, c.archive, async () => {});
  expect(mocks.acquire).toHaveBeenCalledTimes(1);
  expect(run.documents[0]?.error).toBe('SOURCE_NOT_ACTIVE');
  expect(run.state).toBe('incomplete');
});
it('a complete extraction still requires mapping and human review', async () => {
  const c = fixture();
  const run = await collectForReview(c.client, c.archive, async () => {});
  expect(run.state).toBe('needs_review');
  expect(run.documents.every((d) => d.result?.positions.length === 0)).toBe(true);
  expect(run.publicationApproved).toBe(false);
});
it('private review escapes remote text and refuses a stale archive fallback', async () => {
  const c = fixture();
  const run = await collectForReview(c.client, c.archive, async () => {});
  const root = await mkdtemp(path.join(tmpdir(), 'uttirno-review-'));
  async function cleanup() {
    if (
      path.dirname(path.resolve(root)) !== path.resolve(tmpdir()) ||
      !path.basename(root).startsWith('uttirno-review-')
    )
      throw new Error('UNSAFE_TEST_CLEANUP');
    await rm(root, { recursive: true, force: true });
  }
  const readText = vi.fn().mockResolvedValue({
    pages: [{ page: 1, method: 'text', flags: [], text: '<script>alert("remote")</script>' }],
  });
  const archive = { readText } as unknown as ArtifactArchive;
  try {
    const file = await writePrivateReview(root, run, archive);
    const html = await readFile(file, 'utf8');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain("default-src 'none'");
    readText.mockRejectedValue(new Error('ARTIFACT_POLICY_STALE'));
    await writePrivateReview(root, run, archive);
    const blocked = await readFile(file, 'utf8');
    expect(blocked).not.toContain('alert');
    expect(blocked).toContain('Text unavailable under current retention/access policy');
  } finally {
    await cleanup();
  }
});
