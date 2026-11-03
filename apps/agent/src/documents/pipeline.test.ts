import { expect, it, vi } from 'vitest';
import { ArtifactArchive } from './archive.js';
import { acquireJobDocument } from './pipeline.js';
import { SourceClient } from '../fetch/client.js';
import { syntheticSource, testNow } from '../../../../tests/helpers/source.js';
it('R02/R23 missing archive retention fails before any source/DNS/network acquisition', async () => {
  const source = syntheticSource();
  const resolver = vi.fn();
  const transport = vi.fn();
  const client = new SourceClient({
    load: async () => source.bundle,
    keys: source.trust,
    now: () => testNow,
    userAgent: 'UttirnoTest/0.3 (+https://example.com)',
    resolver,
    transport,
  });
  const archive = new ArtifactArchive({
    root: 'data/should-not-exist',
    load: async () => source.bundle,
    keys: async () => source.trust,
    now: () => testNow,
  });
  await expect(
    acquireJobDocument(client, archive, 'https://notices.example/notice.pdf'),
  ).rejects.toThrow('RETENTION_NOT_PERMITTED');
  expect(resolver).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
});
