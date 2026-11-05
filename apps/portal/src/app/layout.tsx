import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';
import '@uttirno/ui/tokens.css';
import { SkipLink } from '@uttirno/ui';
import Link from 'next/link';
import { settings } from '../lib/settings';
export const metadata: Metadata = {
  title: 'Uttirno Job Portal',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default function RootLayout({ children }: { children: ReactNode }) {
  const { home, brand } = settings();
  return (
    <html lang="bn">
      <body>
        <SkipLink>মূল অংশে যান / Skip to content</SkipLink>
        <header>
          <a href={home}>{brand}</a>
          <nav aria-label="Main">
            <Link href="/jobs">চাকরি / Jobs</Link>
          </nav>
        </header>
        <main id="content" tabIndex={-1}>
          {children}
        </main>
        <footer>
          অফিশিয়াল বিজ্ঞপ্তি পড়ুন / Always read the official notice. <a href={home}>Uttirno</a>
        </footer>
      </body>
    </html>
  );
}
