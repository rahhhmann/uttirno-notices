import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseApiEnvironment, parseServerEnvironment } from '@uttirno/env';
export function validateRelease(api, worker, migration, images) {
  for (const image of images)
    if (!/^[a-zA-Z0-9./_-]+@sha256:[a-f0-9]{64}$/.test(image ?? ''))
      throw new Error('IMMUTABLE_IMAGE_REQUIRED');
  parseServerEnvironment(api);
  parseApiEnvironment(api);
  parseServerEnvironment(worker);
  if (api.NODE_ENV !== 'production' || worker.NODE_ENV !== 'production')
    throw new Error('PRODUCTION_ENV_REQUIRED');
  const urls = [api.DATABASE_URL, worker.DATABASE_URL, migration.DATABASE_URL].map(
    (value) => new URL(value),
  );
  if (
    urls.some((url) => url.searchParams.get('sslmode') !== 'verify-full') ||
    !worker.REDIS_URL.startsWith('rediss:') ||
    !api.REDIS_URL.startsWith('rediss:')
  )
    throw new Error('ENCRYPTED_DATABASE_REDIS_REQUIRED');
  if (
    new Set(urls.map((url) => url.username)).size !== 3 ||
    new Set(urls.map((url) => `${url.host}${url.pathname}`)).size !== 1
  )
    throw new Error('SEPARATE_DATABASE_CREDENTIALS_REQUIRED');
  if (typeof api.OPERATIONS_TOKEN !== 'string' || api.OPERATIONS_TOKEN.length < 32)
    throw new Error('OPERATIONS_TOKEN_REQUIRED');
  return { configurationValid: true, liveDeploymentVerified: false };
}
async function main() {
  const read = async (name) => process.parseEnv(await readFile(process.env[name], 'utf8'));
  console.log(
    JSON.stringify(
      validateRelease(
        await read('API_ENV_FILE'),
        await read('WORKER_ENV_FILE'),
        await read('MIGRATION_ENV_FILE'),
        [process.env.RELEASE_IMAGE, process.env.PARSER_IMAGE],
      ),
    ),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error('RELEASE_PREFLIGHT_FAILED');
    process.exitCode = 1;
  });
