import {
  pgSchema,
  text,
  uuid,
  integer,
  bigint,
  boolean,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
import type {
  DocumentText,
  RevisionBundle,
  Inventory,
  PositionExtraction,
  StageJob,
} from '@uttirno/contracts';
import type { SignedSource } from '@uttirno/source-config';
import { schemaName } from './migrate.js';
// Typed Drizzle definitions; authored, checksummed SQL owns cross-table constraints/triggers.
export function tablesFor(name = 'uttirno') {
  const schema = pgSchema(schemaName(name));
  const authorities = schema.table('authorities', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    evidence: jsonb('evidence').notNull(),
    createdBy: text('created_by').notNull(),
  });
  const sources = schema.table('sources', {
    id: text('id').primaryKey(),
    authorityId: text('authority_id').notNull(),
    currentFingerprint: text('current_fingerprint'),
    collectionHalted: boolean('collection_halted').notNull(),
    displayHalted: boolean('display_halted').notNull(),
    controlEpoch: integer('control_epoch').notNull(),
    reason: text('reason'),
    nextDue: timestamp('next_due', { withTimezone: true }).notNull(),
    notBefore: timestamp('not_before', { withTimezone: true }).notNull(),
    intervalSeconds: integer('interval_seconds').notNull(),
  });
  const configs = schema.table('source_config_versions', {
    sourceId: text('source_id').notNull(),
    fingerprint: text('fingerprint').notNull(),
    version: integer('version').notNull(),
    bundle: jsonb('bundle').$type<SignedSource>().notNull(),
  });
  const artifacts = schema.table('artifacts', {
    sha256: text('sha256').primaryKey(),
    size: integer('size').notNull(),
    mediaType: text('media_type').notNull(),
    storageKey: text('storage_key').notNull(),
  });
  const texts = schema.table('artifact_text_versions', {
    textVersion: text('text_version').primaryKey(),
    captureId: text('capture_id').notNull(),
    document: jsonb('document').$type<DocumentText>().notNull(),
    engine: text('engine').notNull(),
  });
  const circulars = schema.table('circulars', {
    id: uuid('id').primaryKey(),
    authorityId: text('authority_id').notNull(),
    memo: text('memo').notNull(),
    generation: integer('generation').notNull(),
  });
  const revisions = schema.table('circular_revisions', {
    id: uuid('id').primaryKey(),
    circularId: uuid('circular_id').notNull(),
    runId: uuid('run_id').notNull(),
    generation: integer('generation').notNull(),
    sourceId: text('source_id').notNull(),
    fingerprint: text('fingerprint').notNull(),
    inventory: jsonb('inventory').$type<Inventory>().notNull(),
    bundle: jsonb('bundle').$type<RevisionBundle>().notNull(),
    contentDigest: text('content_digest').notNull(),
    createdBy: text('created_by').notNull(),
    parentId: uuid('parent_id'),
  });
  const positions = schema.table('positions', {
    id: uuid('id').primaryKey(),
    circularId: uuid('circular_id').notNull(),
    postKey: text('post_key').notNull(),
    recruitmentState: text('recruitment_state').notNull(),
  });
  const positionRevisions = schema.table('position_revisions', {
    id: uuid('id').primaryKey(),
    positionId: uuid('position_id').notNull(),
    circularRevisionId: uuid('circular_revision_id').notNull(),
    textVersion: text('text_version').notNull(),
    value: jsonb('value').$type<PositionExtraction>().notNull(),
  });
  const runs = schema.table('source_runs', {
    id: uuid('id').primaryKey(),
    sourceId: text('source_id').notNull(),
    fingerprint: text('fingerprint').notNull(),
    state: text('state').notNull(),
    inventory: jsonb('inventory'),
    requestCount: integer('request_count').notNull(),
    totalBytes: bigint('total_bytes', { mode: 'number' }).notNull(),
  });
  const stages = schema.table('stage_runs', {
    id: text('id').primaryKey(),
    runId: uuid('run_id').notNull(),
    payload: jsonb('payload').$type<StageJob>().notNull(),
    state: text('state').notNull(),
    attempts: integer('attempts').notNull(),
    maxAttempts: integer('max_attempts').notNull(),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull(),
    leaseToken: uuid('lease_token'),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    checkpoint: jsonb('checkpoint'),
  });
  const published = schema.table('published_positions', {
    positionId: uuid('position_id').primaryKey(),
    revisionId: uuid('revision_id').notNull(),
    circularRevisionId: uuid('circular_revision_id').notNull(),
    reviewActionId: uuid('review_action_id').notNull(),
    suppressed: boolean('suppressed').notNull(),
    reason: text('reason'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  });
  const outbox = schema.table('outbox_events', {
    id: uuid('id').primaryKey(),
    dedupeKey: text('dedupe_key').notNull(),
    topic: text('topic').notNull(),
    payload: jsonb('payload').notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  });
  return {
    authorities,
    sources,
    configs,
    artifacts,
    texts,
    circulars,
    revisions,
    positions,
    positionRevisions,
    runs,
    stages,
    published,
    outbox,
  };
}
