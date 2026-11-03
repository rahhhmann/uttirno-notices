import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    statement_timeout: 3000,
  });
  return { pool, db: drizzle(pool), close: () => pool.end() };
}
// No schema writes or automatic seeding on connection. M4 owns job schema/migrations.
