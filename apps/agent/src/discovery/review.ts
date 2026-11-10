import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { configFingerprint, SourcePolicyError } from '@uttirno/source-config';
import type { SourceClient } from '../fetch/client.js';
import type { ArtifactArchive } from '../documents/archive.js';
import { acquireJobDocument } from '../documents/pipeline.js';
import { discover } from './crawl.js';

type DocumentResult = {
  url: string;
  label: string;
  state: 'extracted_needs_mapping' | 'failed';
  result?: Awaited<ReturnType<typeof acquireJobDocument>>;
  error?: string;
};
export type ReviewRun = {
  schemaVersion: 1;
  runId: string;
  sourceId: string;
  configFingerprint: string;
  startedAt: string;
  state: 'running' | 'needs_review' | 'incomplete';
  discovery: {
    complete: boolean;
    pages: number;
    candidates: number;
    attachments: string[];
    errors: string[];
    quarantined: string[];
  };
  documents: DocumentResult[];
  publicationApproved: false;
};
const escapeHtml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

// One broker/client shares budgets and runtime policy checks across discovery and every document.
// A local private review queue; never supplies invented position plans or publication approval.
export async function collectForReview(
  client: SourceClient,
  archive: ArtifactArchive,
  checkpoint: (run: ReviewRun) => Promise<void>,
): Promise<ReviewRun> {
  const config = await client.current();
  if (!config.documentExtraction?.jobNoticeOnly)
    throw new SourcePolicyError('JOB_DOCUMENT_SCOPE_REVIEW_REQUIRED');
  const fingerprint = configFingerprint(config);
  const found = await discover(client);
  const run: ReviewRun = {
    schemaVersion: 1,
    runId: randomUUID(),
    sourceId: config.id,
    configFingerprint: fingerprint,
    startedAt: new Date().toISOString(),
    state: 'running',
    discovery: {
      complete: found.complete,
      pages: found.pages.length,
      candidates: found.candidates.length,
      attachments: found.attachments,
      errors: found.errors,
      quarantined: found.quarantined,
    },
    documents: [],
    publicationApproved: false,
  };
  await checkpoint(run);
  if (!found.complete || !found.attachments.length) {
    run.state = 'incomplete';
    await checkpoint(run);
    return run;
  }
  for (const url of found.attachments) {
    const label =
      found.candidates.find((candidate) => candidate.attachments.includes(url))?.title ?? url;
    // Revocation/config change aborts the whole remaining batch before any next download.
    try {
      if (configFingerprint(await client.current()) !== fingerprint)
        throw new SourcePolicyError('CONFIG_CHANGED_DURING_RUN');
      const result = await acquireJobDocument(client, archive, url);
      run.documents.push({ url, label, state: 'extracted_needs_mapping', result });
    } catch (error) {
      const code =
        error instanceof Error && /^[A-Z_]+$/.test(error.message)
          ? error.message
          : 'DOCUMENT_EXTRACTION_FAILED';
      run.documents.push({ url, label, state: 'failed', error: code });
      if (error instanceof SourcePolicyError) {
        run.state = 'incomplete';
        await checkpoint(run);
        return run;
      }
    }
    await checkpoint(run);
  }
  run.state = run.documents.every((d) => d.state === 'extracted_needs_mapping')
    ? 'needs_review'
    : 'incomplete';
  await checkpoint(run);
  return run;
}

export async function writePrivateReview(root: string, run: ReviewRun, archive: ArtifactArchive) {
  const directory = path.resolve(root, 'reviews', run.runId);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(run, null, 2), {
    mode: 0o600,
  });
  const sections: string[] = [];
  for (const document of run.documents) {
    let pages = '';
    if (document.result) {
      try {
        const text = await archive.readText(document.result.captureId, document.result.textVersion);
        pages = text.pages
          .map(
            (p) =>
              `<h3>Page ${p.page} (${escapeHtml(p.method)})</h3><p>Flags: ${escapeHtml(p.flags.join(', ') || 'none')}</p><pre>${escapeHtml(p.text)}</pre>`,
          )
          .join('');
      } catch {
        pages =
          '<p>Text unavailable under current retention/access policy. No fallback copy displayed.</p>';
      }
    }
    sections.push(
      `<section><h2>${escapeHtml(document.label)}</h2><p>${escapeHtml(document.url)}</p><p>${escapeHtml(document.error ?? document.state)}</p>${document.result ? `<p>SHA-256: ${document.result.artifactSha256}</p><a download="${document.result.artifactSha256}.pdf" href="../../bytes/${document.result.artifactSha256}">Download original for trusted local viewer</a>` : ''}${pages}</section>`,
    );
  }
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width"><title>Private source review</title><h1>Private source review: ${escapeHtml(run.sourceId)}</h1><p>Status: ${run.state}. Nothing published. Extracted text is untrusted; compare every original page. Position/field mapping and completeness still require review.</p><p>Discovered documents: ${run.discovery.attachments.length}; attempted: ${run.documents.length}. Errors: ${escapeHtml(run.discovery.errors.join(', '))}. Quarantined: ${run.discovery.quarantined.length}.</p>${sections.join('')}</html>`;
  await writeFile(path.join(directory, 'report.html'), html, { mode: 0o600 });
  return path.join(directory, 'report.html');
}
