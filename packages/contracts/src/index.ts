import { z } from 'zod';
export * from './extraction.js';
export * from './execution.js';
export * from './api.js';
export * from './admin.js';

export const EvidenceSchema = z.strictObject({
  sourceId: z.string().min(1),
  artifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
  textVersion: z.string().min(1),
  positionScope: z.string().min(1),
  locator: z.string().min(1),
  quote: z.string().trim().min(1).max(10000),
});
export type Evidence = z.infer<typeof EvidenceSchema>;
export function factSchema<T extends z.ZodType>(valueSchema: T) {
  const candidate = z.strictObject({
    value: valueSchema,
    evidence: z.array(EvidenceSchema).min(1),
  });
  return z.discriminatedUnion('status', [
    z.strictObject({
      status: z.literal('stated'),
      value: valueSchema,
      evidence: z.array(EvidenceSchema).min(1),
    }),
    z.strictObject({ status: z.literal('not_stated') }),
    z.strictObject({ status: z.literal('not_extracted') }),
    z.strictObject({ status: z.literal('not_applicable'), reason: z.string().trim().min(1) }),
    z.strictObject({ status: z.literal('conflicting'), candidates: z.array(candidate).min(2) }),
  ]);
}
export const TitleFactSchema = factSchema(z.string().trim().min(1));
export type TitleFact = z.infer<typeof TitleFactSchema>;
// Shape validation is not semantic verification or publication approval.
