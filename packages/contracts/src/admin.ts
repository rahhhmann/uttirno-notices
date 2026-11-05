import { z } from 'zod';
import { HashSchema, RevisionBundleSchema, InventorySchema } from './execution.js';
import { DocumentTextSchema } from './extraction.js';

export const AdminPageSchema = z.strictObject({
  items: z.array(z.record(z.string(), z.unknown())).max(50),
  nextCursor: z.string().nullable(),
});
export type AdminResource =
  'sources' | 'runs' | 'revisions' | 'duplicates' | 'events' | 'audit' | 'stages';
export const SourceAssessmentSchema = z.strictObject({
  id: z.string(),
  authorityId: z.string(),
  fingerprint: HashSchema,
  epoch: z.number().int().nonnegative(),
  collectionHalted: z.boolean(),
  displayHalted: z.boolean(),
  collection: z.strictObject({ allowed: z.boolean(), code: z.string() }),
  display: z.strictObject({ allowed: z.boolean(), code: z.string() }),
  bundle: z.record(z.string(), z.unknown()),
  history: z.array(z.record(z.string(), z.unknown())).max(50),
});
export type SourceAssessment = z.infer<typeof SourceAssessmentSchema>;
export const SourcePreviewBodySchema = z.strictObject({
  bundle: z.unknown(),
  url: z.string().url().max(2000),
  sample: z.string().min(1).max(262144),
  expectedCandidates: z.number().int().min(0).max(1000),
});
export const SourcePreviewSchema = z.strictObject({
  state: z.literal('needs_review'),
  fingerprint: HashSchema,
  sampleSha256: HashSchema,
  matchesExpected: z.boolean(),
  items: z
    .array(
      z.strictObject({
        title: z.string(),
        locator: z.string(),
        detailUrl: z.string().nullable(),
        attachments: z.array(z.string()),
        siblings: z.array(z.string()),
        fields: z.record(
          z.string(),
          z.strictObject({ original: z.string(), normalized: z.string(), locator: z.string() }),
        ),
      }),
    )
    .max(1000),
  nextUrl: z.string().nullable(),
  errors: z.array(z.string()),
  quarantined: z.array(z.string()),
});
export const AuthorityRegistrationSchema = z.strictObject({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(1000),
  evidence: z
    .array(z.strictObject({ url: z.string().url(), note: z.string().min(1).max(1000) }))
    .min(1)
    .max(20),
});
export const AdminCaseSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(['duplicate', 'event']),
  record: z.record(z.string(), z.unknown()),
  bundle: RevisionBundleSchema.nullable(),
  inventory: InventorySchema.nullable(),
  documents: z.array(DocumentTextSchema).max(120),
  positions: z
    .array(
      z.strictObject({
        id: z.uuid(),
        postKey: z.string(),
        revisionId: z.uuid().nullable(),
        generation: z.number().int(),
        suppressed: z.boolean(),
      }),
    )
    .max(1000),
});
export const ReviewContextSchema = z.strictObject({
  currentGeneration: z.number().int(),
  state: z.enum(['draft', 'approved', 'rejected', 'superseded']),
  actions: z.array(z.record(z.string(), z.unknown())).max(100),
  positions: z
    .array(
      z.strictObject({
        id: z.uuid(),
        postKey: z.string(),
        revisionId: z.uuid().nullable(),
        generation: z.number().int(),
        suppressed: z.boolean(),
      }),
    )
    .max(1000),
  events: z.array(z.record(z.string(), z.unknown())).max(200),
});
export const OriginalDocumentSchema = z.strictObject({
  textVersion: HashSchema,
  sha256: HashSchema,
  url: z.string().url(),
  capturedAt: z.iso.datetime(),
  mediaType: z.string(),
  size: z.number().int().positive(),
  captureId: HashSchema,
});

export const AdminHealthSchema = z.strictObject({
  checkedAt: z.iso.datetime(),
  ready: z.boolean(),
  dependencies: z.strictObject({ database: z.boolean(), redis: z.boolean(), storage: z.boolean() }),
});

export const AuthAvailabilitySchema = z.strictObject({ configured: z.boolean() });
export const OriginalTextPreviewSchema = z.strictObject({
  text: z.string().max(262144),
  truncated: z.boolean(),
});
