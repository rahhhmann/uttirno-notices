import Link from 'next/link';
import { JobsQuerySchema } from '@uttirno/contracts';
import { settings } from '../../lib/settings';
import { locale, text, unknown, dateText } from '../../features/presentation';
import { Message } from '../../features/common';
import type { PublicApiClient } from '@uttirno/api-client';
export const dynamic = 'force-dynamic';
export default async function Jobs({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams,
    lang = locale(params.lang);
  const allowed = [
    'q',
    'authority',
    'category',
    'location',
    'education',
    'skill',
    'status',
    'deadlineFrom',
    'deadlineTo',
    'cursor',
  ];
  const input = Object.fromEntries(
    allowed.flatMap((key) =>
      typeof params[key] === 'string' && params[key] ? [[key, params[key]]] : [],
    ),
  );
  const parsed = JobsQuerySchema.safeParse(input),
    t = (bn: string, en: string) => text(lang, bn, en);
  let result: Awaited<ReturnType<PublicApiClient['jobs']>> | undefined;
  let authorities: Awaited<ReturnType<PublicApiClient['authorities']>> | undefined;
  try {
    if (parsed.success)
      [result, authorities] = await Promise.all([
        settings().client.jobs(parsed.data),
        settings().client.authorities(),
      ]);
  } catch {
    /* Sanitized unavailable state. */
  }
  const query = new URLSearchParams({ ...input, lang });
  query.set('lang', lang === 'bn' ? 'en' : 'bn');
  query.delete('cursor');
  return (
    <div lang={lang}>
      <Link href={`/jobs?${query}`}>{lang === 'bn' ? 'English' : 'বাংলা'}</Link>
      <h1>{t('চাকরি খুঁজুন', 'Find official jobs')}</h1>
      <p>
        {t(
          'পর্যালোচিত তথ্য দেখুন; আবেদনের আগে মূল বিজ্ঞপ্তি পড়ুন।',
          'Browse reviewed information; read the original notice before applying.',
        )}
      </p>
      <form action="/jobs" className="panel filters">
        <input type="hidden" name="lang" value={lang} />
        <label>
          {t('অনুসন্ধান', 'Search')}
          <input name="q" maxLength={150} defaultValue={input.q} />
        </label>
        <label>
          {t('নিয়োগকারী', 'Authority')}
          <select name="authority" defaultValue={input.authority ?? ''}>
            <option value="">{t('সব', 'All')}</option>
            {authorities?.items.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('অবস্থা', 'Status')}
          <select name="status" defaultValue={input.status ?? ''}>
            <option value="">{t('সব', 'All')}</option>
            {['unknown', 'upcoming', 'open', 'closed', 'cancelled'].map((s) => (
              <option key={s} value={s}>
                {unknown(s, lang)}
              </option>
            ))}
          </select>
        </label>
        {(['location', 'education', 'skill', 'category'] as const).map((key, i) => (
          <label key={key}>
            {
              [
                t('স্থান', 'Location'),
                t('শিক্ষা', 'Education'),
                t('দক্ষতা', 'Skill'),
                t('শ্রেণি ID (নির্ধারিত taxonomy)', 'Category ID (derived taxonomy)'),
              ][i]
            }
            <input name={key} maxLength={100} defaultValue={input[key]} />
          </label>
        ))}
        <label>
          {t('শেষ তারিখ থেকে', 'Deadline from')}
          <input type="date" name="deadlineFrom" defaultValue={input.deadlineFrom} />
        </label>
        <label>
          {t('শেষ তারিখ পর্যন্ত', 'Deadline to')}
          <input type="date" name="deadlineTo" defaultValue={input.deadlineTo} />
        </label>
        <button type="submit">{t('খুঁজুন', 'Search jobs')}</button>
        <Link href={`/jobs?lang=${lang}`}>{t('ফিল্টার মুছুন', 'Reset filters')}</Link>
      </form>
      {!parsed.success ? (
        <Message title={t('ফিল্টার সঠিক নয়', 'Invalid filters')}>
          {t('তারিখের ক্রম ও ইনপুট পরীক্ষা করুন।', 'Check the date range and filter values.')}
        </Message>
      ) : !result ? (
        <Message title={t('তথ্য পাওয়া যাচ্ছে না', 'Jobs unavailable')}>
          {t('কিছুক্ষণ পরে আবার চেষ্টা করুন।', 'Please retry shortly.')}{' '}
          <Link href={`/jobs?lang=${lang}`}>{t('আবার চেষ্টা', 'Retry')}</Link>
        </Message>
      ) : (
        <>
          <p>
            {t('এই পৃষ্ঠায় ফলাফল', 'Results on this page')}: {result.items.length}
          </p>
          {result.items.length === 0 && (
            <Message title={t('কোনো চাকরি পাওয়া যায়নি', 'No matching jobs')}>
              {t(
                'ফিল্টার পরিবর্তন করুন। নতুন তথ্য পর্যালোচনার পর প্রকাশিত হয়।',
                'Try different filters. New information appears after review.',
              )}
            </Message>
          )}
          <div className="jobs">
            {result.items.map((job) => (
              <article className="panel" key={job.id}>
                <p>{job.authority.name}</p>
                <h2>
                  <Link href={`/jobs/${job.id}?lang=${lang}`}>
                    {job.title.status === 'stated'
                      ? job.title.raw
                      : unknown(job.title.status, lang)}
                  </Link>
                </h2>
                <p>{unknown(job.status, lang)}</p>
                <p>
                  {t('শেষ সময়', 'Deadline')}:{' '}
                  {job.deadline.status === 'stated'
                    ? job.deadline.raw
                    : unknown(job.deadline.status, lang)}
                </p>
                <p>
                  {t('স্থান', 'Location')}:{' '}
                  {job.location.status === 'stated'
                    ? job.location.raw
                    : unknown(job.location.status, lang)}
                </p>
                <small>
                  {t('সর্বশেষ যাচাই', 'Last verified')}: {dateText(job.lastVerified, lang)}
                </small>
                {job.stale && (
                  <p className="warning">
                    {t(
                      'তথ্য পুরোনো হতে পারে; মূল বিজ্ঞপ্তি যাচাই করুন।',
                      'Verification is stale; check the official notice.',
                    )}
                  </p>
                )}
              </article>
            ))}
          </div>
          {result.nextCursor && (
            <Link
              className="button"
              href={`/jobs?${new URLSearchParams({ ...input, lang, cursor: result.nextCursor })}`}
            >
              {t('পরের পৃষ্ঠা', 'Next page')}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
