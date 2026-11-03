import { z } from 'zod';
import { ExtractionPlanSchema, PositionExtractionSchema } from './extraction.js';
export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const StageJobSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.uuid(),
  sourceId: z.string().min(1).max(64),
  fingerprint: HashSchema,
  stage: z.enum(['discover', 'document', 'reconcile']),
  inputKey: z.string().min(1).max(1000),
  generation: z.number().int().nonnegative(),
});
export type StageJob = z.infer<typeof StageJobSchema>;
export const RevisionBundleSchema = z.strictObject({
  schemaVersion: z.literal(1),
  supportingDocuments: z.array(HashSchema).max(100).default([]),
  entries: z
    .array(
      z.strictObject({
        textVersion: HashSchema,
        plan: ExtractionPlanSchema,
        positions: z.array(PositionExtractionSchema).min(1).max(200),
      }),
    )
    .min(1)
    .max(20),
});
export type RevisionBundle = z.infer<typeof RevisionBundleSchema>;
export const InventorySchema = z.strictObject({
  artifactHashes: z.array(HashSchema).min(1).max(100),
  positionKeys: z.array(z.string().min(1).max(100)).min(1).max(1000),
});
export type Inventory = z.infer<typeof InventorySchema>;
export const EventKindSchema = z.enum([
  'circular',
  'amendment',
  'extension',
  'cancellation',
  'exam',
  'admit',
  'result',
]);
export type EventKind = z.infer<typeof EventKindSchema>;
