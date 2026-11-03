import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadServerEnvironment } from '@uttirno/env';
import { checkDependencies } from '@uttirno/infrastructure';
import { createApp } from '../apps/api/dist/app.js';

const env = loadServerEnvironment();
const api = createApp(() => checkDependencies(env));
try {
  const address = await api.listen({ host: '127.0.0.1', port: 0 });
  assert.equal((await fetch(`${address}/health/live`)).status, 200);
  assert.equal((await fetch(`${address}/health/ready`)).status, 200);
  assert.equal((await fetch(`${address}/v1/jobs`)).status, 404);
  console.log('Built API HTTP smoke passed: live, real readiness, no fabricated jobs endpoint.');
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
