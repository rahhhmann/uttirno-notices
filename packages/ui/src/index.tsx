import type { ReactNode } from 'react';
export function SkipLink({ children }: { children: ReactNode }) {
  return (
    <a className="skip" href="#content">
      {children}
    </a>
  );
}
export function FoundationNotice({ title, description }: { title: string; description: string }) {
  return (
    <section aria-labelledby="foundation-title">
      <small>Uttirno · M1 Foundation</small>
      <h1 id="foundation-title">{title}</h1>
      <p>{description}</p>
    </section>
  );
}
