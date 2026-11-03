import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { ArtifactArchive, sealText, validateText } from './archive.js';
import { syntheticSource, testNow } from '../../../../tests/helpers/source.js';
import { configFingerprint } from '@uttirno/source-config';
it('R08/R23 immutable bytes/text roundtrip with policy recheck, retention and tamper detection', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'uttirno-archive-test-'));
  const source = syntheticSource({
    retention: {
      permitted: true,
      maxDays: 1,
      expiresAt: '2027-01-01T00:00:00.000Z',
      evidence: { url: 'https://notices.example/terms', note: 'SYNTHETIC retention grant' },
    },
  });
  let current = source.bundle;
  let now = testNow;
  const archive = new ArtifactArchive({
    root,
    load: async () => current,
    keys: async () => source.trust,
    now: () => now,
  });
  try {
    const capture = await archive.capture(
      Buffer.from('SYNTHETIC text'),
      'https://notices.example/notice',
      'text/plain',
    );
    expect((await archive.read(capture.captureId)).bytes.toString()).toBe('SYNTHETIC text');
    const text = sealText({
      schemaVersion: 1,
      sourceId: source.config.id,
      configFingerprint: configFingerprint(source.config),
      artifactSha256: capture.sha256,
      engine: 'SYNTHETIC-v1',
      pages: [
        {
          page: 1,
          width: 100,
          height: 100,
          method: 'text',
          text: 'SYNTHETIC text',
          words: [],
          flags: [],
        },
      ],
    });
    await archive.storeText(capture.captureId, text);
    await archive.storeText(capture.captureId, text);
    expect(await archive.readText(capture.captureId, text.textVersion)).toEqual(text);
    expect(() => validateText({ ...text, engine: 'changed' })).toThrow('TEXT_HASH_MISMATCH');
    current = source.resign({ ...source.config, state: 'paused' });
    await expect(archive.read(capture.captureId)).rejects.toThrow('SOURCE_NOT_ACTIVE');
    current = source.bundle;
    now = new Date(testNow.getTime() + 86400001);
    await expect(archive.read(capture.captureId)).rejects.toThrow('ARTIFACT_POLICY_STALE');
    now = testNow;
    await writeFile(path.join(root, 'bytes', capture.sha256), 'changed');
    await expect(archive.read(capture.captureId)).rejects.toThrow('ARTIFACT_HASH_MISMATCH');
    await expect(
      archive.capture(
        Buffer.from('SYNTHETIC text'),
        'https://notices.example/notice',
        'text/plain',
      ),
    ).rejects.toThrow('IMMUTABLE_CONTENT_CONFLICT');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it('R02/R23 missing retention cannot archive', async () => {
  const source = syntheticSource();
  const archive = new ArtifactArchive({
    root: 'data/should-not-exist',
    load: async () => source.bundle,
    keys: async () => source.trust,
    now: () => testNow,
  });
  await expect(
    archive.capture(Buffer.from('x'), 'https://notices.example/a', 'text/plain'),
  ).rejects.toThrow('RETENTION_NOT_PERMITTED');
});
it('R08 retention is measured from download capture time, consistently with persisted metadata', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'uttirno-archive-test-'));
  const source = syntheticSource({
    retention: {
      permitted: true,
      maxDays: 1,
      expiresAt: '2027-01-01T00:00:00.000Z',
      evidence: { url: 'https://notices.example/terms', note: 'SYNTHETIC retention' },
    },
  });
  const archive = new ArtifactArchive({
    root,
    load: async () => source.bundle,
    keys: async () => source.trust,
    now: () => testNow,
  });
  try {
    const captured = new Date(testNow.getTime() - 5000);
    const result = await archive.capture(
      Buffer.from('SYNTHETIC delayed archival'),
      'https://notices.example/a',
      'text/plain',
      {
        fingerprint: configFingerprint(source.config),
        capturedAt: captured.toISOString(),
        status: 200,
        headers: {},
      },
    );
    expect(Date.parse(result.expiresAt) - captured.getTime()).toBe(86400000);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it('R02/R23 unapproved destinations, unsigned approval and retention expiry fail before writing', async () => {
  const source = syntheticSource({
    retention: {
      permitted: true,
      maxDays: 1,
      expiresAt: '2027-01-01T00:00:00.000Z',
      evidence: { url: 'https://notices.example/terms', note: 'SYNTHETIC retention' },
    },
  });
  let current = source.bundle;
  const archive = new ArtifactArchive({
    root: 'data/should-not-exist',
    load: async () => current,
    keys: async () => source.trust,
    now: () => testNow,
  });
  await expect(
    archive.capture(Buffer.from('x'), 'https://evil.example/document', 'text/plain'),
  ).rejects.toThrow('ORIGIN_NOT_APPROVED');
  current = { config: source.config };
  await expect(
    archive.capture(Buffer.from('x'), 'https://notices.example/a', 'text/plain'),
  ).rejects.toThrow('UNTRUSTED_APPROVAL');
  const retention = source.config.retention;
  if (!retention) throw new Error('MISSING_SYNTHETIC_RETENTION');
  current = source.resign({
    ...source.config,
    retention: { ...retention, expiresAt: '2026-11-02T00:00:00.000Z' },
  });
  await expect(
    archive.capture(Buffer.from('x'), 'https://notices.example/a', 'text/plain'),
  ).rejects.toThrow('RETENTION_NOT_PERMITTED');
});
