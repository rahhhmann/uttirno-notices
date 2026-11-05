// Synthetic least-privilege roles only on the guarded dedicated local database.
import { randomBytes } from 'node:crypto';
import { createDatabase, provisionRuntimeGrants } from '@uttirno/database';
import type { m4Context } from './m4.js';
export async function runtimeRoles(c: Awaited<ReturnType<typeof m4Context>>) {
  const suffix = randomBytes(10).toString('hex'),
    apiRole = `m8_api_${suffix}`,
    workerRole = `m8_worker_${suffix}`,
    password = randomBytes(24).toString('hex');
  for (const role of [apiRole, workerRole])
    await c.database.pool.query(
      `CREATE ROLE "${role}" LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`,
    );
  // Adversarial pre-existing column ACL must not survive grant reconciliation.
  await c.database.pool.query(`GRANT UPDATE(role) ON "${c.schema}".admin_roles TO "${workerRole}"`);
  try {
    await provisionRuntimeGrants(c.database.pool, c.schema, apiRole, workerRole);
  } catch (error) {
    for (const role of [apiRole, workerRole]) {
      await c.database.pool.query(`DROP OWNED BY "${role}"`);
      await c.database.pool.query(`DROP ROLE "${role}"`);
    }
    throw error;
  }
  const url = new URL(c.env.DATABASE_URL);
  url.username = apiRole;
  url.password = password;
  const apiUrl = url.href,
    api = createDatabase(apiUrl, c.schema);
  url.username = workerRole;
  const worker = createDatabase(url.href, c.schema);
  return {
    apiRole,
    workerRole,
    apiUrl,
    api,
    worker,
    close: async () => {
      await api.close();
      await worker.close();
      for (const role of [apiRole, workerRole]) {
        if (!/^m8_(api|worker)_[a-f0-9]{20}$/.test(role)) throw new Error('UNSAFE_ROLE_CLEANUP');
        await c.database.pool.query(`DROP OWNED BY "${role}"`);
        await c.database.pool.query(`DROP ROLE "${role}"`);
      }
    },
  };
}
