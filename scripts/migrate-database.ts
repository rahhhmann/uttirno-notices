import { loadServerEnvironment } from '@uttirno/env';
import { createDatabase, migrate } from '@uttirno/database';
const env = loadServerEnvironment();
const database = createDatabase(env.DATABASE_URL);
try {
  await migrate(database.pool);
  console.log(
    'Checksummed Uttirno schema migrations applied; no identities, source approvals or jobs seeded.',
  );
} catch {
  console.error('DATABASE_MIGRATION_FAILED');
  process.exitCode = 1;
} finally {
  await database.close();
}
