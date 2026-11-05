'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ApiClientError } from '@uttirno/api-client';

export function errorText(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) window.dispatchEvent(new Event('uttirno-session-expired'));
    const message =
      error.status === 409
        ? 'This record changed or was already reviewed. Reload it before deciding.'
        : error.status === 403
          ? 'Your role or the current source policy does not allow this action.'
          : error.status === 422
            ? 'Policy or evidence checks rejected this action. Review the source, original documents and evidence.'
            : error.status === 400
              ? 'Check the required fields and JSON format.'
              : error.status === 401
                ? 'Your session ended. Sign in again.'
                : 'The service is unavailable. Retry the same action after checking its state.';
    return `${message}${error.requestId ? ` Reference: ${error.requestId}` : ''}`;
  }
  return 'Check the required fields and JSON structure. The action has not been confirmed.';
}
export function useLoad<T>(loader: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true),
    [version, setVersion] = useState(0);
  const ref = useRef(loader);
  ref.current = loader;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Resource identity and explicit refresh invalidate the latest loader.
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    setData(null);
    void ref
      .current()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [key, version]);
  return { data, error, busy, reload: () => setVersion((v) => v + 1) };
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const pending = useRef(false),
    attempt = useRef<{ input: string; key: string } | null>(null);
  async function run(
    input: unknown,
    action: (key: string) => Promise<unknown>,
    success = 'Action recorded. Refresh the record to see its current state.',
  ) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setMessage('');
    setError('');
    const signature = JSON.stringify(input);
    if (attempt.current?.input !== signature)
      attempt.current = { input: signature, key: crypto.randomUUID() };
    try {
      await action(attempt.current.key);
      setMessage(success);
      attempt.current = null;
      return true;
    } catch (e) {
      setError(errorText(e));
      if (e instanceof ApiClientError && e.status >= 400 && e.status < 500) attempt.current = null;
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { busy, message, error, run };
}
export function Feedback({
  busy,
  error,
  message,
}: {
  busy?: boolean;
  error?: string;
  message?: string;
}) {
  return (
    <>
      <div role="status" aria-live="polite">
        {busy ? 'Working...' : message}
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
    </>
  );
}
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function Json({ value }: { value: unknown }) {
  return (
    <textarea
      className="json"
      aria-label="Record data"
      readOnly
      rows={10}
      value={JSON.stringify(value, null, 2)}
    />
  );
}
export function SafeLink({ url, children }: { url: string; children: ReactNode }) {
  try {
    const u = new URL(url);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
      return <span>Unusable source link</span>;
    return (
      <a href={u.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
        {children} <span className="sr-only">(opens a new tab)</span>
      </a>
    );
  } catch {
    return <span>Unusable source link</span>;
  }
}
export function Reason({ id = 'reason' }: { id?: string }) {
  return (
    <label htmlFor={id}>
      Decision reason <textarea id={id} name="reason" required maxLength={2000} rows={3} />
    </label>
  );
}
export function Check({
  id,
  children,
  checked,
  onChange,
}: {
  id: string;
  children: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
export function submitted(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const submitter = (event.nativeEvent as SubmitEvent).submitter;
  return new FormData(event.currentTarget, submitter);
}
export function field(data: FormData, name: string) {
  return String(data.get(name) ?? '').trim();
}
export function parseJson(text: string): unknown {
  if (text.length > 1500000) throw new Error('INPUT_LIMIT');
  return JSON.parse(text);
}
export function dateLabel(value: unknown) {
  if (typeof value !== 'string') return 'Not recorded';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? `${new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Dhaka',
      }).format(date)} (Dhaka)`
    : value;
}
