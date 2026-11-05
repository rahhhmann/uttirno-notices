import type { ReactNode } from 'react';
import { safeLink } from '../lib/settings';
export function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  const safe = safeLink(href);
  return safe ? (
    <a href={safe} rel="noreferrer">
      {children} ↗ <small>({new URL(safe).host})</small>
    </a>
  ) : (
    <span>{children} — unavailable</span>
  );
}
export function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel" role="status">
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}
