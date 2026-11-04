import type { PoolClient } from 'pg';
import {
  JobDetailSchema,
  JobSummarySchema,
  PublicEventSchema,
  PositionExtractionSchema,
  JobsQuerySchema,
  TaxonomySchema,
  type JobsQuery,
  type Taxonomy,
  type ExtractedFact,
  apiFieldNames,
} from '@uttirno/contracts';
import { assertSourceUrl, SourcePolicyError, type SourceConfig } from '@uttirno/source-config';
import { transaction, gate, type DatabaseOptions } from './shared.js';
const normalize = (v: string) => v.normalize('NFC').toLocaleLowerCase('en');
export function queryTerms(q: string | undefined, taxonomy: Taxonomy) {
  if (!q) return [];
  const term = normalize(q.trim());
  const aliases = taxonomy.aliases.find((a) => a.terms.some((v) => normalize(v) === term));
  return [...new Set([term, ...(aliases?.terms.map(normalize) ?? [])])];
}
function summary(fact: ExtractedFact) {
  return fact.status === 'stated'
    ? { status: fact.status, raw: fact.candidate.raw, normalized: fact.candidate.normalized }
    : { status: fact.status };
}
const projected = `SELECT v.position_id,v.revision_id,v.circular_revision_id,v.source_id,v.value,v.published_at,s.last_checked,
  a.id AS authority_id,a.name AS authority_name,r.created_at AS verified_at,p.recruitment_state
  FROM public_positions v JOIN positions p ON p.id=v.position_id JOIN circulars c ON c.id=p.circular_id
  JOIN authorities a ON a.id=c.authority_id JOIN sources s ON s.id=v.source_id
  JOIN published_positions pp ON pp.position_id=v.position_id JOIN review_actions r ON r.id=pp.review_action_id`;
type ProjectedRow = {
  position_id: string;
  revision_id: string;
  circular_revision_id: string;
  source_id: string;
  value: unknown;
  published_at: Date;
  last_checked: Date | null;
  authority_id: string;
  authority_name: string;
  verified_at: Date;
  recruitment_state: string;
};
export class PublicReadRepository {
  private readonly taxonomy: Taxonomy;
  constructor(
    private readonly options: DatabaseOptions,
    taxonomy: Taxonomy,
    private readonly freshnessSeconds = 86400,
  ) {
    this.taxonomy = TaxonomySchema.parse(taxonomy);
  }
  private async visible(c: PoolClient, row: ProjectedRow) {
    let config: SourceConfig;
    try {
      config = (await gate(c, this.options, row.source_id, 'display')).config;
    } catch (error) {
      if (
        error instanceof SourcePolicyError ||
        (error instanceof Error &&
          ['SOURCE_HALTED', 'FULL_DISPLAY_NOT_PERMITTED', 'SOURCE_NOT_REGISTERED'].includes(
            error.message,
          ))
      )
        return null;
      throw error;
    }
    const value = PositionExtractionSchema.parse(row.value);
    try {
      if (value.fields.applicationUrl.status !== 'stated') return null;
      assertSourceUrl(config, value.fields.applicationUrl.candidate.normalized);
    } catch {
      return null;
    }
    const refs = await c.query(
      `SELECT DISTINCT ON(t.text_version) t.text_version,a.sha256,a.url,a.captured_at
      FROM circular_revisions r CROSS JOIN LATERAL(
        SELECT entry->>'textVersion' AS version FROM jsonb_array_elements(r.bundle->'entries') entry
        UNION SELECT jsonb_array_elements_text(r.bundle->'supportingDocuments')) needed
      JOIN artifact_text_versions t ON t.text_version=needed.version
      JOIN artifact_captures a ON a.sha256=t.document->>'artifactSha256' AND a.source_id=t.document->>'sourceId'
        AND a.fingerprint=t.document->>'configFingerprint'
      WHERE r.id=$1 AND a.expires_at>clock_timestamp() ORDER BY t.text_version,a.captured_at DESC`,
      [row.circular_revision_id],
    );
    const documents = [];
    for (const ref of refs.rows) {
      try {
        assertSourceUrl(config, ref.url);
      } catch {
        return null;
      }
      documents.push({
        textVersion: ref.text_version,
        sha256: ref.sha256 as string,
        url: ref.url as string,
        capturedAt: (ref.captured_at as Date).toISOString(),
      });
    }
    for (const fact of Object.values(value.fields))
      if (
        fact.status === 'stated' &&
        !documents.some(
          (d) =>
            d.textVersion === fact.candidate.evidence.textVersion &&
            d.sha256 === fact.candidate.evidence.artifactSha256,
        )
      )
        return null;
    const title =
      value.fields.title.status === 'stated' ? normalize(value.fields.title.candidate.raw) : '';
    const categories = this.taxonomy.categories
      .filter((item) => item.titleIncludes.some((term) => title.includes(normalize(term))))
      .map((item) => item.id);
    let status = row.recruitment_state as string;
    const deadline = value.fields.applicationDeadline;
    if (status !== 'cancelled' && deadline.status === 'stated') {
      try {
        const d = JSON.parse(deadline.candidate.normalized);
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Dhaka',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(now);
        const part = (type: string) => parts.find((p) => p.type === type)?.value;
        const today = `${part('year')}-${part('month')}-${part('day')}`;
        if (d.precision === 'date' && d.date < today) status = 'closed';
        if (
          d.precision === 'minute' &&
          d.timezone === 'Asia/Dhaka' &&
          Date.parse(`${d.date}T${d.time}:00+06:00`) < now.getTime()
        )
          status = 'closed';
      } catch {
        /* Invalid derivations never become invented timestamps. */
      }
    }
    const lastChecked = row.last_checked instanceof Date ? row.last_checked.toISOString() : null;
    const job = JobSummarySchema.parse({
      id: row.position_id,
      revisionId: row.revision_id,
      authority: { id: row.authority_id, name: row.authority_name },
      title: summary(value.fields.title),
      deadline: summary(deadline),
      location: summary(value.fields.district),
      status,
      categories,
      classification: 'derived_taxonomy',
      taxonomyVersion: this.taxonomy.version,
      publishedAt: row.published_at.toISOString(),
      lastChecked,
      lastVerified: row.verified_at.toISOString(),
      stale: !lastChecked || Date.now() - Date.parse(lastChecked) > this.freshnessSeconds * 1000,
    });
    return { job, value, documents };
  }
  async jobs(raw: JobsQuery, after?: string, asOf?: string) {
    const query = JobsQuerySchema.parse(raw),
      terms = queryTerms(query.q, this.taxonomy);
    return transaction(this.options.pool, async (c) => {
      const snapshot =
        asOf ??
        (
          await c.query<{ now: Date }>('SELECT clock_timestamp() AS now')
        ).rows[0]?.now.toISOString();
      if (!snapshot) throw new Error('READ_SNAPSHOT_UNAVAILABLE');
      let last = after ?? null;
      const items = [];
      let more = false;
      for (let round = 0; round < 20 && items.length < query.limit; round++) {
        const conditions = [
          '($1::uuid IS NULL OR v.position_id>$1::uuid)',
          'v.published_at<=$2::timestamptz',
        ];
        const params: unknown[] = [last, snapshot];
        const add = (value: unknown, expression: (n: number) => string) => {
          params.push(value);
          conditions.push(expression(params.length));
        };
        if (query.authority) add(query.authority, (n) => `a.id=$${n}`);
        if (terms.length)
          add(
            terms,
            (n) =>
              `EXISTS(SELECT 1 FROM unnest($${n}::text[]) term WHERE strpos(lower(normalize(COALESCE(v.value#>>'{fields,title,candidate,raw}','')||' '||COALESCE(v.value#>>'{fields,qualifications,candidate,raw}','')||' '||COALESCE(v.value#>>'{fields,experience,candidate,raw}',''),NFC)),term)>0)`,
          );
        for (const [key, field] of [
          ['location', 'district'],
          ['education', 'qualifications'],
          ['skill', 'experience'],
        ] as const) {
          const term = query[key];
          if (term)
            add(
              normalize(term),
              (n) =>
                `strpos(lower(normalize(COALESCE(v.value#>>'{fields,${field},candidate,raw}','')${key === 'skill' ? "||' '||COALESCE(v.value#>>'{fields,qualifications,candidate,raw}','')" : ''},NFC)),$${n})>0`,
            );
        }
        const rows = (
          await c.query(
            `${projected} WHERE ${conditions.join(' AND ')} ORDER BY v.position_id LIMIT 51`,
            params,
          )
        ).rows;
        const batch = rows.slice(0, 50);
        more = rows.length > 50;
        for (const [index, row] of batch.entries()) {
          last = row.position_id;
          const result = await this.visible(c, row);
          if (!result) continue;
          if (query.category && !result.job.categories.includes(query.category)) continue;
          if (query.status && result.job.status !== query.status) continue;
          let date: string | null = null;
          const deadline = result.value.fields.applicationDeadline;
          if (deadline.status === 'stated') {
            try {
              date = JSON.parse(deadline.candidate.normalized).date;
            } catch {
              /* schema/derivation already checked at publication */
            }
          }
          if (
            (query.deadlineFrom && (!date || date < query.deadlineFrom)) ||
            (query.deadlineTo && (!date || date > query.deadlineTo))
          )
            continue;
          items.push(result.job);
          if (items.length === query.limit) {
            more = more || index < batch.length - 1;
            break;
          }
        }
        if (batch.length < 50) break;
        if (round === 19) more = true;
      }
      return { items, after: more ? last : null, asOf: snapshot };
    });
  }
  async job(id: string) {
    return transaction(this.options.pool, async (c) => {
      const row = (await c.query(`${projected} WHERE v.position_id=$1`, [id])).rows[0];
      if (!row) return null;
      const item = await this.visible(c, row);
      if (!item) return null;
      const docs = item.documents.map(({ textVersion: _unused, ...doc }) => doc);
      const fields = Object.fromEntries(
        apiFieldNames.map((name) => {
          const fact = item.value.fields[name];
          const evidence =
            fact.status === 'stated'
              ? [fact.candidate.evidence]
              : fact.status === 'conflicting'
                ? fact.candidates.map((v) => v.evidence)
                : [];
          return [
            name,
            {
              fact,
              documents: evidence.flatMap((e) =>
                item.documents
                  .filter((d) => d.textVersion === e.textVersion)
                  .map(({ textVersion: _v, ...doc }) => doc),
              ),
            },
          ];
        }),
      );
      return JobDetailSchema.parse({ job: item.job, fields, documents: docs });
    });
  }
  async authorities() {
    return transaction(this.options.pool, async (c) => {
      const rows = (
        await c.query(
          'SELECT DISTINCT v.source_id,a.id,a.name FROM public_positions v JOIN sources s ON s.id=v.source_id JOIN authorities a ON a.id=s.authority_id ORDER BY a.id',
        )
      ).rows;
      const items = new Map<string, { id: string; name: string }>();
      for (const row of rows) {
        try {
          await gate(c, this.options, row.source_id, 'display');
          items.set(row.id, { id: row.id, name: row.name });
        } catch (error) {
          if (
            !(error instanceof SourcePolicyError) &&
            !(
              error instanceof Error &&
              ['SOURCE_HALTED', 'FULL_DISPLAY_NOT_PERMITTED', 'SOURCE_NOT_REGISTERED'].includes(
                error.message,
              )
            )
          )
            throw error;
        }
      }
      return { items: [...items.values()] };
    });
  }
  async events(id: string) {
    return transaction(this.options.pool, async (c) => {
      const anchor = (
        await c.query(
          `SELECT r.source_id,p.recruitment_state FROM published_positions pp JOIN positions p ON p.id=pp.position_id
        JOIN circular_revisions r ON r.id=pp.circular_revision_id WHERE pp.position_id=$1`,
          [id],
        )
      ).rows[0];
      if (!anchor) return null;
      let config: SourceConfig;
      try {
        config = (await gate(c, this.options, anchor.source_id, 'display')).config;
      } catch (error) {
        if (
          error instanceof SourcePolicyError ||
          (error instanceof Error &&
            ['SOURCE_HALTED', 'FULL_DISPLAY_NOT_PERMITTED', 'SOURCE_NOT_REGISTERED'].includes(
              error.message,
            ))
        )
          return null;
        throw error;
      }
      const rows = (
        await c.query(
          `SELECT e.*,a.sha256,a.url,a.captured_at FROM recruitment_events e
        JOIN artifact_text_versions t ON t.text_version=e.text_version JOIN LATERAL(SELECT x.* FROM artifact_captures x
          WHERE x.sha256=t.document->>'artifactSha256' AND x.source_id=t.document->>'sourceId' AND x.fingerprint=t.document->>'configFingerprint'
          AND x.expires_at>clock_timestamp() ORDER BY captured_at DESC LIMIT 1)a ON true
        WHERE $1=ANY(e.targets) AND e.state='approved' ORDER BY e.created_at,e.id LIMIT 200`,
          [id],
        )
      ).rows;
      const events = [];
      for (const row of rows) {
        try {
          assertSourceUrl(config, row.url);
        } catch {
          continue;
        }
        events.push(
          PublicEventSchema.parse({
            id: row.id,
            kind: row.kind,
            recordedAt: row.created_at.toISOString(),
            source: { sha256: row.sha256, url: row.url, capturedAt: row.captured_at.toISOString() },
            page: row.evidence.page,
            quote: row.evidence.quote,
          }),
        );
      }
      const visibleJob = await this.job(id);
      const cancelled = events.some((event) => event.kind === 'cancellation');
      if (!visibleJob && !cancelled) return null;
      if (anchor.recruitment_state === 'cancelled' && !cancelled) return null;
      return {
        positionId: id,
        status: cancelled ? 'cancelled' : (visibleJob?.job.status ?? 'unknown'),
        events,
      };
    });
  }
}
