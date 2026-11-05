'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import type { AdminResource } from '@uttirno/contracts';
import { useAdmin, hasRole } from '../components/session';
import {
  Card,
  Feedback,
  Json,
  Reason,
  dateLabel,
  field,
  submitted,
  useAction,
  useLoad,
} from '../components/common';

export function Inventory({ resource, title }: { resource: AdminResource; title: string }) {
  const { client, session } = useAdmin();
  const page = useLoad(() => client.inventory(resource), resource);
  const next = useAction();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]),
    [cursor, setCursor] = useState<string | null>(null);
  useEffect(() => {
    if (page.data) {
      setRows(page.data.items);
      setCursor(page.data.nextCursor);
    }
  }, [page.data]);
  const link = (row: Record<string, unknown>) =>
    resource === 'sources'
      ? `/sources/${encodeURIComponent(String(row.id))}`
      : resource === 'revisions'
        ? `/reviews/${String(row.id)}`
        : ['duplicates', 'events'].includes(resource)
          ? `/${resource}/${String(row.id)}`
          : null;
  return (
    <Card title={title}>
      <div className="toolbar">
        <p className="muted">Live API records. Review states and timestamps before acting.</p>
        <button type="button" onClick={page.reload}>
          Refresh {title.toLowerCase()}
        </button>
        {resource === 'sources' && hasRole(session.roles, ['source_approver']) && (
          <Link className="button primary" href="/sources/onboard">
            Onboard source
          </Link>
        )}
      </div>
      <Feedback busy={page.busy} error={page.error || next.error} />
      {!page.busy && page.data && rows.length === 0 ? (
        <p>No records in this queue.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col">Record</th>
                <th scope="col">State / reason</th>
                <th scope="col">Recorded / checked</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  <td>
                    {link(row) ? (
                      <Link href={link(row) ?? '/'}>
                        <code>{String(row.id)}</code>
                      </Link>
                    ) : (
                      <code>{String(row.id)}</code>
                    )}
                    <small>{String(row.source_id ?? row.authority_id ?? row.action ?? '')}</small>
                  </td>
                  <td>
                    <span className="badge">
                      {String(
                        row.state ??
                          (resource === 'sources'
                            ? row.collection_halted
                              ? 'Collection paused'
                              : 'Collection enabled'
                            : resource === 'audit'
                              ? 'Recorded'
                              : row.resolved_by
                                ? 'Resolved'
                                : 'Needs review'),
                      )}
                    </span>
                    {Boolean(row.error_code) && <p className="error">{String(row.error_code)}</p>}
                    {Boolean(row.reason) && <p>{String(row.reason)}</p>}
                  </td>
                  <td>{dateLabel(row.created_at ?? row.updated_at ?? row.last_checked)}</td>
                  <td>
                    <details>
                      <summary>Inspect record</summary>
                      <Json value={row} />
                    </details>
                    {resource === 'runs' && hasRole(session.roles, ['operator']) && (
                      <RunRetry row={row} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && (
        <button
          type="button"
          disabled={next.busy}
          onClick={() =>
            void next.run(
              { resource, cursor },
              async () => {
                const result = await client.inventory(resource, cursor);
                setRows((old) => [...old, ...result.items]);
                setCursor(result.nextCursor);
              },
              'Next page loaded.',
            )
          }
        >
          Load more
        </button>
      )}
    </Card>
  );
}

function RunRetry({ row }: { row: Record<string, unknown> }) {
  const { client } = useAdmin(),
    action = useAction();
  const retryable = ['failed', 'blocked', 'complete'].includes(String(row.state));
  return (
    <form
      onSubmit={(event) => {
        const data = submitted(event),
          reason = field(data, 'reason');
        void action.run(
          { runId: row.id, reason },
          (key) => client.rerun(String(row.id), reason, key),
          'Rerun scheduled through current source gates. Refresh the run queue.',
        );
      }}
    >
      <Reason id={`retry-${String(row.id)}`} />
      <button type="submit" disabled={!retryable || action.busy}>
        Schedule rerun
      </button>
      <Feedback {...action} />
    </form>
  );
}

export function Health() {
  const { client } = useAdmin(),
    load = useLoad(() => client.health(), 'health');
  return (
    <Card title="API dependency health">
      <button type="button" onClick={load.reload}>
        Refresh dependency health
      </button>
      <Feedback busy={load.busy} error={load.error} />
      {load.data && (
        <>
          <p>
            {load.data.ready ? 'Ready' : 'Not ready'} at {dateLabel(load.data.checkedAt)}
          </p>
          <dl>
            {Object.entries(load.data.dependencies).map(([name, healthy]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{healthy ? 'Available' : 'Unavailable'}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Card>
  );
}
