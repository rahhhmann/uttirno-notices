import { createHash } from 'node:crypto';
import {
  DocumentTextSchema,
  ExtractionPlanSchema,
  PositionExtractionSchema,
  fieldNames,
  type CandidateValue,
  type DocumentText,
  type ExtractionPlan,
  type PositionExtraction,
} from '@uttirno/contracts';

export function digits(value: string): string {
  return value.replace(/[০-৯]/g, (c) => String('০১২৩৪৫৬৭৮৯'.indexOf(c)));
}
export function normalize(raw: string, derivation: CandidateValue['derivation']): string {
  const value = digits(raw.trim());
  switch (derivation) {
    case 'identity-v1':
      return raw.trim();
    case 'digits-v1':
      return value;
    case 'integer-v1': {
      if (!/^\d{1,7}$/.test(value)) throw new Error('AMBIGUOUS_INTEGER');
      return String(Number(value));
    }
    case 'date-v1': {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2})( BDT)?)?$/.exec(value);
      if (!m) throw new Error('AMBIGUOUS_DATE');
      const [, d, mo, y, h, mi, zone] = m;
      const date = `${y}-${mo}-${d}`;
      if (
        new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
        Number(h ?? 0) > 23 ||
        Number(mi ?? 0) > 59
      )
        throw new Error('INVALID_DATE');
      return JSON.stringify({
        calendar: 'gregorian',
        date,
        precision: h ? 'minute' : 'date',
        time: h ? `${h}:${mi}` : null,
        timezone: zone ? 'Asia/Dhaka' : null,
      });
    }
    case 'money-v1': {
      const m = /^(?:BDT|টাকা) (\d{1,7}(?:\.\d{1,2})?)(?: \[([^\]\n]{1,100})\])?$/.exec(value);
      if (!m) throw new Error('AMBIGUOUS_MONEY');
      return JSON.stringify({ currency: 'BDT', amount: m[1], category: m[2] ?? null });
    }
    case 'age-v1': {
      const m = /^(\d{1,3})-(\d{1,3}) as of (\d{2}\/\d{2}\/\d{4})(?: \[([^\]\n]{1,100})\])?$/.exec(
        value,
      );
      if (!m?.[3] || Number(m[1]) > Number(m[2])) throw new Error('AMBIGUOUS_AGE');
      return JSON.stringify({
        minimum: Number(m[1]),
        maximum: Number(m[2]),
        referenceDate: JSON.parse(normalize(m[3], 'date-v1')).date,
        category: m[4] ?? null,
      });
    }
    case 'url-v1': {
      const u = new URL(raw);
      if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.hash)
        throw new Error('INVALID_APPLICATION_URL');
      return u.href;
    }
  }
}

export function verifyDocument(document: DocumentText): DocumentText {
  const parsed = DocumentTextSchema.parse(document);
  const { textVersion, ...body } = parsed;
  if (createHash('sha256').update(JSON.stringify(body)).digest('hex') !== textVersion)
    throw new Error('TEXT_HASH_MISMATCH');
  for (const [i,page] of parsed.pages.entries()) {
    if(page.page!==i+1)throw new Error('INVALID_PAGE_ORDER');
    for(const word of page.words){const [x,y,w,h]=word.box;
      if(word.start>=word.end||word.end>page.text.length||x<0||y<0||w<0||h<0||x+w>page.width+1||y+h>page.height+1)
        throw new Error('INVALID_WORD_PROVENANCE');
    }
  }
  return parsed;
}
export function validatePlan(document: DocumentText, plan: ExtractionPlan): void {
  verifyDocument(document);
  ExtractionPlanSchema.parse(plan);
  const occupied = new Map<number, Array<{ start: number; end: number }>>();
  const ids = new Set<string>();
  for (const position of plan.positions) {
    if (ids.has(position.id)) throw new Error('DUPLICATE_POSITION');
    ids.add(position.id);
    for (const range of position.ranges) {
      const page = document.pages.find((p) => p.page === range.page);
      if (!page || range.start >= range.end || range.end > page.text.length)
        throw new Error('INVALID_SCOPE_RANGE');
      if (
        (range.start > 0 && page.text[range.start - 1] !== '\n') ||
        (range.end < page.text.length && page.text[range.end] !== '\n')
      )
        throw new Error('SCOPE_MUST_BOUND_COMPLETE_LINES');
      const existing = occupied.get(range.page) ?? [];
      if (existing.some((r) => range.start < r.end && range.end > r.start))
        throw new Error('OVERLAPPING_POSITION_SCOPES');
      existing.push(range);
      occupied.set(range.page, existing);
    }
  }
  const labels = new Set<string>();
  for (const rule of plan.rules) {
    const required = rule.field.includes('Deadline')
      ? 'date-v1'
      : ['fee', 'serviceCharge'].includes(rule.field)
        ? 'money-v1'
        : rule.field === 'vacancies'
          ? 'integer-v1'
          : rule.field === 'age'
            ? 'age-v1'
            : rule.field === 'applicationUrl'
              ? 'url-v1'
              : 'identity-v1';
    if (rule.derivation !== required) throw new Error('FIELD_DERIVATION_MISMATCH');
    if (labels.has(rule.label) || rule.label.includes('\n') || rule.label.trim() !== rule.label)
      throw new Error('AMBIGUOUS_RULE_LABEL');
    labels.add(rule.label);
  }
}

// Literal whole-line labels only: selectors/field meanings are reviewed versioned configuration.
export function extractPositions(
  document: DocumentText,
  plan: ExtractionPlan,
): PositionExtraction[] {
  validatePlan(document, plan);
  return plan.positions.map((scope) => {
    const fields: PositionExtraction['fields'] = Object.fromEntries(
      fieldNames.map((name) => [name, { status: 'not_extracted' as const }]),
    ) as PositionExtraction['fields'];
    for (const field of fieldNames) {
      const rules = plan.rules.filter((r) => r.field === field);
      if (!rules.length) continue;
      const candidates: CandidateValue[] = [];
      let unreadable = false;
      for (const range of scope.ranges) {
        const page = document.pages.find((p) => p.page === range.page);
        if (!page) throw new Error('INVALID_SCOPE_PAGE');
        let offset = range.start;
        for (const line of page.text.slice(range.start, range.end).split('\n')) {
          for (const rule of rules) {
            const prefix = `${rule.label}: `;
            if (!line.startsWith(prefix)) continue;
            const raw = line.slice(prefix.length).trim();
            try {
              if (!raw) throw new Error('EMPTY_VALUE');
              candidates.push({
                raw,
                normalized: normalize(raw, rule.derivation),
                derivation: rule.derivation,
                evidence: {
                  sourceId: document.sourceId,
                  artifactSha256: document.artifactSha256,
                  textVersion: document.textVersion,
                  scopeId: scope.id,
                  page: page.page,
                  start: offset,
                  end: offset + line.length,
                  quote: line,
                },
              });
            } catch {
              unreadable = true;
            }
          }
          offset += line.length + 1;
        }
      }
      fields[field] = unreadable
        ? { status: 'not_extracted' }
        : candidates.length > 1
          ? { status: 'conflicting', candidates }
          : candidates[0]
            ? { status: 'stated', candidate: candidates[0] }
            : {
                status: rules.every((r) => r.absence === 'not_stated')
                  ? 'not_stated'
                  : 'not_extracted',
              };
    }
    return PositionExtractionSchema.parse({ schemaVersion: 1, positionId: scope.id, fields });
  });
}

export type CoverageReview = {
  expectedArtifacts: string[];
  inspectedArtifacts: string[];
  expectedPositions: string[];
  // Human review is bound to the exact immutable text and plan. M4 supplies persisted actor/audit.
  scopeReview: {
    textVersion: string;
    plan: ExtractionPlan;
    reviewedBy: string;
    acceptedQualityPages: number[];
  } | null;
};
export function verifyExtraction(
  document: DocumentText,
  plan: ExtractionPlan,
  inputs: unknown[],
  coverage: CoverageReview,
  destinationAllowed: (url: string) => boolean = () => false,
) {
  validatePlan(document, plan);
  const expected = extractPositions(document, plan);
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    const parsed = PositionExtractionSchema.safeParse(input);
    if (!parsed.success) {
      errors.push('INVALID_EXTRACTION_SCHEMA');
      continue;
    }
    const position = parsed.data;
    const baseline = expected.find((p) => p.positionId === position.positionId);
    if (!baseline || seen.has(position.positionId)) {
      errors.push('POSITION_SCOPE_MISMATCH');
      continue;
    }
    seen.add(position.positionId);
    for (const field of fieldNames) {
      const fact = position.fields[field];
      const truth = baseline.fields[field];
      // Deterministic reproduction checks both meaning (field label) and scope, not just quote existence.
      if (JSON.stringify(fact) !== JSON.stringify(truth))
        errors.push(`${position.positionId}:${field}:UNSUPPORTED`);
      if (fact.status === 'conflicting' || fact.status === 'not_extracted')
        errors.push(`${position.positionId}:${field}:${fact.status}`);
      if (
        ['title', 'applicationDeadline', 'applicationUrl'].includes(field) &&
        fact.status !== 'stated'
      )
        errors.push(`${position.positionId}:${field}:CRITICAL_UNKNOWN`);
      if (
        fact.status === 'stated' &&
        field === 'applicationUrl' &&
        !destinationAllowed(fact.candidate.normalized)
      )
        errors.push('UNAPPROVED_APPLICATION_DESTINATION');
      if (fact.status === 'stated' && ['applicationDeadline', 'paymentDeadline'].includes(field)) {
        try {
          const date = JSON.parse(fact.candidate.normalized);
          if (date.precision === 'minute' && !date.timezone)
            errors.push('DEADLINE_TIMEZONE_UNKNOWN');
        } catch {
          errors.push('INVALID_DATE_NORMALIZATION');
        }
      }
    }
    const submit = position.fields.applicationDeadline;
    const payment = position.fields.paymentDeadline;
    if (submit.status === 'stated' && payment.status === 'stated') {
      try {
        const a = JSON.parse(submit.candidate.normalized);
        const b = JSON.parse(payment.candidate.normalized);
        if (
          b.date < a.date ||
          (b.date === a.date &&
            a.timezone &&
            a.timezone === b.timezone &&
            a.time &&
            b.time &&
            b.time < a.time)
        )
          errors.push('PAYMENT_PRECEDES_APPLICATION_DEADLINE');
      } catch {
        errors.push('INVALID_DATE_NORMALIZATION');
      }
    }
  }
  const equalSets = (a: string[], b: string[]) =>
    a.length === new Set(a).size &&
    b.length === new Set(b).size &&
    a.length === b.length &&
    a.every((v) => b.includes(v));
  if (
    !equalSets(
      [...seen],
      plan.positions.map((p) => p.id),
    ) ||
    !equalSets([...seen], coverage.expectedPositions)
  )
    errors.push('INCOMPLETE_POSITION_COVERAGE');
  if (
    !coverage.expectedArtifacts.length ||
    !coverage.expectedArtifacts.includes(document.artifactSha256) ||
    !equalSets(coverage.expectedArtifacts, coverage.inspectedArtifacts)
  )
    errors.push('INCOMPLETE_ATTACHMENT_COVERAGE');
  const review = coverage.scopeReview;
  if (
    !review?.reviewedBy.trim() ||
    review.textVersion !== document.textVersion ||
    JSON.stringify(review.plan) !== JSON.stringify(plan)
  )
    errors.push('SCOPE_REVIEW_REQUIRED');
  if (document.pages.some((p) => p.flags.length && !review?.acceptedQualityPages.includes(p.page)))
    errors.push('DOCUMENT_QUALITY_REVIEW_REQUIRED');
  return {
    eligibleForReview: errors.length === 0,
    publicationApproved: false as const,
    errors: [...new Set(errors)],
  };
}
