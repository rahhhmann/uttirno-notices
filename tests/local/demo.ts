// SYNTHETIC local rehearsal only. Uses guarded temporary DB schema and private archive.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { m5Context } from '../helpers/m5.js';

const role = process.argv[2] ?? 'reviewer';
if (!['reviewer', 'operator', 'approver', 'admin'].includes(role))
  throw new Error('Choose reviewer, operator, approver or admin');
const cleanups: (() => Promise<void>)[] = [];
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  for (const cleanup of cleanups.reverse()) {
    try {
      await cleanup();
    } catch {
      process.exitCode = 1;
      console.error('Local rehearsal cleanup failed; inspect temporary test schema.');
    }
  }
}
process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());
try {
  const c = await m5Context(true, {
    apiPublicOrigin: 'http://127.0.0.1:3001',
    adminOrigin: 'http://127.0.0.1:3001',
  });
  cleanups.push(c.close);
  c.provider.setSubject(`${role}-sub`);
  const api = await c.app.listen({ host: '127.0.0.1', port: 4000 });
  process.env.ADMIN_API_ORIGIN = api;
  process.env.PORTAL_API_ORIGIN = api;
  process.env.ADMIN_BRAND_NAME = 'SYNTHETIC local rehearsal';
  process.env.PORTAL_BRAND_NAME = 'SYNTHETIC local rehearsal';
  const item = await c.makeDocument({ memoValue: 'SYNTHETIC-LOCAL-REVIEW' });
  const run = await c.beginRun();
  const draft = await c.revisions.stage('operator', {
    sourceId: c.source.config.id,
    runId: run.runId,
    bundle: item.bundle,
    inventory: item.inventory,
  });
  if (draft.state !== 'draft') throw new Error('EXPECTED_LOCAL_DRAFT');
  await c.execution.complete(run.claim, { syntheticFixturePrepared: true });
  if ((await c.app.inject('/v1/jobs')).json().items.length !== 0)
    throw new Error('UNREVIEWED_DATA_EXPOSED');
  for (const [name, port] of [
    ['admin', 3001],
    ['portal', 3000],
  ] as const) {
    const dir = path.resolve('apps', name);
    const require = createRequire(path.join(dir, 'package.json'));
    const { default: next } = await import(pathToFileURL(require.resolve('next')).href);
    const app = next({ dev: false, dir });
    cleanups.push(() => app.close());
    await app.prepare();
    const server = createServer(app.getRequestHandler());
    cleanups.push(async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
  }
  console.log(`SYNTHETIC rehearsal only; no real source acquisition or Google account.
Portal: http://127.0.0.1:3000/jobs?lang=en (empty until manual approval)
Staff: http://127.0.0.1:3001 (SSO signs in as local ${role})
Review: http://127.0.0.1:3001/reviews/${draft.revisionId}
Compare original and scoped fields, tick review confirmations, then approve.
Reload portal: two fictional positions should appear. Never follow example application links.
Ctrl+C removes this run's temporary schema/archive; service volumes remain.`);
} catch {
  console.error(
    'Local rehearsal failed. Check services, built apps, and free ports 3000/3001/4000.',
  );
  process.exitCode = 1;
  await close();
}
