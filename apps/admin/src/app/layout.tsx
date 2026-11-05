import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';
import '@uttirno/ui/tokens.css';
import { SessionProvider } from '../components/session';
import { publicSettings } from '../lib/settings';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Uttirno Administration',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider {...publicSettings(process.env)}>{children}</SessionProvider>
      </body>
    </html>
  );
}
