import { open } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseApiEnvironment, type ServerEnvironment } from '@uttirno/env';
import { createDatabase, schemaReady, type DatabaseOptions } from '@uttirno/database';
import { TaxonomySchema } from '@uttirno/contracts';
import { checkDependencies } from '@uttirno/infrastructure';
import { createApp } from './app.js';
async function json(file: string) {
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 1048576) throw new Error('CONFIG_INPUT_LIMIT');
    const bytes = Buffer.alloc(1048577);
    let offset = 0;
    while (offset < bytes.length) {
      const next = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!next.bytesRead) break;
      offset += next.bytesRead;
    }
    if (offset > 1048576) throw new Error('CONFIG_INPUT_LIMIT');
    return JSON.parse(bytes.subarray(0, offset).toString()) as unknown;
  } finally {
    await handle.close();
  }
}
export async function buildApplication(
  server: ServerEnvironment,
  input: Record<string, unknown> = process.env,
) {
  const env = parseApiEnvironment(input),
    database = createDatabase(server.DATABASE_URL);
  try {
    const taxonomy = TaxonomySchema.parse(
      await json(
        fileURLToPath(new URL('../../../config/taxonomy/search.v1.json', import.meta.url)),
      ),
    );
    const options: DatabaseOptions = {
      pool: database.pool,
      keys: async () => {
        if (!env.SOURCE_TRUST_KEYS_FILE) return {};
        const value = await json(env.SOURCE_TRUST_KEYS_FILE);
        if (
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          Object.values(value).some((v) => typeof v !== 'string')
        )
          throw new Error('INVALID_TRUST_KEYS');
        return value as Record<string, string>;
      },
    };
    const app = createApp(
      async () => {
        const health = await checkDependencies(server);
        health.database = health.database && (await schemaReady(database.pool));
        return health;
      },
      { env, database: options, taxonomy },
    );
    app.addHook('onClose', () => database.close());
    return app;
  } catch (error) {
    await database.close();
    throw error;
  }
}
