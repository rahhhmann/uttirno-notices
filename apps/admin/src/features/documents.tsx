'use client';
import { useEffect, useState } from 'react';
import type { DocumentText, LocatedEvidence } from '@uttirno/contracts';
import { useAdmin } from '../components/session';
import { Card, Feedback, SafeLink, Check, useLoad, dateLabel } from '../components/common';

export function Documents({
  documents,
  selection,
  onQuality,
  quality,
}: {
  documents: DocumentText[];
  selection: LocatedEvidence | null;
  onQuality?: (version: string, page: number, checked: boolean) => void;
  quality?: Record<string, number[]>;
}) {
  const { client } = useAdmin();
  const [version, setVersion] = useState(documents[0]?.textVersion ?? ''),
    [number, setNumber] = useState(1);
  useEffect(() => {
    if (selection) {
      setVersion(selection.textVersion);
      setNumber(selection.page);
    }
  }, [selection]);
  const doc = documents.find((d) => d.textVersion === version) ?? documents[0],
    page = doc?.pages.find((p) => p.page === number) ?? doc?.pages[0];
  const original = useLoad(() => client.originalInfo(version), `original:${version}`);
  const evidence =
    selection?.textVersion === doc?.textVersion && selection?.page === page?.page
      ? selection
      : null;
  const text = page?.text ?? '',
    valid = evidence && text.slice(evidence.start, evidence.end) === evidence.quote;
  return (
    <Card title="Original document and scoped evidence">
      <p className="muted">
        Extracted text is untrusted data. Inspect the retained original document in your trusted
        viewer before attesting page quality; the text view alone cannot establish layout or OCR
        correctness.
      </p>
      <label>
        Document version
        <select
          value={doc?.textVersion ?? ''}
          onChange={(e) => {
            setVersion(e.target.value);
            setNumber(1);
          }}
        >
          {documents.map((d) => (
            <option key={d.textVersion} value={d.textVersion}>
              {d.artifactSha256.slice(0, 16)} · {d.pages.length} page(s)
            </option>
          ))}
        </select>
      </label>
      <label>
        Page
        <select value={page?.page ?? 1} onChange={(e) => setNumber(Number(e.target.value))}>
          {doc?.pages.map((p) => (
            <option key={p.page} value={p.page}>
              {p.page} · {p.method}
              {p.flags.length ? ' · quality review required' : ''}
            </option>
          ))}
        </select>
      </label>
      <Feedback busy={original.busy} error={original.error} />
      {original.data && (
        <>
          <p>
            <SafeLink url={original.data.url}>Official document location</SafeLink>
          </p>
          <p>
            Captured: {dateLabel(original.data.capturedAt)} · <code>{original.data.sha256}</code>
          </p>
          <a className="button" href={client.originalUrl(version)} download>
            Download retained original
          </a>
          <p className="muted">
            The file is hash-checked and permission-gated again. An unavailable archive is an error,
            never a substitute original.
          </p>
          <OriginalView
            key={`${version}:${page?.page ?? 1}`}
            version={version}
            page={page?.page ?? 1}
            mediaType={original.data.mediaType}
          />
        </>
      )}
      {evidence && (
        <p className={valid ? 'badge' : 'error'}>
          {valid ? 'Exact quote at recorded page offsets' : 'Evidence does not match this page'} ·
          scope {evidence.scopeId} · offsets {evidence.start}–{evidence.end}
        </p>
      )}
      <section className="document-page" aria-label={`Extracted page ${page?.page ?? 1}`}>
        {valid && evidence ? (
          <>
            {text.slice(0, evidence.start)}
            <mark>{text.slice(evidence.start, evidence.end)}</mark>
            {text.slice(evidence.end)}
          </>
        ) : (
          text
        )}
      </section>
      {page?.flags.length ? (
        <p className="warning">Page flags: {page.flags.join(', ')}</p>
      ) : (
        <p>No engine flags. This is not proof of original-page accuracy.</p>
      )}
      {onQuality && doc && page && page.flags.length > 0 && (
        <Check
          id={`quality-${doc.textVersion}-${page.page}`}
          checked={quality?.[doc.textVersion]?.includes(page.page) ?? false}
          onChange={(checked) => onQuality(doc.textVersion, page.page, checked)}
        >
          I compared this flagged page against the retained original and accept its text/layout for
          this review.
        </Check>
      )}
      <details>
        <summary>Text version and engine provenance</summary>
        <p>
          <code>{doc?.textVersion}</code>
        </p>
        <p>{doc?.engine}</p>
      </details>
    </Card>
  );
}
function OriginalView({
  version,
  page,
  mediaType,
}: {
  version: string;
  page: number;
  mediaType: string;
}) {
  const { client } = useAdmin(),
    [failed, setFailed] = useState(false);
  if (mediaType === 'application/pdf')
    return (
      <section aria-label={`Retained PDF page ${page}`}>
        <h3>Retained original page {page}</h3>
        {failed ? (
          <p role="alert" className="error">
            Original page rendering failed. Do not attest this page from extracted text alone.
          </p>
        ) : (
          // biome-ignore lint/performance/noImgElement: Private authenticated page images must bypass the public optimizer and retain staff cookies.
          <img
            className="original-page"
            src={client.originalPageUrl(version, page)}
            alt={`Hash-verified retained original PDF page ${page}`}
            onError={() => setFailed(true)}
          />
        )}
      </section>
    );
  return <OriginalText version={version} />;
}
function OriginalText({ version }: { version: string }) {
  const { client } = useAdmin(),
    load = useLoad(() => client.originalText(version), `original-text:${version}`);
  return (
    <section aria-label="Retained original text">
      <h3>Retained original (literal UTF-8 view)</h3>
      <Feedback busy={load.busy} error={load.error} />
      {load.data && (
        <>
          {load.data.truncated && (
            <p className="warning">
              Preview truncated. Download the complete original before reviewing coverage.
            </p>
          )}
          <pre className="original-text">{load.data.text}</pre>
        </>
      )}
    </section>
  );
}
