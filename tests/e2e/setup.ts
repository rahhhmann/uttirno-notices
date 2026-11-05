// SYNTHETIC STAFF/SOURCES ONLY. Built Next.js + actual HTTP API/PostgreSQL + signed OIDC.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { m5Context } from '../helpers/m5.js';
export async function adminFixture() {
  let handler: ((req: IncomingMessage, res: ServerResponse) => void | Promise<void>) | undefined;
  // The handler is initialized after the ephemeral port fixes the exact OIDC redirect/origin.
  const server = createServer((req, res) => {
    if (handler) void handler(req, res);
    else {
      res.writeHead(503);
      res.end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('EXPECTED_LOOPBACK_SERVER');
  const origin = `http://127.0.0.1:${address.port}`;
  const c = await m5Context(true, { apiPublicOrigin: origin, adminOrigin: origin });
  const api = await c.app.listen({ host: '127.0.0.1', port: 0 }),
    old = process.env.ADMIN_API_ORIGIN;
  process.env.ADMIN_API_ORIGIN = api;
  const require = createRequire(path.resolve('apps/admin/package.json'));
  const { default: next } = await import(pathToFileURL(require.resolve('next')).href);
  const app = next({ dev: false, dir: path.resolve('apps/admin') });
  await app.prepare();
  handler = app.getRequestHandler();
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  async function login(page: Page, subject: string) {
    c.provider.setSubject(subject);
    await page.goto(origin);
    await page.getByRole('link', { name: 'Continue with SSO' }).click();
    await page.waitForURL(`${origin}/`);
    await page.getByRole('heading', { name: 'Notice operations', exact: true }).waitFor();
  }
  async function stage(memo: string, bad = false) {
    const item = await c.makeDocument({ memoValue: memo, ocrMistake: bad });
    const run = await c.beginRun();
    const draft = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle: item.bundle,
      inventory: item.inventory,
    });
    if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    await c.execution.complete(run.claim, { syntheticFixturePrepared: true });
    return { ...item, draft, run };
  }
  return {
    ...c,
    browser,
    origin,
    api,
    login,
    stage,
    close: async () => {
      await browser.close();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await app.close();
      if (old === undefined) delete process.env.ADMIN_API_ORIGIN;
      else process.env.ADMIN_API_ORIGIN = old;
      await c.close();
    },
  };
}
