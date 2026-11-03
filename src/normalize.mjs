import { createHash } from 'node:crypto';

export const hash = value => createHash('sha256').update(value).digest('hex');
export function allowed(url, hosts) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && hosts.includes(u.hostname);
  } catch { return false; }
}
export function normalize(snapshot, source) {
  if (!allowed(snapshot.url, source.hosts)) throw new Error('Unapproved snapshot URL');
  const common = {
    source_id: source.id, source_url: snapshot.url, captured_at: snapshot.captured_at,
    content_sha256: hash(snapshot.text), raw_text: snapshot.text,
    publication_status: 'needs_review',
    description: null, requirements: null, application_process: null,
    application_fee: null, salary: null, age_rules: null, education: null,
    missing_fields: ['description', 'requirements', 'application_process', 'application_fee', 'salary', 'age_rules', 'education'],
  };
  if (source.adapter === 'circular-links') {
    return snapshot.links.filter(a => allowed(a.url, source.hosts) && /\.pdf(?:$|\?)/i.test(a.url)).map(a => ({
      ...common, id: hash(source.id + ':' + a.url), kind: 'circular',
      title: a.text || null, document_url: a.url, application_start: null, application_end: null,
      missing_fields: [...common.missing_fields, 'application_start', 'application_end', 'positions'],
    }));
  }
  if (source.adapter !== 'teletalk-government') throw new Error('Unknown adapter');
  const jobId = new URL(snapshot.url).searchParams.get('jobId');
  if (!jobId) throw new Error('Missing jobId: list pages cannot become job records');
  // Job cards precede the selected job's details: read the selected section only.
  const status = snapshot.text.indexOf('Status:');
  if (status < 0) throw new Error('Detail pattern changed: missing Status');
  const heading = snapshot.text.slice(0, status).trim().split(/\n+/).slice(-2);
  const detail = snapshot.text.slice(status);
  const value = label => detail.match(new RegExp(label + '\\s*\\n([^\\n]+)'))?.[1]?.trim() ?? null;
  const applications = snapshot.links.filter(a => /^(Apply now|Apply Online)$/i.test(a.text.trim()));
  return [{ ...common, id: hash(source.id + ':' + jobId), kind: 'position', source_job_id: jobId,
    title: heading[0] ?? null, organization: heading[1] ?? null,
    advertisement_number: detail.match(/ADV NO:\s*([^\n]+)/)?.[1]?.trim() ?? null,
    application_start: { raw: value('Application Start Date'), timezone: 'Asia/Dhaka', verified: false },
    application_end: { raw: value('Application End Date'), timezone: 'Asia/Dhaka', verified: false },
    application_links: [...new Set(applications.map(a => a.url))].map(url => ({url, verified: false})),
    missing_fields: [...common.missing_fields, 'vacancies', 'original_circular', 'verified_application_link'],
  }];
}
