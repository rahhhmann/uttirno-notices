'use client';
import { useState } from 'react';
import {
  apiFieldNames,
  type ExtractedFact,
  type LocatedEvidence,
  type RevisionBundle,
} from '@uttirno/contracts';
import { useAdmin, hasRole } from '../components/session';
import {
  Card,
  Check,
  Feedback,
  Json,
  Reason,
  field,
  submitted,
  useAction,
  useLoad,
} from '../components/common';
import { Documents } from './documents';

export function Fields({
  bundle,
  onEvidence,
}: {
  bundle: RevisionBundle;
  onEvidence: (e: LocatedEvidence) => void;
}) {
  return (
    <>
      {bundle.entries.flatMap((entry) =>
        entry.positions.map((position) => (
          <section className="subsection" key={`${entry.textVersion}-${position.positionId}`}>
            <h3>Position: {position.positionId}</h3>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Fields for {position.positionId}</caption>
                <thead>
                  <tr>
                    <th scope="col">Field</th>
                    <th scope="col">Source value / status</th>
                    <th scope="col">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {apiFieldNames.map((name) => {
                    const fact = position.fields[name];
                    return (
                      <tr key={name}>
                        <th scope="row">
                          {name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}
                        </th>
                        <td>
                          <Fact fact={fact} />
                        </td>
                        <td>
                          {(fact.status === 'stated'
                            ? [fact.candidate]
                            : fact.status === 'conflicting'
                              ? fact.candidates
                              : []
                          ).map((candidate) => (
                            <button
                              className="link-button"
                              type="button"
                              key={`${name}-${candidate.evidence.start}-${candidate.evidence.textVersion}`}
                              onClick={() => onEvidence(candidate.evidence)}
                            >
                              Page {candidate.evidence.page}, {candidate.evidence.scopeId}:{' '}
                              {candidate.evidence.quote}
                            </button>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )),
      )}
    </>
  );
}
function Fact({ fact }: { fact: ExtractedFact }) {
  if (fact.status !== 'stated' && fact.status !== 'conflicting')
    return <span className="badge">{fact.status.replaceAll('_', ' ')}</span>;
  const candidates = fact.status === 'stated' ? [fact.candidate] : fact.candidates;
  return (
    <>
      {fact.status === 'conflicting' && (
        <strong className="error">Conflicting source values — publication blocked</strong>
      )}
      {candidates.map((candidate) => (
        <div key={`${candidate.normalized}-${candidate.evidence.start}`}>
          <p>{candidate.raw}</p>
          <small>
            Normalized: {candidate.normalized} · {candidate.derivation}
          </small>
        </div>
      ))}
    </>
  );
}
export function Review({ id }: { id: string }) {
  const { client, session } = useAdmin(),
    load = useLoad(
      async () => ({ snapshot: await client.review(id), context: await client.context(id) }),
      `review:${id}`,
    );
  return (
    <>
      <div className="toolbar">
        <h2>Revision review</h2>
        <button type="button" onClick={load.reload}>
          Reload revision
        </button>
      </div>
      <Feedback busy={load.busy} error={load.error} />
      {load.data && (
        <RevisionReview
          key={`${id}:${load.data.context.currentGeneration}:${load.data.context.state}`}
          snapshot={load.data.snapshot}
          context={load.data.context}
          authorized={hasRole(session.roles, ['reviewer'])}
        />
      )}
    </>
  );
}
function RevisionReview({
  snapshot,
  context,
  authorized,
}: {
  snapshot: Awaited<ReturnType<ReturnType<typeof useAdmin>['client']['review']>>;
  context: Awaited<ReturnType<ReturnType<typeof useAdmin>['client']['context']>>;
  authorized: boolean;
}) {
  const { client, session } = useAdmin(),
    action = useAction(),
    [selected, setSelected] = useState<LocatedEvidence | null>(null),
    [originals, setOriginals] = useState(false),
    [fields, setFields] = useState(false),
    [quality, setQuality] = useState<Record<string, number[]>>({}),
    [supports, setSupports] = useState<Record<string, string>>({}),
    [resolves, setResolves] = useState<string[]>([]),
    [finished, setFinished] = useState(false);
  const blockers = snapshot.bundle.entries.flatMap((entry) =>
    entry.positions.flatMap((position) =>
      apiFieldNames
        .filter((name) => ['conflicting', 'not_extracted'].includes(position.fields[name].status))
        .map((name) => `${position.positionId}: ${name}`),
    ),
  );
  const stale = context.currentGeneration !== snapshot.generation || context.state !== 'draft';
  const creator = session.actorId === snapshot.createdBy;
  const qualityDone = snapshot.documents.every((doc) =>
    doc.pages.every((page) => !page.flags.length || quality[doc.textVersion]?.includes(page.page)),
  );
  const supportDone = snapshot.bundle.supportingDocuments.every((version) =>
    supports[version]?.trim(),
  );
  const canApprove =
    authorized &&
    !creator &&
    !stale &&
    !finished &&
    originals &&
    fields &&
    qualityDone &&
    supportDone &&
    blockers.length === 0;
  function changeQuality(version: string, page: number, checked: boolean) {
    setQuality((previous) => ({
      ...previous,
      [version]: checked
        ? [...new Set([...(previous[version] ?? []), page])]
        : (previous[version] ?? []).filter((v) => v !== page),
    }));
  }
  return (
    <>
      <Card title={`Generation ${snapshot.generation} · ${context.state}`}>
        <p>
          Source: {snapshot.sourceId} · Created by {snapshot.createdBy} · Current generation:{' '}
          {context.currentGeneration}
        </p>
        {creator && (
          <p className="warning">You created this revision. A different reviewer must decide.</p>
        )}
        {stale && (
          <p className="warning">
            This revision is already decided or superseded. Reload before taking any action.
          </p>
        )}
        {blockers.length > 0 && <p className="error">Unresolved fields: {blockers.join('; ')}</p>}
        <details>
          <summary>Inventory and review history</summary>
          <Json value={snapshot.inventory} />
          <Json value={context.actions} />
        </details>
      </Card>
      <div className="review-grid">
        <Card title="Position fields">
          <Fields bundle={snapshot.bundle} onEvidence={setSelected} />
        </Card>
        <div className="document-column">
          <Documents
            documents={snapshot.documents}
            selection={selected}
            quality={quality}
            onQuality={changeQuality}
          />
        </div>
      </div>
      <Card title="Independent publication decision">
        <form
          onSubmit={(event) => {
            const data = submitted(event),
              decision = field(data, 'decision'),
              reason = field(data, 'reason');
            if (
              !['approve', 'reject'].includes(decision) ||
              (decision === 'approve' && !canApprove)
            )
              return;
            const body = {
              expectedGeneration: snapshot.generation,
              reason,
              attestation: {
                ...snapshot.attestation,
                acceptedQualityPages: quality,
                supportingReviews: supports,
              },
              resolves,
            };
            void action
              .run(
                { id: snapshot.id, decision, ...body },
                (key) =>
                  decision === 'approve'
                    ? client.approve(snapshot.id, body, key)
                    : client.reject(
                        snapshot.id,
                        { expectedGeneration: snapshot.generation, reason },
                        key,
                      ),
                decision === 'approve'
                  ? 'Revision approved. Public queries still enforce current permissions. Reload to inspect published positions.'
                  : 'Revision rejected. No candidate facts were published.',
              )
              .then((ok) => {
                if (ok) setFinished(true);
              });
          }}
        >
          <Check id="originals-reviewed" checked={originals} onChange={setOriginals}>
            I compared all original pages, attachments and position coverage, including absence
            claims and flagged pages.
          </Check>
          <Check id="fields-reviewed" checked={fields} onChange={setFields}>
            I checked every field against its correct source, version, page and position. Unknowns
            remain explicit.
          </Check>
          {snapshot.bundle.supportingDocuments.map((version) => (
            <label key={version}>
              Supporting document review: {version.slice(0, 16)}
              <textarea
                value={supports[version] ?? ''}
                onChange={(e) => setSupports((prev) => ({ ...prev, [version]: e.target.value }))}
                maxLength={2000}
              />
            </label>
          ))}
          {context.events
            .filter((event) => event.state === 'pending')
            .map((event) => (
              <Check
                id={`resolve-${String(event.id)}`}
                key={String(event.id)}
                checked={resolves.includes(String(event.id))}
                onChange={(checked) =>
                  setResolves((old) =>
                    checked ? [...old, String(event.id)] : old.filter((id) => id !== event.id),
                  )
                }
              >
                This replacement resolves event {String(event.kind)} ({String(event.id)}); I
                compared the affected positions and event evidence.
              </Check>
            ))}
          <Reason />
          <div className="toolbar">
            <button
              type="submit"
              className="primary"
              name="decision"
              value="approve"
              disabled={!canApprove || action.busy}
            >
              Approve revision
            </button>
            <button
              type="submit"
              className="danger"
              name="decision"
              value="reject"
              disabled={!authorized || creator || stale || finished || action.busy}
            >
              Reject revision
            </button>
          </div>
          <Feedback {...action} />
        </form>
      </Card>
      <PublishedPositions positions={context.positions} />
    </>
  );
}
export function PublishedPositions({
  positions,
}: {
  positions: Awaited<ReturnType<ReturnType<typeof useAdmin>['client']['context']>>['positions'];
}) {
  return (
    <Card title="Position publication controls">
      {positions.length === 0 ? (
        <p>No canonical positions yet.</p>
      ) : (
        positions.map((position) => <PositionControl key={position.id} position={position} />)
      )}
    </Card>
  );
}
function PositionControl({
  position,
}: {
  position: Parameters<typeof PublishedPositions>[0]['positions'][number];
}) {
  const { client } = useAdmin(),
    action = useAction(),
    [ack, setAck] = useState(false);
  return (
    <form
      className="subsection"
      onSubmit={(event) => {
        const data = submitted(event),
          body = {
            expectedRevision: position.revisionId ?? '',
            expectedGeneration: position.generation,
            reason: field(data, 'reason'),
          };
        void action.run({ id: position.id, restore: position.suppressed, ...body }, (key) =>
          position.suppressed
            ? client.restore(position.id, body, key)
            : client.suppress(position.id, body, key),
        );
      }}
    >
      <h3>
        {position.postKey} · {position.suppressed ? 'Suppressed / unpublished' : 'Published'}
      </h3>
      <p>
        <code>{position.id}</code>
      </p>
      <Check id={`position-${position.id}`} checked={ack} onChange={setAck}>
        I checked this position's current revision, event decisions and generation.
      </Check>
      <Reason id={`reason-${position.id}`} />
      <button type="submit" disabled={!ack || !position.revisionId || action.busy}>
        {position.suppressed ? 'Restore reviewed facts' : 'Suppress facts'}
      </button>
      <Feedback {...action} />
    </form>
  );
}
