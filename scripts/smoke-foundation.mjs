import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadServerEnvironment } from '@uttirno/env';
import { JobsPageSchema } from '@uttirno/contracts';
import { buildApplication } from '../apps/api/dist/startup.js';

const env = loadServerEnvironment();
const api = await buildApplication(env);
try {
  const address = await api.listen({ host: '127.0.0.1', port: 0 });
  assert.equal((await fetch(`${address}/health/live`)).status, 200);
  assert.equal((await fetch(`${address}/health/ready`)).status, 200);
  const jobs = await fetch(`${address}/v1/jobs`);
  assert.equal(jobs.status, 200);
  JobsPageSchema.parse(await jobs.json());
  assert.equal((await fetch(`${address}/v1/admin/session`)).status, 401);
  console.log(
    'Built API HTTP smoke passed: live, real readiness, approved-only jobs contract, unauthenticated admin denial.',
  );
} finally {
  await api.close();
}

for (const name of ['portal', 'admin']) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./smoke-web.mjs', import.meta.url)), name],
    {
      stdio: 'inherit',
      timeout: 60000,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    },
  );
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Built ${name} HTTP smoke failed`);
}
