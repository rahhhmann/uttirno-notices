import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { schemaName } from './migrate.js';
import { tablesFor } from './schema.js';
export * from './schema.js';
export { PublicReadRepository, queryTerms } from './public-read.js';
export { IdentityRepository, type IdentityInput } from './identity.js';
export { AdminReadRepository } from './admin-read.js';
export { withSessionAuthorization } from './shared.js';
export * from './migrate.js';
export { SourceRepository } from './sources.js';
export { DocumentRepository, type ArtifactReceipt } from './documents.js';
export { RevisionRepository, type DraftInput } from './revisions.js';
export { PublicationRepository, type ReviewAttestation } from './publication.js';
export { EventRepository } from './events.js';
export { ExecutionRepository, type StageClaim } from './execution.js';
export { OutboxRepository, type OutboxClaim } from './outbox.js';
export type { DatabaseOptions, WriteFence } from './shared.js';
export function createDatabase(connectionString: string, schema = 'uttirno') {
  schemaName(schema);
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    statement_timeout: 3000,
    options: `-c search_path=${schema},pg_catalog`,
  });
  return { pool, db: drizzle(pool, { schema: tablesFor(schema) }), close: () => pool.end() };
}
// Connecting never applies migrations or seeds identities/permissions.
