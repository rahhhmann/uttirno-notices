'use client';
import Link from 'next/link';
import { useAdmin, hasRole } from '../components/session';
import { Card } from '../components/common';
import { Inventory, Health } from './inventory';
import { Onboarding, SourceDetail } from './sources';
import { Review } from './review';
import { CaseReview } from './cases';
export function AdminRoute({ path }: { path: string[] }) {
  const { session } = useAdmin();
  const [section, id] = path;
  if (path.length > 2)
    return (
      <Card title="Page not found">
        <Link href="/">Return to overview</Link>
      </Card>
    );
  if (!section)
    return (
      <>
        <Card title="Notice operations">
          <p>
            From a verified official source to an independently reviewed job. New extraction never
            overwrites a published revision.
          </p>
          <div className="overview-grid">
            <Link className="overview-link" href="/sources">
              <strong>01 · Source policy</strong>
              <span>Ownership, exact origins, sample inventory and separate permissions.</span>
            </Link>
            <Link className="overview-link" href="/reviews">
              <strong>02 · Independent review</strong>
              <span>Original documents, scoped facts, conflicts and publication history.</span>
            </Link>
            <Link className="overview-link" href="/operations">
              <strong>03 · Run health</strong>
              <span>Retries, checkpoints, drift and pauses. No fabricated success counts.</span>
            </Link>
          </div>
        </Card>
        <Card title="Your staff access">
          <p>{session.roles.join(', ')}</p>
          <p>
            Public browsing stays anonymous. Staff SSO does not grant consumer-app entitlements.
          </p>
        </Card>
      </>
    );
  if (section === 'sources')
    return id === 'onboard' ? (
      <Onboarding />
    ) : id ? (
      <SourceDetail id={id} />
    ) : (
      <Inventory resource="sources" title="Sources" />
    );
  if (section === 'reviews')
    return hasRole(session.roles, ['reviewer']) ? (
      id ? (
        <Review id={id} />
      ) : (
        <Inventory resource="revisions" title="Review queue" />
      )
    ) : (
      <Card title="Review access">
        <p>Independent revision review requires a reviewer role.</p>
      </Card>
    );
  if (section === 'duplicates' || section === 'events')
    return id ? (
      hasRole(session.roles, ['reviewer']) ? (
        <CaseReview kind={section === 'duplicates' ? 'duplicate' : 'event'} id={id} />
      ) : (
        <Card title="Case access">
          <p>Case evidence requires a reviewer role.</p>
        </Card>
      )
    ) : (
      <Inventory
        resource={section}
        title={section === 'duplicates' ? 'Duplicates' : 'Notice events'}
      />
    );
  if (section === 'operations')
    return (
      <>
        <Card title="Health, drift and recovery">
          <p>
            These are persisted run and stage states, not a claim that every worker is healthy.
            Inspect failed/blocked stages, pause collection in Sources, fix reviewed configuration
            and schedule a gated rerun.
          </p>
          <p>
            Policy expiry and trust are rechecked at execution/public read. A successful process
            heartbeat alone cannot certify extraction completeness.
          </p>
        </Card>
        <Health />
        <Inventory resource="runs" title="Runs" />
        <Inventory resource="stages" title="Stage health" />
      </>
    );
  if (section === 'audit')
    return session.roles.includes('administrator') ? (
      <Inventory resource="audit" title="Audit" />
    ) : (
      <Card title="Audit access">
        <p>Audit access requires administrator permission.</p>
      </Card>
    );
  return (
    <Card title="Page not found">
      <Link href="/">Return to overview</Link>
    </Card>
  );
}
