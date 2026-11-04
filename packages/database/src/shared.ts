import { createHash, randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolClient } from 'pg';
import {
  authorizeSource,
  configFingerprint,
  SignedSourceSchema,
  SourcePolicyError,
  canonical,
  type TrustKeys,
  type SourceConfig,
} from '@uttirno/source-config';
export const digest = (input: unknown) =>
  createHash('sha256').update(canonical(input)).digest('hex');
export type DatabaseOptions = { pool: Pool; keys: () => Promise<TrustKeys> };
const transactions = new AsyncLocalStorage<{ pool: Pool; client: PoolClient }>();
const authorization = new AsyncLocalStorage<{ actor: string; tokenHash: string }>();
export function withSessionAuthorization<T>(
  actor: string,
  tokenHash: string,
  action: () => Promise<T>,
) {
  return authorization.run({ actor, tokenHash }, action);
}
export async function transaction<T>(
  pool: Pool,
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const parent = transactions.getStore();
  if (parent?.pool === pool) return action(parent.client);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await transactions.run({ pool, client }, () => action(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function requireRole(client: PoolClient, actor: string, roles: string[]) {
  const session = authorization.getStore();
  if (session) {
    if (session.actor !== actor) throw new Error('ACTOR_NOT_AUTHORIZED');
    const active = await client.query(
      `SELECT 1 FROM admin_sessions s JOIN identity_bindings b ON b.issuer=s.issuer AND b.subject=s.subject
      WHERE s.token_hash=$1 AND s.actor_id=$2 AND b.actor_id=s.actor_id AND s.revoked_at IS NULL
      AND s.expires_at>clock_timestamp() AND s.idle_expires_at>clock_timestamp() FOR SHARE OF s,b`,
      [session.tokenHash, actor],
    );
    if (!active.rowCount) throw new Error('SESSION_EXPIRED');
  }
  const result = await client.query(
    'SELECT 1 FROM admin_roles r JOIN admin_identities i ON i.id=r.actor_id WHERE i.id=$1 AND NOT i.disabled AND r.role=ANY($2::text[]) LIMIT 1 FOR SHARE OF i,r',
    [actor, roles],
  );
  if (!result.rowCount) throw new Error('ACTOR_NOT_AUTHORIZED');
}
export async function audit(
  client: PoolClient,
  actor: string,
  action: string,
  id: string,
  details: unknown,
) {
  await client.query(
    'INSERT INTO audit_events(id,actor_id,action,entity_id,details) VALUES($1,$2,$3,$4,$5)',
    [randomUUID(), actor, action, id, JSON.stringify(details)],
  );
}
export type SourceRow = {
  id: string;
  authority_id: string;
  current_fingerprint: string;
  collection_halted: boolean;
  display_halted: boolean;
  control_epoch: number;
  bundle: unknown;
  not_before: Date | number;
};
export async function sourceRow(client: PoolClient, id: string, lock = false): Promise<SourceRow> {
  const result = await client.query<SourceRow>(
    `SELECT s.*,v.bundle FROM sources s JOIN source_config_versions v ON v.source_id=s.id AND v.fingerprint=s.current_fingerprint WHERE s.id=$1 ${lock ? 'FOR UPDATE OF s' : ''}`,
    [id],
  );
  const row = result.rows[0];
  if (!row) throw new Error('SOURCE_NOT_REGISTERED');
  return row;
}
export async function gate(
  client: PoolClient,
  options: DatabaseOptions,
  id: string,
  purpose: 'collection' | 'display',
  fingerprint?: string,
  lock = false,
): Promise<{ row: SourceRow; config: SourceConfig }> {
  const row = await sourceRow(client, id, lock);
  if (
    (purpose === 'collection' && row.collection_halted) ||
    (purpose === 'display' && row.display_halted)
  )
    throw new Error('SOURCE_HALTED');
  const now = (await client.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0]?.now;
  const config = authorizeSource(row.bundle, await options.keys(), now, purpose);
  if (purpose === 'collection' && now && row.not_before instanceof Date && row.not_before > now)
    throw new SourcePolicyError('RETRY_LATER', row.not_before.getTime() - now.getTime());
  if (fingerprint && configFingerprint(config) !== fingerprint)
    throw new Error('SOURCE_CONFIG_STALE');
  if (purpose === 'display' && config.display !== 'permitted')
    throw new Error('FULL_DISPLAY_NOT_PERMITTED');
  return { row, config };
}
export type WriteFence = { id: string; token: string };
export async function assertWriter(c: PoolClient, sourceId: string, fence?: WriteFence) {
  if (!fence) return;
  const result = await c.query(
    "SELECT 1 FROM stage_runs s JOIN source_runs r ON r.id=s.run_id JOIN resource_leases l ON l.resource_key='source:'||r.source_id WHERE s.id=$1 AND s.lease_token=$2 AND l.token=$2 AND r.source_id=$3 AND s.state='running' AND s.lease_until>clock_timestamp() AND l.expires_at>clock_timestamp()",
    [fence.id, fence.token, sourceId],
  );
  if (!result.rowCount) throw new Error('STAGE_LEASE_LOST');
}
export async function insertStage(client: PoolClient, id: string, payload: unknown) {
  const runId = (payload as { runId: string }).runId;
  await client.query(
    "INSERT INTO stage_runs(id,run_id,payload,state) VALUES($1,$2,$3,'queued') ON CONFLICT(id) DO NOTHING",
    [id, runId, JSON.stringify(payload)],
  );
  await client.query(
    "INSERT INTO outbox_events(id,dedupe_key,topic,payload) VALUES($1,$2,'stage',$3) ON CONFLICT(dedupe_key) DO NOTHING",
    [randomUUID(), `stage:${id}`, JSON.stringify({ stageId: id })],
  );
}
export async function sourceBundle(options: DatabaseOptions, id: string) {
  return transaction(options.pool, async (c) =>
    SignedSourceSchema.parse((await gate(c, options, id, 'collection')).row.bundle),
  );
}
