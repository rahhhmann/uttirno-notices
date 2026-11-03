import { z } from 'zod';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const TextPageSchema = z.strictObject({
  page: z.number().int().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  method: z.enum(['text', 'ocr']),
  text: z.string().max(200000),
  words: z
    .array(
      z.strictObject({
        start: z.number().int().nonnegative(),
        end: z.number().int().positive(),
        box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        confidence: z.number().min(0).max(100).nullable(),
      }),
    )
    .max(30000),
  flags: z.array(
    z.enum(['ocr_review', 'low_confidence', 'empty', 'replacement_characters', 'layout_review']),
  ),
});
export const DocumentTextSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sourceId: z.string().min(1),
  configFingerprint: hash,
  artifactSha256: hash,
  textVersion: hash,
  engine: z.string().min(1).max(500),
  pages: z.array(TextPageSchema).min(1).max(100),
});
export type DocumentText = z.infer<typeof DocumentTextSchema>;
export type TextPage = z.infer<typeof TextPageSchema>;
export const fieldNames = [
  'title',
  'postCode',
  'vacancies',
  'qualifications',
  'age',
  'salary',
  'experience',
  'district',
  'quota',
  'applicationDeadline',
  'paymentDeadline',
  'fee',
  'serviceCharge',
  'applicationSteps',
  'documents',
  'contact',
  'applicationUrl',
] as const;
export const FieldNameSchema = z.enum(fieldNames);
export type FieldName = z.infer<typeof FieldNameSchema>;
export const LocatedEvidenceSchema = z.strictObject({
  sourceId: z.string().min(1),
  artifactSha256: hash,
  textVersion: hash,
  scopeId: z.string().min(1).max(100),
  page: z.number().int().positive(),
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  quote: z.string().min(1).max(10000),
});
export type LocatedEvidence = z.infer<typeof LocatedEvidenceSchema>;
export const CandidateValueSchema = z.strictObject({
  raw: z.string().min(1).max(10000),
  normalized: z.string().min(1).max(10000),
  derivation: z.enum([
    'identity-v1',
    'digits-v1',
    'integer-v1',
    'date-v1',
    'money-v1',
    'age-v1',
    'url-v1',
  ]),
  evidence: LocatedEvidenceSchema,
});
export type CandidateValue = z.infer<typeof CandidateValueSchema>;
export const ExtractedFactSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('stated'), candidate: CandidateValueSchema }),
  z.strictObject({
    status: z.literal('conflicting'),
    candidates: z.array(CandidateValueSchema).min(2).max(30),
  }),
  z.strictObject({ status: z.literal('not_stated') }),
  z.strictObject({ status: z.literal('not_extracted') }),
  z.strictObject({ status: z.literal('not_applicable'), reason: z.string().min(1).max(1000) }),
]);
export type ExtractedFact = z.infer<typeof ExtractedFactSchema>;
export const PositionExtractionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  positionId: z.string().min(1).max(100),
  fields: z.record(FieldNameSchema, ExtractedFactSchema),
});
export type PositionExtraction = z.infer<typeof PositionExtractionSchema>;
export const ExtractionPlanSchema = z.strictObject({
  version: z.string().min(1).max(100),
  positions: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(100),
        ranges: z
          .array(
            z.strictObject({
              page: z.number().int().positive(),
              start: z.number().int().nonnegative(),
              end: z.number().int().positive(),
            }),
          )
          .min(1)
          .max(100),
      }),
    )
    .min(1)
    .max(200),
  rules: z
    .array(
      z.strictObject({
        field: FieldNameSchema,
        label: z.string().min(1).max(100),
        derivation: CandidateValueSchema.shape.derivation,
        absence: z.enum(['not_extracted', 'not_stated']).default('not_extracted'),
      }),
    )
    .min(1)
    .max(100),
});
export type ExtractionPlan = z.infer<typeof ExtractionPlanSchema>;
