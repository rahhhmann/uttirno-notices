'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section role="alert">
      <h1>পাতা লোড হয়নি / Page unavailable</h1>
      <button type="button" onClick={reset}>
        আবার চেষ্টা / Retry
      </button>
    </section>
  );
}
