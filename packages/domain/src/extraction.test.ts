// biome-ignore-all lint/style/noNonNullAssertion: Synthetic fixture indexes are fixed by the test inventory.
import { expect, it } from 'vitest';
import { extractPositions, normalize, verifyExtraction } from './extraction.js';
import { extractionFixture, sealText } from '../../../tests/helpers/extraction.js';
it('R10/R11 preserves sibling qualifications, Bangla counts, fees/categories and distinct deadlines', () => {
  const { document, plan, coverage } = extractionFixture();
  const positions = extractPositions(document, plan);
  expect(positions[0]!.fields.qualifications).toMatchObject({
    status: 'stated',
    candidate: { raw: 'BSc CSE' },
  });
  expect(positions[1]!.fields.qualifications).toMatchObject({
    status: 'stated',
    candidate: { raw: 'MSc Statistics' },
  });
  expect(positions[0]!.fields.vacancies).toMatchObject({
    status: 'stated',
    candidate: { normalized: '12' },
  });
  const fee = positions[0]!.fields.fee;
  expect(fee.status === 'stated' && JSON.parse(fee.candidate.normalized)).toEqual({
    currency: 'BDT',
    amount: '100',
    category: 'general',
  });
  expect(verifyExtraction(document, plan, positions, coverage, () => true)).toEqual({
    eligibleForReview: true,
    publicationApproved: false,
    errors: [],
  });
});
it('R12 date-only never becomes midnight, explicit time/zone retained; malformed date/fee/age rejected', () => {
  expect(JSON.parse(normalize('১৫/১২/২০২৬', 'date-v1'))).toEqual({
    calendar: 'gregorian',
    date: '2026-12-15',
    precision: 'date',
    time: null,
    timezone: null,
  });
  expect(JSON.parse(normalize('১৬/১২/২০২৬ ১৭:০০ BDT', 'date-v1'))).toMatchObject({
    time: '17:00',
    timezone: 'Asia/Dhaka',
  });
  for (const raw of ['31/02/2026', '01/01/2026 24:00', '2026/01/01', '15 December 2026'])
    expect(() => normalize(raw, 'date-v1')).toThrow();
  expect(() => normalize('No fee for browsing', 'money-v1')).toThrow();
  expect(() => normalize('30-18 as of 01/11/2026', 'age-v1')).toThrow();
});
it('R12 preserves missing/unconfigured/conflicting fields and zero only when explicitly stated', () => {
  const { document, plan } = extractionFixture();
  plan.rules = plan.rules.filter((r) => r.field !== 'experience');
  plan.rules.push({
    field: 'title',
    label: 'Qualifications',
    derivation: 'identity-v1',
    absence: 'not_extracted',
  });
  // duplicate labels are ambiguous configuration, rejected rather than guessing intent.
  expect(() => extractPositions(document, plan)).toThrow('AMBIGUOUS_RULE_LABEL');
  plan.rules.pop();
  const positions = extractPositions(document, plan);
  expect(positions[0]!.fields.salary).toEqual({ status: 'not_stated' });
  expect(positions[0]!.fields.experience).toEqual({ status: 'not_extracted' });
  expect(normalize('০', 'integer-v1')).toBe('0');
});
it('R13 wrong sibling, fee quote with wrong meaning, fabricated normalization and offsets cannot pass', () => {
  const { document, plan, coverage } = extractionFixture();
  const original = extractPositions(document, plan);
  for (const mutate of [
    (p: typeof original) => {
      p[0]!.fields.qualifications = p[1]!.fields.qualifications;
    },
    (p: typeof original) => {
      p[0]!.fields.fee = p[0]!.fields.vacancies;
    },
    (p: typeof original) => {
      const f = p[0]!.fields.fee;
      if (f.status === 'stated') f.candidate.normalized = '0';
    },
    (p: typeof original) => {
      const f = p[0]!.fields.title;
      if (f.status === 'stated') f.candidate.evidence.start++;
    },
  ]) {
    const positions = structuredClone(original);
    mutate(positions);
    expect(
      verifyExtraction(document, plan, positions, coverage, () => true).eligibleForReview,
    ).toBe(false);
  }
});
it('R07/R13 attachment omissions, extra/partial positions, review mismatch and unknown destinations block', () => {
  const { document, plan, coverage } = extractionFixture();
  const positions = extractPositions(document, plan);
  expect(
    verifyExtraction(document, plan, positions.slice(0, 1), coverage, () => true).errors,
  ).toContain('INCOMPLETE_POSITION_COVERAGE');
  expect(
    verifyExtraction(
      document,
      plan,
      positions,
      { ...coverage, expectedArtifacts: ['a'.repeat(64), 'c'.repeat(64)] },
      () => true,
    ).errors,
  ).toContain('INCOMPLETE_ATTACHMENT_COVERAGE');
  expect(
    verifyExtraction(document, plan, positions, { ...coverage, scopeReview: null }, () => true)
      .errors,
  ).toContain('SCOPE_REVIEW_REQUIRED');
  expect(verifyExtraction(document, plan, positions, coverage).errors).toContain(
    'UNAPPROVED_APPLICATION_DESTINATION',
  );
});
it('R10 invalid/overlapping/partial-line scopes cannot manufacture matching evidence', () => {
  const { document, plan } = extractionFixture();
  plan.positions[1]!.ranges[0]!.start = 0;
  expect(() => extractPositions(document, plan)).toThrow('OVERLAPPING_POSITION_SCOPES');
  plan.positions.pop();
  plan.positions[0]!.ranges[0]!.start = 1;
  expect(() => extractPositions(document, plan)).toThrow('SCOPE_MUST_BOUND_COMPLETE_LINES');
});
it('R12/R13 conflicting same-position fees stay unresolved; out-of-scope footnote is not a fee rule', () => {
  const { document, plan, coverage } = extractionFixture();
  const page = document.pages[0]!;
  page.text += '\nFee: BDT 500 [general]';
  const sealed = sealText(document);
  plan.positions[1]!.ranges[0]!.end = page.text.length;
  const positions = extractPositions(sealed, plan);
  expect(positions[1]!.fields.fee.status).toBe('conflicting');
  expect(verifyExtraction(sealed, plan, positions, coverage, () => true).eligibleForReview).toBe(
    false,
  );
});
it('R13 text tampering and semantically wrong field derivations are rejected', () => {
  const { document, plan } = extractionFixture();
  document.pages[0]!.text += ' altered';
  expect(() => extractPositions(document, plan)).toThrow('TEXT_HASH_MISMATCH');
  const original = extractionFixture();
  original.plan.rules.find((r) => r.field === 'fee')!.derivation = 'integer-v1';
  expect(() => extractPositions(original.document, original.plan)).toThrow(
    'FIELD_DERIVATION_MISMATCH',
  );
});
it('R11 inconsistent payment deadline and unspecified datetime zone require review', () => {
  const { document, plan, coverage } = extractionFixture();
  const page = document.pages[0]!;
  // Same character count preserves the reviewed position windows.
  page.text = page.text.replaceAll('১৬/১২/২০২৬', '১৪/১২/২০২৬');
  const sealed = sealText(document);
  const positions = extractPositions(sealed, plan);
  expect(
    verifyExtraction(
      sealed,
      plan,
      positions,
      { ...coverage, scopeReview: { ...coverage.scopeReview, textVersion: sealed.textVersion } },
      () => true,
    ).errors,
  ).toContain('PAYMENT_PRECEDES_APPLICATION_DEADLINE');
});
