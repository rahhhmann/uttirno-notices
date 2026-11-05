'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminApiClient } from '@uttirno/api-client';
import type { Role } from '@uttirno/contracts';
import { errorText } from './common';
type Session = Awaited<ReturnType<AdminApiClient['session']>>;
const Context = createContext<{ client: AdminApiClient; session: Session } | null>(null);
export function useAdmin() {
  const value = useContext(Context);
  if (!value) throw new Error('SESSION_REQUIRED');
  return value;
}
export function hasRole(roles: Role[], required: Role[]) {
  return roles.includes('administrator') || required.some((role) => roles.includes(role));
}
export function SessionProvider({
  children,
  brand,
  home,
}: {
  children: ReactNode;
  brand: string;
  home: string;
}) {
  const [client, setClient] = useState<AdminApiClient | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [state, setState] = useState('checking'),
    [error, setError] = useState(''),
    [dark, setDark] = useState(false),
    [authConfigured, setAuthConfigured] = useState(true);
  const pathname = usePathname();
  useEffect(() => {
    const api = new AdminApiClient({ baseUrl: window.location.origin });
    setClient(api);
    let active = true;
    const expire = () => {
      if (active) {
        setSession(null);
        setState('signed-out');
      }
    };
    window.addEventListener('uttirno-session-expired', expire);
    void api
      .session()
      .then((value) => {
        if (active) {
          setSession(value);
          setState('ready');
        }
      })
      .catch(async (e) => {
        if (active) {
          setSession(null);
          setState('signed-out');
          if (e.status !== 401) setError(errorText(e));
          else
            try {
              const availability = await api.authStatus();
              if (active) setAuthConfigured(availability.configured);
            } catch {
              if (active) setError('The identity service is unavailable. Reload to retry.');
            }
        }
      });
    try {
      const enabled = localStorage.getItem('uttirno-admin-theme') === 'dark';
      setDark(enabled);
      document.documentElement.dataset.theme = enabled ? 'dark' : 'light';
    } catch {
      /* Theme preference is optional; never store staff data. */
    }
    return () => {
      active = false;
      window.removeEventListener('uttirno-session-expired', expire);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    if (remaining <= 0) {
      setSession(null);
      setState('signed-out');
      return;
    }
    const timer = setTimeout(
      () => {
        setSession(null);
        setState('signed-out');
      },
      Math.min(remaining, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [session]);
  async function logout() {
    setError('');
    try {
      await client?.logout();
      setSession(null);
      setState('signed-out');
    } catch (e) {
      setError(errorText(e));
    }
  }
  const navigation = [
    ['/', 'Overview'],
    ['/sources', 'Sources'],
    ['/reviews', 'Review queue'],
    ['/duplicates', 'Duplicates'],
    ['/events', 'Notice events'],
    ['/operations', 'Operations'],
    ...(session?.roles.includes('administrator') ? [['/audit', 'Audit']] : []),
  ];
  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="topbar">
        <a href={home} className="brand">
          {brand}
          <span>Notice operations</span>
        </a>
        <div className="account">
          <button
            type="button"
            aria-pressed={dark}
            onClick={() => {
              const enabled = !dark;
              setDark(enabled);
              document.documentElement.dataset.theme = enabled ? 'dark' : 'light';
              try {
                localStorage.setItem('uttirno-admin-theme', enabled ? 'dark' : 'light');
              } catch {
                /* optional */
              }
            }}
          >
            Dark theme
          </button>
          {session && (
            <>
              <span>
                {session.actorId} · {session.roles.join(', ')}
              </span>
              <button type="button" onClick={() => void logout()}>
                Sign out
              </button>
            </>
          )}
        </div>
      </header>
      <div className="workspace">
        {session && (
          <nav aria-label="Administration">
            {navigation.map(([href, label]) => (
              <Link
                key={href}
                href={href ?? '/'}
                aria-current={pathname === href ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
        <main id="content" tabIndex={-1}>
          <p className="eyebrow">Official sources · Independent review</p>
          <h1 lang="bn">
            {
              '\u0989\u09a4\u09cd\u09a4\u09c0\u09b0\u09cd\u09a3 \u09aa\u09cd\u09b0\u09b6\u09be\u09b8\u09a8'
            }
          </h1>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {state === 'checking' ? (
            <p role="status">Checking your staff session...</p>
          ) : session && client ? (
            <Context value={{ client, session }}>{children}</Context>
          ) : (
            <section className="card">
              <h2>Staff sign in</h2>
              <p>
                Sign in with your provisioned identity. Public job browsing does not need a staff
                account.
              </p>
              {authConfigured ? (
                  <a className="button primary" href="/v1/admin/auth/login">
                    Continue with SSO
                  </a>
                ) : (
                  <p role="status">
                    Staff SSO is not configured. An administrator must connect the approved identity
                    provider.
                  </p>
                )}
              <p className="muted">
                Live SSO requires your configured provider and an explicit staff role. No default
                account exists.
              </p>
            </section>
          )}
        </main>
      </div>
      <footer>
        Evidence before publication. All times use Asia/Dhaka. No applications or payments are
        processed here.
      </footer>
    </>
  );
}
