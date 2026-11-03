import { loadServerEnvironment } from '@uttirno/env';
import { createDatabase } from '@uttirno/database';
import { createRuntime } from './runtime.js';
import { createHandlers } from './handlers.js';
import { trustKeys, documentPlans } from './files.js';
async function main() {
  const [command, keysFile, archiveRoot, plansFile, actorId] = process.argv.slice(2);
  if (command === 'check-config') {
    loadServerEnvironment();
    console.log('worker configuration valid; no source requests or jobs executed.');
    return;
  }
  if (command !== 'run' || !keysFile || !archiveRoot || !plansFile || !actorId)
    throw new Error('WORKER_ARGUMENTS_REQUIRED');
  const env = loadServerEnvironment(),
    database = createDatabase(env.DATABASE_URL);
  const options = { pool: database.pool, keys: () => trustKeys(keysFile) };
  let runtime: ReturnType<typeof createRuntime> | undefined;
  try {
    const plans = await documentPlans(plansFile);
    const handlers = createHandlers({ database: options, actorId, archiveRoot, plans });
    runtime = createRuntime({ database: options, redisUrl: env.REDIS_URL, actorId, handlers });
    await runtime.worker.waitUntilReady();
    await runtime.tick();
    const active = runtime;
    const timer = setInterval(() => {
      active.tick().catch(() => console.error('WORKER_TICK_FAILED'));
    }, 5000);
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      clearInterval(timer);
      await active.close();
      await database.close();
    };
    process.once('SIGINT', () => {
      close().catch(() => {
        process.exitCode = 1;
      });
    });
    process.once('SIGTERM', () => {
      close().catch(() => {
        process.exitCode = 1;
      });
    });
    console.log(
      'worker running; only currently approved sources and pinned durable stages can execute.',
    );
  } catch {
    await runtime?.close();
    await database.close();
    throw new Error('WORKER_START_FAILED');
  }
}
main().catch(() => {
  console.error('WORKER_START_FAILED');
  process.exitCode = 1;
});
