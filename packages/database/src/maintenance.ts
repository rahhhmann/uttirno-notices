import { createDatabase, migrate, provisionRuntimeGrants } from './index.js';
const [command, apiRole, workerRole] = process.argv.slice(2);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
const schema = process.env.DATABASE_SCHEMA ?? 'uttirno';
const db = createDatabase(process.env.DATABASE_URL, schema);
try {
  if (command === 'migrate') await migrate(db.pool, schema);
  else if (command === 'grants' && apiRole && workerRole)
    await provisionRuntimeGrants(db.pool, schema, apiRole, workerRole);
  else throw new Error('MAINTENANCE_ARGUMENTS_REQUIRED');
  console.log('Explicit database maintenance completed; no identities/sources seeded.');
} catch {
  console.error('DATABASE_MAINTENANCE_FAILED');
  process.exitCode = 1;
} finally {
  await db.close();
}
