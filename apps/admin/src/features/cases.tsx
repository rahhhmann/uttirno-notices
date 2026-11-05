'use client';
import { useState } from 'react';
import { LocatedEvidenceSchema } from '@uttirno/contracts';
import { useAdmin, hasRole } from '../components/session';
import {
  Card,
  Check,
  Feedback,
  Json,
  Reason,
  field,
  parseJson,
  submitted,
  useAction,
  useLoad,
} from '../components/common';
import { Documents } from './documents';
import { Fields, PublishedPositions } from './review';
export function CaseReview({ kind, id }: { kind: 'duplicate' | 'event'; id: string }) {
  const { client, session } = useAdmin(),
    load = useLoad(() => client.case(kind, id), `${kind}:${id}`);
  return (
    <>
      <div className="toolbar">
        <h2>{kind === 'duplicate' ? 'Duplicate identity review' : 'Notice event review'}</h2>
        <button type="button" onClick={load.reload}>
          Reload case
        </button>
      </div>
      <Feedback busy={load.busy} error={load.error} />
      {load.data && hasRole(session.roles, ['reviewer']) && (
        <Case
          key={`${id}:${String(load.data.record.state)}:${String(load.data.record.resolvedBy)}`}
          value={load.data}
        />
      )}
    </>
  );
}
function Case({
  value,
}: {
  value: Awaited<ReturnType<ReturnType<typeof useAdmin>['client']['case']>>;
}) {
  const { client, session } = useAdmin(),
    action = useAction(),
    [ack, setAck] = useState(false),
    [finished, setFinished] = useState(false),
    [selected, setSelected] = useState(
      LocatedEvidenceSchema.safeParse(value.record.evidence).data ?? null,
    ),
    [quality, setQuality] = useState<Record<string, number[]>>({});
  const decided =
      Boolean(value.record.resolvedBy) ||
      value.record.state === 'approved' ||
      value.record.state === 'rejected',
    creator = value.record.creator === session.actorId;
  const qualityDone = value.documents.every((doc) =>
    doc.pages.every((page) => !page.flags.length || quality[doc.textVersion]?.includes(page.page)),
  );
  return (
    <>
      <Card title="Case evidence">
        <Json value={value.record} />
        {creator && <p className="warning">An independent reviewer must decide this case.</p>}
        {decided && <p>This case already has a decision.</p>}
      </Card>
      <div className="review-grid">
        <Card title="Affected positions and inventory">
          {value.bundle ? (
            <Fields bundle={value.bundle} onEvidence={setSelected} />
          ) : (
            <Json value={value.positions} />
          )}
          <Json value={value.inventory} />
        </Card>
        <Documents
          documents={value.documents}
          selection={selected}
          quality={quality}
          onQuality={(version, page, checked) =>
            setQuality((old) => ({
              ...old,
              [version]: checked
                ? [...new Set([...(old[version] ?? []), page])]
                : (old[version] ?? []).filter((v) => v !== page),
            }))
          }
        />
      </div>
      <Card
        title={
          value.kind === 'duplicate' ? 'Resolve canonical identity' : 'Independent event decision'
        }
      >
        <form
          onSubmit={(event) => {
            const data = submitted(event),
              reason = field(data, 'reason'),
              decision = field(data, 'decision');
            if (value.kind === 'duplicate')
              void action
                .run(
                  {
                    id: value.id,
                    memo: field(data, 'memo'),
                    postKeys: field(data, 'postKeys'),
                    reason,
                  },
                  (key) =>
                    client.resolve(
                      value.id,
                      {
                        memo: field(data, 'memo'),
                        postKeys: parseJson(field(data, 'postKeys')) as Record<string, string>,
                        reason,
                      },
                      key,
                    ),
                  'Identity resolved into a new draft. Review that revision independently before publishing.',
                )
                .then((ok) => {
                  if (ok) setFinished(true);
                });
            else if (['approved', 'rejected'].includes(decision))
              void action
                .run(
                  { id: value.id, decision, reason, quality },
                  (key) =>
                    client.decideEvent(
                      value.id,
                      {
                        decision: decision as 'approved' | 'rejected',
                        reason,
                        ...(decision === 'approved'
                          ? {
                              attestation: {
                                textVersion: value.documents[0]?.textVersion ?? '',
                                acceptedQualityPages:
                                  quality[value.documents[0]?.textVersion ?? ''] ?? [],
                              },
                            }
                          : {}),
                      },
                      key,
                    ),
                  'Event decision recorded. Rejected critical events still require an explicit versioned restore.',
                )
                .then((ok) => {
                  if (ok) setFinished(true);
                });
          }}
        >
          {value.kind === 'duplicate' && (
            <>
              <label>
                Verified authority memo
                <input name="memo" required maxLength={200} />
              </label>
              <label>
                Scope ID to verified original post code mapping (JSON)
                <textarea
                  name="postKeys"
                  required
                  rows={5}
                  maxLength={20000}
                  placeholder={'{"scope-id":"verified-original-post-code"}'}
                />
              </label>
              <p>
                No automatic merge is performed. Use the original memo and each position's actual
                identity.
              </p>
            </>
          )}
          <Check id="case-reviewed" checked={ack} onChange={setAck}>
            I compared original pages, scoped evidence and all affected positions before deciding.
          </Check>
          <Reason />
          <div className="toolbar">
            {value.kind === 'duplicate' ? (
              <button
                type="submit"
                className="primary"
                disabled={!ack || creator || decided || finished || action.busy}
              >
                Resolve into draft
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  name="decision"
                  value="approved"
                  className="primary"
                  disabled={!ack || !qualityDone || creator || decided || finished || action.busy}
                >
                  Approve event
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="rejected"
                  disabled={!ack || creator || decided || finished || action.busy}
                >
                  Reject event
                </button>
              </>
            )}
          </div>
          <Feedback {...action} />
        </form>
      </Card>
      {value.kind === 'event' && <PublishedPositions positions={value.positions} />}
    </>
  );
}
