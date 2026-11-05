import Link from 'next/link';
import { apiFieldNames, type CandidateValue, type ExtractedFact } from '@uttirno/contracts';
import { settings, safeLink } from '../../../lib/settings';
import { locale, text, unknown, factText, labels, dateText } from '../../../features/presentation';
import { Message, SourceLink } from '../../../features/common';
import { ApiClientError, type PublicApiClient } from '@uttirno/api-client';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Official job details | Uttirno',
  robots: { index: false, follow: false },
};
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params,
    lang = locale((await searchParams).lang),
    t = (bn: string, en: string) => text(lang, bn, en);
  let detail: Awaited<ReturnType<PublicApiClient['job']>> | undefined;
  let events: Awaited<ReturnType<PublicApiClient['events']>> | undefined;
  let missing = false;
  try {
    detail = await settings().client.job(id);
  } catch (error) {
    missing = error instanceof ApiClientError && error.status === 404;
  }
  try {
    events = await settings().client.events(id);
  } catch {
    /* Timeline availability is independent of facts. */
  }
  const apply = detail?.fields.applicationUrl.fact,
    href = apply?.status === 'stated' ? safeLink(apply.candidate.normalized) : null;
  return (
    <div lang={lang}>
      <nav aria-label={t('চাকরির নেভিগেশন', 'Job navigation')}>
        <Link href={`/jobs?lang=${lang}`}>{t('সব চাকরি', 'All jobs')}</Link> ·{' '}
        <Link href={`/jobs/${encodeURIComponent(id)}?lang=${lang === 'bn' ? 'en' : 'bn'}`}>
          {lang === 'bn' ? 'English' : 'বাংলা'}
        </Link>
      </nav>
      <h1>
        {detail ? factText(detail.fields.title.fact, lang) : t('চাকরির তথ্য', 'Job information')}
      </h1>
      {!detail ? (
        <Message
          title={
            missing
              ? t('তথ্য প্রকাশযোগ্য নয়', 'Job unavailable')
              : t('তথ্য পাওয়া যাচ্ছে না', 'Service unavailable')
          }
        >
          {t(
            'প্রকাশিত তথ্য নেই অথবা সাময়িকভাবে সরানো হয়েছে। এটি নিজে থেকে বাতিলের প্রমাণ নয়।',
            'Published facts are unavailable or have been withheld. This alone does not establish cancellation.',
          )}{' '}
          <Link href={`/jobs/${encodeURIComponent(id)}?lang=${lang}`}>
            {t('আবার চেষ্টা', 'Retry')}
          </Link>
        </Message>
      ) : (
        <>
          <p>
            {detail.job.authority.name} · {unknown(detail.job.status, lang)}
          </p>
          {settings()
            .preparation.filter((link) => detail.job.categories.includes(link.category))
            .map((link) => (
              <p key={link.url}>
                <a href={link.url}>
                  {t('সংশ্লিষ্ট প্রস্তুতি (ঐচ্ছিক)', 'Related preparation (optional)')}:{' '}
                  {link.label}
                </a>
              </p>
            ))}
          <div className="panel">
            <p>
              {t('সর্বশেষ যাচাই', 'Last verified')}: {dateText(detail.job.lastVerified, lang)}
            </p>
            <p>
              {t('সর্বশেষ পরীক্ষা', 'Last checked')}: {dateText(detail.job.lastChecked, lang)}
            </p>
            {detail.job.stale && (
              <p className="warning">
                {t(
                  'যাচাই পুরোনো; মূল বিজ্ঞপ্তি দেখুন।',
                  'Verification is stale; check the original notice.',
                )}
              </p>
            )}
            {href && detail.job.status === 'open' && !detail.job.stale ? (
              <SourceLink href={href}>
                {t('অফিশিয়াল সাইটে আবেদন', 'Apply on official site')}
              </SourceLink>
            ) : (
              <p>
                {t(
                  'আবেদনের বর্তমান অবস্থা নিশ্চিত করে মূল বিজ্ঞপ্তির নির্দেশনা অনুসরণ করুন।',
                  'Check the current application status and follow the original notice.',
                )}
              </p>
            )}
            <p>
              {t(
                'আবেদন ও পেমেন্ট সংশ্লিষ্ট কর্তৃপক্ষের সাইটে সম্পন্ন হয়।',
                'Applications and payments take place on the authority’s site.',
              )}
            </p>
          </div>
          <section aria-labelledby="facts">
            <h2 id="facts">{t('পদের বিবরণ', 'Position details')}</h2>
            {apiFieldNames.map((field) => {
              const fact: ExtractedFact = detail.fields[field].fact;
              const candidates: CandidateValue[] =
                fact.status === 'stated'
                  ? [fact.candidate]
                  : fact.status === 'conflicting'
                    ? fact.candidates
                    : [];
              return (
                <article className="panel" key={field}>
                  <h3>{labels[field][lang === 'bn' ? 0 : 1]}</h3>
                  <p className="value">{factText(fact, lang)}</p>
                  {fact.status === 'not_applicable' && <p>{fact.reason}</p>}
                  {candidates.map((c) => (
                    <details
                      key={`${c.evidence.textVersion}:${c.evidence.page}:${c.evidence.start}:${c.normalized}`}
                    >
                      <summary>
                        {t('উৎসের প্রমাণ', 'Source evidence')} · {t('পৃষ্ঠা', 'Page')}{' '}
                        {c.evidence.page}
                      </summary>
                      {fact.status === 'conflicting' && <p>{c.raw}</p>}
                      <blockquote>{c.evidence.quote}</blockquote>
                      <p>
                        {t('স্বাভাবিকীকৃত মান', 'Normalized value')}: {c.normalized}
                      </p>
                      <p>
                        {t('অবস্থান', 'Scope')}: {c.evidence.scopeId} · {c.evidence.start}–
                        {c.evidence.end}
                      </p>
                      <p className="hash">
                        SHA-256: {c.evidence.artifactSha256}
                        <br />
                        Text version: {c.evidence.textVersion}
                      </p>
                      {detail.fields[field].documents
                        .filter(
                          (d: { sha256: string; url: string }) =>
                            d.sha256 === c.evidence.artifactSha256,
                        )
                        .map((d: { sha256: string; url: string }) => (
                          <p key={d.sha256}>
                            <SourceLink href={d.url}>{t('মূল উৎস', 'Original source')}</SourceLink>
                          </p>
                        ))}
                    </details>
                  ))}
                </article>
              );
            })}
          </section>
          <section className="panel" aria-labelledby="originals">
            <h2 id="originals">{t('মূল বিজ্ঞপ্তি', 'Original notices')}</h2>
            {detail.documents.map((d) => (
              <div key={d.sha256}>
                <SourceLink href={d.url}>
                  {t('মূল বিজ্ঞপ্তি খুলুন', 'Open original notice')}
                </SourceLink>
                <p>{dateText(d.capturedAt, lang)}</p>
                <p className="hash">SHA-256: {d.sha256}</p>
              </div>
            ))}
            {!detail.documents.length && (
              <p>
                {t('প্রদর্শনযোগ্য document link নেই।', 'No permitted document link available.')}
              </p>
            )}
          </section>
        </>
      )}
      <section className="panel" aria-labelledby="events">
        <h2 id="events">{t('পরিবর্তনের ইতিহাস', 'Event history')}</h2>
        {events ? (
          <>
            <p>{unknown(events.status, lang)}</p>
            {events.events.length === 0 && (
              <p>{t('প্রকাশিত পরিবর্তন নেই।', 'No published events.')}</p>
            )}
            {events.events.map((e) => (
              <article key={e.id}>
                <h3>{e.kind}</h3>
                <p>
                  {dateText(e.recordedAt, lang)} · {t('পৃষ্ঠা', 'Page')} {e.page}
                </p>
                <blockquote>{e.quote}</blockquote>
                <SourceLink href={e.source.url}>{t('পরিবর্তনের উৎস', 'Event source')}</SourceLink>
              </article>
            ))}
          </>
        ) : (
          <p>{t('ইতিহাস এখন পাওয়া যাচ্ছে না।', 'History is currently unavailable.')}</p>
        )}
      </section>
    </div>
  );
}
