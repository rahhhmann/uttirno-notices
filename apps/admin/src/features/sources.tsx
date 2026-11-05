'use client';
import { useState } from 'react';
import type { SourceAssessment } from '@uttirno/contracts';
import { useAdmin, hasRole } from '../components/session';
import {
  dateLabel,
  Card,
  Check,
  Feedback,
  Json,
  Reason,
  SafeLink,
  field,
  parseJson,
  submitted,
  useAction,
  useLoad,
} from '../components/common';

export function Onboarding() {
  const { client, session } = useAdmin(),
    authority = useAction(),
    action = useAction(),
    registration = useAction();
  const [bundle, setBundle] = useState(''),
    [sample, setSample] = useState(''),
    [url, setUrl] = useState(''),
    [expected, setExpected] = useState(1);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof client.preview>> | null>(null),
    [reviewed, setReviewed] = useState(false);
  const change = () => {
    setPreview(null);
    setReviewed(false);
  };
  if (!hasRole(session.roles, ['source_approver']))
    return (
      <Card title="Source onboarding">
        <p>Your role can inspect sources; policy registration requires a source approver.</p>
      </Card>
    );
  return (
    <>
      <Card title="Register recruiting authority">
        <p>Use verified official ownership evidence. A domain suffix alone is not verification.</p>
        <form
          onSubmit={(event) => {
            const data = submitted(event),
              body = {
                id: field(data, 'authorityId'),
                name: field(data, 'authorityName'),
                evidence: [{ url: field(data, 'evidenceUrl'), note: field(data, 'evidenceNote') }],
              };
            void authority.run(
              body,
              (key) => client.registerAuthority(body, key),
              'Authority registered. It does not grant collection or display permission.',
            );
          }}
        >
          <div className="form-grid">
            <label>
              Authority ID
              <input name="authorityId" required maxLength={100} />
            </label>
            <label>
              Official authority name
              <input name="authorityName" required maxLength={1000} />
            </label>
            <label>
              Ownership evidence URL
              <input name="evidenceUrl" type="url" required />
            </label>
            <label>
              Evidence explanation
              <textarea name="evidenceNote" required maxLength={1000} />
            </label>
          </div>
          <button type="submit" disabled={authority.busy}>
            Register authority
          </button>
          <Feedback {...authority} />
        </form>
      </Card>
      <Card title="Review configuration against an offline sample">
        <p>
          Paste a versioned source bundle and a legitimately obtained sample. Nothing is fetched. A
          successful preview remains <strong>needs review</strong>; signing stays with the external
          trusted signer.
        </p>
        <label>
          Source bundle JSON
          <textarea
            aria-label="Source bundle JSON"
            value={bundle}
            onChange={(e) => {
              setBundle(e.target.value);
              change();
            }}
            maxLength={1500000}
            rows={10}
            spellCheck={false}
          />
        </label>
        <div className="form-grid">
          <label>
            Original sample URL
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                change();
              }}
            />
          </label>
          <label>
            Expected candidate count
            <input
              type="number"
              min={0}
              max={1000}
              value={expected}
              onChange={(e) => {
                setExpected(Number(e.target.value));
                change();
              }}
            />
          </label>
        </div>
        <label>
          HTML or JSON sample
          <textarea
            value={sample}
            onChange={(e) => {
              setSample(e.target.value);
              change();
            }}
            rows={8}
            maxLength={262144}
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          disabled={action.busy || !bundle || !sample || !url}
          onClick={() =>
            void action.run(
              { bundle, url, sample, expected },
              async (key) => {
                const result = await client.preview(
                  { bundle: parseJson(bundle), url, sample, expectedCandidates: expected },
                  key,
                );
                setPreview(result);
              },
              'Offline preview finished. Inspect every candidate, attachment and pagination link.',
            )
          }
        >
          Preview sample
        </button>
        <Feedback {...action} />
        {preview && (
          <>
            <p className="badge">
              {preview.matchesExpected ? 'Expected inventory matched' : 'Inventory mismatch'} ·
              needs review
            </p>
            <p>
              Sample SHA-256: <code>{preview.sampleSha256}</code>
            </p>
            <Json value={preview} />
            <Check id="source-review" checked={reviewed} onChange={setReviewed}>
              I compared the sample, selectors, all positions/attachments, origins and separate
              ownership/collection/display/retention evidence.
            </Check>
          </>
        )}
        <form
          onSubmit={(event) => {
            const data = submitted(event),
              authorityId = field(data, 'authorityId');
            void registration.run(
              { authorityId, bundle },
              (key) => client.registerSource({ authorityId, bundle: parseJson(bundle) }, key),
              'Configuration registered. Pauses remain in force; inspect the source before enabling collection or display.',
            );
          }}
        >
          <label>
            Registered authority ID
            <input name="authorityId" required maxLength={100} />
          </label>
          <button
            type="submit"
            disabled={!preview?.matchesExpected || !reviewed || registration.busy}
          >
            Register reviewed configuration
          </button>
          <Feedback {...registration} />
        </form>
      </Card>
    </>
  );
}
export function SourceDetail({ id }: { id: string }) {
  const { client } = useAdmin(),
    load = useLoad(() => client.source(id), `source:${id}`);
  return (
    <>
      <div className="toolbar">
        <h2>Source policy & controls</h2>
        <button onClick={load.reload} type="button">
          Reload source
        </button>
      </div>
      <Feedback busy={load.busy} error={load.error} />
      {load.data && <SourceControls key={`${id}:${load.data.epoch}`} source={load.data} />}
    </>
  );
}
function SourceControls({ source }: { source: SourceAssessment }) {
  const { client, session } = useAdmin(),
    controls = useAction(),
    schedule = useAction();
  const [collection, setCollection] = useState(source.collectionHalted),
    [display, setDisplay] = useState(source.displayHalted),
    [ack, setAck] = useState(false);
  const config = source.bundle.config as Record<string, unknown>;
  const expiry = typeof config.expiresAt === 'string' ? config.expiresAt : 'Not recorded';
  return (
    <>
      <Card title={String(config.authority ?? source.id)}>
        <dl>
          <dt>Source</dt>
          <dd>{source.id}</dd>
          <dt>Version / fingerprint</dt>
          <dd>
            {String(config.version)} / <code>{source.fingerprint}</code>
          </dd>
          <dt>Policy expires</dt>
          <dd>{dateLabel(expiry)}</dd>
          <dt>Collection eligibility</dt>
          <dd>
            {source.collection.allowed
              ? 'Signed collection policy eligible'
              : source.collection.code}
          </dd>
          <dt>Display eligibility</dt>
          <dd>
            {source.display.allowed ? 'Signed full-display policy eligible' : source.display.code}
          </dd>
          <dt>Live controls</dt>
          <dd>
            {source.collectionHalted ? 'Collection paused' : 'Collection enabled'} ·{' '}
            {source.displayHalted ? 'Display paused' : 'Display enabled'}
          </dd>
        </dl>
        <p>
          Eligibility is checked again by the API/worker. These controls never grant ownership or
          policy permission.
        </p>
        {hasRole(session.roles, ['source_approver']) && (
          <form
            onSubmit={(event) => {
              const data = submitted(event),
                body = {
                  expectedEpoch: source.epoch,
                  collectionHalted: collection,
                  displayHalted: display,
                  reason: field(data, 'reason'),
                };
              void controls.run({ id: source.id, ...body }, (key) =>
                client.controls(source.id, body, key),
              );
            }}
          >
            <Check id="collection-paused" checked={collection} onChange={setCollection}>
              Pause collection
            </Check>
            <Check id="display-paused" checked={display} onChange={setDisplay}>
              Pause public display
            </Check>
            <Check id="policy-reviewed" checked={ack} onChange={setAck}>
              I reviewed the current policy, exact origins and expiry. This change is accountable.
            </Check>
            <Reason />
            <button
              type="submit"
              disabled={
                !ack ||
                controls.busy ||
                (!collection && !source.collection.allowed) ||
                (!display && !source.display.allowed)
              }
            >
              Apply source controls
            </button>
            <Feedback {...controls} />
          </form>
        )}
      </Card>
      <Card title="Canary and collection run">
        <p>
          A canary requires an externally signed bounded config: one page, at most five requests and
          two MiB total. Resume approved collection first; then inspect the run before registering a
          wider signed version. The canary never publishes jobs.
        </p>
        {hasRole(session.roles, ['operator']) ? (
          <form
            onSubmit={(event) => {
              const data = submitted(event),
                mode = field(data, 'mode'),
                reason = field(data, 'reason');
              void schedule.run(
                { id: source.id, mode, reason },
                (key) =>
                  mode === 'canary'
                    ? client.canary(source.id, reason, key)
                    : client.schedule(source.id, reason, key),
                'Run scheduled. Inspect Operations for actual completion or policy/drift failures.',
              );
            }}
          >
            <label>
              Run mode
              <select name="mode">
                <option value="canary">Bounded canary</option>
                <option value="regular">Configured collection</option>
              </select>
            </label>
            <Reason id="schedule-reason" />
            <button
              type="submit"
              disabled={source.collectionHalted || !source.collection.allowed || schedule.busy}
            >
              Schedule run
            </button>
            <Feedback {...schedule} />
          </form>
        ) : (
          <p>An operator schedules runs after source approval.</p>
        )}
      </Card>
      <Card title="Ownership, policy, adapter and original sample evidence">
        <PolicyEvidence config={config} />
        <details>
          <summary>Inspect full versioned bundle</summary>
          <Json value={source.bundle} />
        </details>
        <h3>Version history</h3>
        <Json value={source.history} />
      </Card>
    </>
  );
}
function PolicyEvidence({ config }: { config: Record<string, unknown> }) {
  return (
    <>
      {['ownershipEvidence', 'policyEvidence', 'adapterSamples', 'origins', 'retention'].map(
        (key) => (
          <section className="subsection" key={key}>
            <h3>{key}</h3>
            {Array.isArray(config[key]) &&
              (config[key] as unknown[])
                .filter(
                  (e): e is { url: string; note: string } =>
                    e !== null && typeof e === 'object' && 'url' in e && 'note' in e,
                )
                .map((e) => (
                  <p key={`${key}-${e.url}-${e.note}`}>
                    <SafeLink url={e.url}>{e.note}</SafeLink>
                  </p>
                ))}
            <Json value={config[key] ?? 'Unknown / absent'} />
          </section>
        ),
      )}
    </>
  );
}
