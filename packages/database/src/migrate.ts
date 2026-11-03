import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
export const migrationNames = ['0001_core.sql', '0002_guards.sql'] as const;
export function schemaName(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) throw new Error('INVALID_DATABASE_SCHEMA');
  return value;
}
export async function migrate(pool: Pool, schema = 'uttirno', to: number = migrationNames.length) {
  schemaName(schema);
  if (!Number.isInteger(to) || to < 1 || to > migrationNames.length)
    throw new Error('INVALID_MIGRATION_TARGET');
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1,0))', [
      `uttirno-migration:${schema}`,
    ]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await client.query(`SET search_path TO "${schema}",pg_catalog`);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied = await client.query<{ name: string; checksum: string }>(
      'SELECT name,checksum FROM schema_migrations ORDER BY name',
    );
    if (
      applied.rows.some((r) => !(migrationNames as readonly string[]).includes(r.name)) ||
      applied.rows.length > to
    )
      throw new Error('UNSUPPORTED_MIGRATION_HISTORY');
    for (let i = 0; i < to; i++) {
      const name = migrationNames[i];
      if (!name) throw new Error('MISSING_MIGRATION');
      const sql = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = applied.rows.find((r) => r.name === name);
      if (existing) {
        if (existing.checksum !== checksum) throw new Error('MIGRATION_CHECKSUM_MISMATCH');
        continue;
      }
      if (applied.rows.some((r) => r.name > name)) throw new Error('MIGRATION_ORDER_MISMATCH');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
          name,
          checksum,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client
      .query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [`uttirno-migration:${schema}`])
      .catch(() => {});
    client.release();
  }
}
