import { writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const postgres = randomBytes(24).toString('hex'),
  redis = randomBytes(24).toString('hex');
const body = [
  '# Generated isolated development credentials. Never use for production.',
  'NODE_ENV=development',
  'HOST=127.0.0.1',
  'PORT=4000',
  'API_PUBLIC_ORIGIN=http://127.0.0.1:4000',
  'ADMIN_ORIGIN=http://127.0.0.1:3001',
  `API_CURSOR_SECRET=${randomBytes(32).toString('hex')}`,
  `API_SESSION_SECRET=${randomBytes(32).toString('hex')}`,
  `DATABASE_URL=postgresql://uttirno_dev:${postgres}@127.0.0.1:55432/uttirno_dev`,
  `REDIS_URL=redis://:${redis}@127.0.0.1:56379`,
  'S3_ENDPOINT=http://127.0.0.1:54566',
  'S3_REGION=us-east-1',
  'S3_BUCKET=uttirno-dev-artifacts',
  'S3_ACCESS_KEY_ID=test',
  'S3_SECRET_ACCESS_KEY=test',
  `LOCAL_POSTGRES_PASSWORD=${postgres}`,
  `LOCAL_REDIS_PASSWORD=${redis}`,
  'LLM_PROVIDER=',
  'LLM_API_KEY=',
  'LLM_MODEL=',
  '',
].join('\n');
try {
  await writeFile('.env', body, { flag: 'wx', mode: 0o600 });
  console.log(
    'Created ignored .env for isolated containers on ports 55432/56379/54566. Existing native PostgreSQL is untouched.',
  );
} catch (e) {
  if (e.code === 'EEXIST') {
    console.error('.env already exists; refusing to overwrite credentials.');
    process.exitCode = 1;
  } else throw e;
}
