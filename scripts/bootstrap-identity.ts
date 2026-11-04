import { open } from 'node:fs/promises';
import { z } from 'zod';
import { loadServerEnvironment } from '@uttirno/env';
import { createDatabase, IdentityRepository } from '@uttirno/database';
import { RoleSchema, ReasonSchema } from '@uttirno/contracts';
const file = process.argv[2];
if (!file) throw new Error('EXPLICIT_IDENTITY_FILE_REQUIRED');
const handle = await open(file, 'r');
let value: unknown;
try {
  const stat = await handle.stat();
  if (!stat.isFile() || stat.size > 16384) throw new Error('IDENTITY_FILE_LIMIT');
  value = JSON.parse((await handle.readFile()).toString());
} finally {
  await handle.close();
}
const input = z
  .strictObject({
    actorId: z.string().min(1).max(200),
    issuer: z.string().url(),
    subject: z.string().min(1).max(300),
    roles: z.array(RoleSchema).min(1).max(4),
    reason: ReasonSchema,
  })
  .parse(value);
const env = loadServerEnvironment(),
  database = createDatabase(env.DATABASE_URL);
try {
  await new IdentityRepository({ pool: database.pool, keys: async () => ({}) }).bootstrap(input);
  console.log(
    'Explicit initial administrator binding recorded; no passwords or provider tokens created.',
  );
} catch {
  console.error('IDENTITY_BOOTSTRAP_REJECTED');
  process.exitCode = 1;
} finally {
  await database.close();
}
