import { z } from 'zod';
import {
  FieldNameSchema,
  fieldNames,
  ExtractedFactSchema,
  LocatedEvidenceSchema,
  DocumentTextSchema,
} from './extraction.js';
import { HashSchema, EventKindSchema, RevisionBundleSchema, InventorySchema } from './execution.js';
export const ApiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.string().regex(/^[A-Z_]+$/),
    message: z.string().max(300),
    requestId: z.string().min(1),
  }),
});
export const RoleSchema = z.enum(['operator', 'reviewer', 'source_approver', 'administrator']);
export type Role = z.infer<typeof RoleSchema>;
export const StatusSchema = z.enum(['unknown', 'upcoming', 'open', 'closed', 'cancelled']);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    try {
      return new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
    } catch {
      return false;
    }
  }, 'Invalid date');
export const JobsQuerySchema = z
  .strictObject({
    q: z.string().trim().max(150).optional(),
    authority: z.string().min(1).max(100).optional(),
    category: z.string().min(1).max(100).optional(),
    location: z.string().trim().min(1).max(100).optional(),
    education: z.string().trim().min(1).max(100).optional(),
    skill: z.string().trim().min(1).max(100).optional(),
    status: StatusSchema.optional(),
    deadlineFrom: date.optional(),
    deadlineTo: date.optional(),
    cursor: z.string().min(1).max(3000).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .refine(
    (v) => !v.deadlineFrom || !v.deadlineTo || v.deadlineFrom <= v.deadlineTo,
    'Invalid deadline range',
  );
export type JobsQuery = z.infer<typeof JobsQuerySchema>;
export const AuthoritySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1).max(1000),
});
const summaryFact = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('stated'),
    raw: z.string().max(10000),
    normalized: z.string().max(10000),
  }),
  z.strictObject({
    status: z.enum(['not_stated', 'not_extracted', 'conflicting', 'not_applicable']),
  }),
]);
export const JobSummarySchema = z.strictObject({
  id: z.uuid(),
  revisionId: z.uuid(),
  authority: AuthoritySchema,
  title: summaryFact,
  deadline: summaryFact,
  location: summaryFact,
  status: StatusSchema,
  categories: z.array(z.string()).max(50),
  classification: z.literal('derived_taxonomy'),
  taxonomyVersion: z.string(),
  publishedAt: z.iso.datetime(),
  lastChecked: z.iso.datetime().nullable(),
  lastVerified: z.iso.datetime(),
  stale: z.boolean(),
});
export const JobsPageSchema = z.strictObject({
  items: z.array(JobSummarySchema).max(50),
  nextCursor: z.string().nullable(),
  asOf: z.iso.datetime(),
});
export const PublicDocumentSchema = z.strictObject({
  sha256: HashSchema,
  url: z.string().url(),
  capturedAt: z.iso.datetime(),
});
export const PublicFactSchema = z.strictObject({
  fact: ExtractedFactSchema,
  documents: z.array(PublicDocumentSchema).max(20),
});
export const JobDetailSchema = z.strictObject({
  job: JobSummarySchema,
  fields: z.record(FieldNameSchema, PublicFactSchema),
  documents: z.array(PublicDocumentSchema).max(100),
});
export const PublicEventSchema = z.strictObject({
  id: z.uuid(),
  kind: EventKindSchema,
  recordedAt: z.iso.datetime(),
  source: PublicDocumentSchema,
  page: z.number().int().positive(),
  quote: z.string().max(10000),
});
export const EventsSchema = z.strictObject({
  positionId: z.uuid(),
  status: StatusSchema,
  events: z.array(PublicEventSchema).max(200),
});
export const AuthoritiesSchema = z.strictObject({ items: z.array(AuthoritySchema).max(1000) });
export const SessionSchema = z.strictObject({
  actorId: z.string().min(1).max(200),
  roles: z.array(RoleSchema),
  csrfToken: z.string().min(32),
  expiresAt: z.iso.datetime(),
});
export const AckSchema = z.strictObject({ ok: z.literal(true) });
export const ReasonSchema = z.string().trim().min(1).max(2000);
export const ReviewAttestationSchema = z.strictObject({
  bundleDigest: HashSchema,
  inventoryDigest: HashSchema,
  textVersions: z.array(HashSchema).min(1).max(120),
  acceptedQualityPages: z.record(HashSchema, z.array(z.number().int().min(1).max(100)).max(100)),
  supportingReviews: z.record(HashSchema, z.string().trim().min(1).max(2000)),
});
export const ApproveBodySchema = z.strictObject({
  expectedGeneration: z.number().int().positive(),
  reason: ReasonSchema,
  attestation: ReviewAttestationSchema,
  resolves: z.array(z.uuid()).max(200).default([]),
});
export const RejectBodySchema = z.strictObject({
  expectedGeneration: z.number().int().positive(),
  reason: ReasonSchema,
});
export const ControlsBodySchema = z.strictObject({
  expectedEpoch: z.number().int().nonnegative(),
  collectionHalted: z.boolean(),
  displayHalted: z.boolean(),
  reason: ReasonSchema,
});
export const ScheduleBodySchema = z.strictObject({ reason: ReasonSchema });
export const IdentityResolutionSchema = z.strictObject({
  memo: z.string().min(1).max(200),
  postKeys: z.record(z.string().min(1).max(100), z.string().min(1).max(200)),
  reason: ReasonSchema,
});
export const EventRecordSchema = z.strictObject({
  circularId: z.uuid(),
  kind: EventKindSchema,
  targets: z.array(z.uuid()).min(1).max(1000),
  textVersion: HashSchema,
  evidence: LocatedEvidenceSchema,
  reason: ReasonSchema,
});
export const EventDecisionSchema = z.strictObject({
  decision: z.enum(['approved', 'rejected']),
  reason: ReasonSchema,
  attestation: z
    .strictObject({
      textVersion: HashSchema,
      acceptedQualityPages: z.array(z.number().int().positive()).max(100),
    })
    .optional(),
});
export const RestoreBodySchema = z.strictObject({
  expectedRevision: z.uuid(),
  expectedGeneration: z.number().int().positive(),
  reason: ReasonSchema,
});
export const AdminReviewSnapshotSchema = z.strictObject({
  id: z.uuid(),
  generation: z.number().int().positive(),
  sourceId: z.string(),
  createdBy: z.string(),
  bundle: RevisionBundleSchema,
  inventory: InventorySchema,
  attestation: ReviewAttestationSchema,
  documents: z.array(DocumentTextSchema).max(120),
});
export const DraftBodySchema = z.strictObject({
  sourceId: z.string().min(1).max(64),
  runId: z.uuid(),
  bundle: RevisionBundleSchema,
  inventory: InventorySchema,
});
export const SourceRegistrationSchema = z.strictObject({
  authorityId: z.string().min(1).max(100),
  bundle: z.unknown(),
});
export const TaxonomySchema = z.strictObject({
  version: z.string().min(1).max(100),
  aliases: z
    .array(z.strictObject({ terms: z.array(z.string().trim().min(1).max(150)).min(2).max(20) }))
    .max(200),
  categories: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(100),
        titleIncludes: z.array(z.string().min(1).max(150)).min(1).max(50),
      }),
    )
    .max(100),
});
export type Taxonomy = z.infer<typeof TaxonomySchema>;
export const apiFieldNames = fieldNames;
