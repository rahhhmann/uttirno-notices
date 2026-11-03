import { ExtractionPlanSchema } from '@uttirno/contracts';
import { configFingerprint } from '@uttirno/source-config';
import { extractPositions } from '@uttirno/domain';
import type { SourceClient } from '../fetch/client.js';
import { type ArtifactArchive, sha256 } from './archive.js';
import { extractPdf } from './native.js';
// Operator-selected public job notices only. Does not crawl result PDFs or applicant data.
export async function acquireJobDocument(
  client: SourceClient,
  archive: ArtifactArchive,
  url: string,
  planInput?: unknown,
) {
  const policy = await archive.check(url); // retention gate BEFORE network
  const fingerprint = configFingerprint(policy);
  if (configFingerprint(await client.current()) !== fingerprint)
    throw new Error('SOURCE_POLICY_MISMATCH');
  const page = await client.get(url); // all M2 robots/SSRF/rate/permission protections
  if (
    configFingerprint(await client.current()) !== fingerprint ||
    page.configVersion !== policy.version ||
    sha256(page.body) !== page.sha256
  )
    throw new Error('ACQUISITION_LINEAGE_MISMATCH');
  if (page.headers['content-type']?.split(';')[0]?.trim() !== 'application/pdf')
    throw new Error('EXPECTED_PDF_CONTENT_TYPE');
  const capture = await archive.capture(page.body, page.url, 'application/pdf', {
    fingerprint,
    capturedAt: page.capturedAt,
    status: page.status,
    headers: page.headers,
  });
  const text = await extractPdf(
    page.body,
    { sourceId: policy.id, configFingerprint: fingerprint },
    { forceOcr: policy.documentExtraction?.forceOcr ?? false },
  );
  await archive.storeText(capture.captureId, text);
  const positions =
    planInput === undefined ? [] : extractPositions(text, ExtractionPlanSchema.parse(planInput));
  return {
    captureId: capture.captureId,
    artifactSha256: text.artifactSha256,
    textVersion: text.textVersion,
    pages: text.pages.length,
    positions,
    state: 'needs_review' as const,
    publicationApproved: false as const,
  };
}
