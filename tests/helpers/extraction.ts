// SYNTHETIC test data, never a real recruiting authority or permission approval.
import type { DocumentText, ExtractionPlan, FieldName } from '@uttirno/contracts';
import { sealText } from '../../apps/agent/src/documents/archive.js';
export { sealText };
export const syntheticLines = [
  'Title: Software Engineer',
  'Vacancies: ১২',
  'Qualifications: BSc CSE',
  'Age: ১৮-৩০ as of ০১/১১/২০২৬ [general]',
  'Application deadline: ১৫/১২/২০২৬',
  'Payment deadline: ১৬/১২/২০২৬ ১৭:০০ BDT',
  'Fee: BDT ১০০ [general]',
  'Apply: https://notices.example/apply',
];
export function extractionFixture() {
  const first = syntheticLines.join('\n');
  const second = syntheticLines
    .join('\n')
    .replace('Software Engineer', 'Data Analyst')
    .replace('১২', '৩')
    .replace('BSc CSE', 'MSc Statistics')
    .replace('১০০', '৫০');
  const text = `${first}\n${second}\nGeneral website disclaimer: No fee for browsing.`;
  const document: DocumentText = sealText({
    schemaVersion: 1,
    sourceId: 'synthetic-source',
    configFingerprint: 'b'.repeat(64),
    artifactSha256: 'a'.repeat(64),
    engine: 'SYNTHETIC-text-v1',
    pages: [{ page: 1, width: 600, height: 900, method: 'text', text, words: [], flags: [] }],
  });
  const labels: Record<FieldName, string> = {
    title: 'Title',
    postCode: 'Post code',
    vacancies: 'Vacancies',
    qualifications: 'Qualifications',
    age: 'Age',
    salary: 'Salary',
    experience: 'Experience',
    district: 'District',
    quota: 'Quota',
    applicationDeadline: 'Application deadline',
    paymentDeadline: 'Payment deadline',
    fee: 'Fee',
    serviceCharge: 'Service charge',
    applicationSteps: 'Steps',
    documents: 'Documents',
    contact: 'Contact',
    applicationUrl: 'Apply',
  };
  const plan: ExtractionPlan = {
    version: 'synthetic-v1',
    positions: [
      { id: 'engineer', ranges: [{ page: 1, start: 0, end: first.length }] },
      {
        id: 'analyst',
        ranges: [{ page: 1, start: first.length + 1, end: first.length + 1 + second.length }],
      },
    ],
    rules: Object.entries(labels).map(([field, label]) => ({
      field: field as FieldName,
      label,
      absence: 'not_stated',
      derivation: field.includes('Deadline')
        ? 'date-v1'
        : ['fee', 'serviceCharge'].includes(field)
          ? 'money-v1'
          : field === 'age'
            ? 'age-v1'
            : field === 'vacancies'
              ? 'integer-v1'
              : field === 'applicationUrl'
                ? 'url-v1'
                : 'identity-v1',
    })),
  };
  const coverage = {
    expectedArtifacts: [document.artifactSha256],
    inspectedArtifacts: [document.artifactSha256],
    expectedPositions: ['engineer', 'analyst'],
    scopeReview: {
      textVersion: document.textVersion,
      plan,
      reviewedBy: 'synthetic-reviewer',
      acceptedQualityPages: [] as number[],
    },
  };
  return { document, plan, coverage };
}
