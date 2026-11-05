// SYNTHETIC records only: built public Next.js + actual API/PostgreSQL. No recruiting-site calls.
import { beforeAll, afterAll, it, expect } from 'vitest';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { m5Context } from '../helpers/m5.js';
let c: Awaited<ReturnType<typeof m5Context>>;
let browser: Awaited<ReturnType<typeof chromium.launch>>;
let web: { close: () => Promise<void> };
let server: ReturnType<typeof createServer>;
let origin: string;
let id: string;
let revision: string;
let baseline: Awaited<ReturnType<import('@uttirno/api-client').PublicApiClient['job']>>;
const old = process.env.PORTAL_API_ORIGIN;
beforeAll(async () => {
  c = await m5Context();
  process.env.PORTAL_API_ORIGIN = await c.app.listen({ host: '127.0.0.1', port: 0 });
  const require = createRequire(path.resolve('apps/portal/package.json'));
  const { default: next } = await import(pathToFileURL(require.resolve('next')).href);
  const app = next({ dev: false, dir: path.resolve('apps/portal') });
  await app.prepare();
  web = app;
  server = createServer(app.getRequestHandler());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('EXPECTED_PORT');
  origin = `http://127.0.0.1:${addr.port}`;
  browser = await chromium.launch({ headless: true, chromiumSandbox: true });
});
afterAll(async () => {
  await browser?.close();
  server?.closeAllConnections();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await web?.close();
  await c?.close();
  if (old === undefined) delete process.env.PORTAL_API_ORIGIN;
  else process.env.PORTAL_API_ORIGIN = old;
});
it('R19/R26 empty/invalid filters, mobile keyboard, Unicode and light/dark accessibility', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/jobs?lang=en`);
    await page.getByRole('heading', { name: 'No matching jobs' }).waitFor();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.textContent)).toContain(
      'Skip to content',
    );
    await page.keyboard.press('Enter');
    expect(await page.locator('#content').evaluate((e) => e === document.activeElement)).toBe(true);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
    await page.getByLabel('Search', { exact: true }).fill('প্রকৌশলী');
    await page.getByRole('button', { name: 'Search jobs' }).click();
    await page.waitForURL(/q=/);
    expect(new URL(page.url()).searchParams.get('q')).toBe('প্রকৌশলী');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto(`${origin}/jobs?lang=en&deadlineFrom=2026-12-31&deadlineTo=2026-01-01`);
    await page.getByRole('heading', { name: 'Invalid filters' }).waitFor();
  } finally {
    await context.close();
  }
});
it('R17/R19 drafts stay hidden; approved details preserve unknowns, scoped evidence and exact application URL', async () => {
  const item = await c.makeDocument({ memoValue: 'SYNTHETIC-M7' }),
    run = await c.beginRun();
  const draft = await c.revisions.stage('operator', {
    sourceId: c.source.config.id,
    runId: run.runId,
    bundle: item.bundle,
    inventory: item.inventory,
  });
  await c.execution.complete(run.claim, { syntheticFixturePrepared: true });
  if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
  revision = draft.revisionId;
  expect((await c.app.inject('/v1/jobs')).json().items).toHaveLength(0);
  await c.publication.approve(
    'reviewer',
    revision,
    1,
    await c.attestation(item),
    'SYNTHETIC M7 independent review',
  );
  const jobs = (await c.app.inject('/v1/jobs')).json().items;
  id = jobs.find((j: { title: { raw: string } }) => j.title.raw === 'Software Engineer').id;
  baseline = (await c.app.inject(`/v1/jobs/${id}`)).json();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/jobs?lang=en&q=Software`);
    await page.getByRole('link', { name: 'Software Engineer', exact: true }).click();
    await page.getByRole('heading', { name: 'Software Engineer', exact: true }).waitFor();
    await page
      .getByText(/Not stated in notice|Not extracted/, { exact: true })
      .first()
      .waitFor();
    const apply = page.getByRole('link', { name: /Apply on official site/ });
    // Status may be unknown (opening is not stated): never invent an open application CTA.
    if (await apply.count())
      expect(await apply.getAttribute('href')).toBe('https://notices.example/apply');
    const applicationFact = baseline.fields.applicationUrl.fact;
    if (applicationFact.status !== 'stated') throw new Error('EXPECTED_APPLICATION_URL');
    expect(await page.locator('#facts').locator('..').textContent()).toContain(
      applicationFact.candidate.raw,
    );
    await page.locator('summary').first().click();
    await page.getByText('Title: Software Engineer', { exact: true }).waitFor();
    await page
      .getByRole('link', { name: /Open original notice/ })
      .first()
      .waitFor();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.locator('script[type="application/ld+json"]').count()).toBe(0);
    expect(await page.locator('meta[name="robots"]').getAttribute('content')).toContain('noindex');
  } finally {
    await context.close();
  }
});
it('R11/R19 explicit SYNTHETIC HTTP display fixtures cover open/closed/stale/conflicting and cancellation states', async () => {
  const fixture = structuredClone(baseline);
  const title = fixture.fields.title.fact;
  if (title.status !== 'stated') throw new Error('EXPECTED_STATED_TITLE');
  fixture.fields.salary.fact = {
    status: 'conflicting',
    candidates: [
      { ...title.candidate, raw: 'SYNTHETIC salary A', normalized: 'SYNTHETIC salary A' },
      { ...title.candidate, raw: 'SYNTHETIC salary B', normalized: 'SYNTHETIC salary B' },
    ],
  };
  fixture.job.status = 'open';
  fixture.job.stale = false;
  let unavailable = false;
  const upstream = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/v1/authorities')
      res.end(JSON.stringify({ items: [fixture.job.authority] }));
    else if (url.pathname === '/v1/jobs')
      res.end(
        JSON.stringify({
          items: [fixture.job],
          nextCursor: url.searchParams.has('cursor') ? null : 'SYNTHETIC-next-page',
          asOf: fixture.job.lastVerified,
        }),
      );
    else if (req.url?.endsWith('/events'))
      res.end(
        JSON.stringify({
          positionId: id,
          status: 'cancelled',
          events: [
            {
              id,
              kind: 'cancellation',
              recordedAt: fixture.job.lastVerified,
              source: fixture.documents[0],
              page: 1,
              quote: 'SYNTHETIC cancellation event',
            },
          ],
        }),
      );
    else if (unavailable) {
      res.statusCode = 404;
      res.end(
        JSON.stringify({
          error: { code: 'NOT_FOUND', message: 'Unavailable', requestId: 'synthetic' },
        }),
      );
    } else res.end(JSON.stringify(fixture));
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const addr = upstream.address();
  if (!addr || typeof addr === 'string') throw new Error('EXPECTED_PORT');
  const api = process.env.PORTAL_API_ORIGIN;
  process.env.PORTAL_API_ORIGIN = `http://127.0.0.1:${addr.port}`;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${origin}/jobs?lang=en&q=Software&status=open`);
    await page.getByRole('link', { name: 'Next page', exact: true }).click();
    await page.waitForURL(/cursor=/);
    expect(new URL(page.url()).searchParams.get('q')).toBe('Software');
    expect(new URL(page.url()).searchParams.get('status')).toBe('open');
    await page.getByRole('button', { name: 'Search jobs', exact: true }).click();
    await page.waitForURL((url) => !url.searchParams.has('cursor'));
    expect(new URL(page.url()).searchParams.get('q')).toBe('Software');
    await page.goto(`${origin}/jobs/${id}?lang=en`);
    expect(
      await page.getByRole('link', { name: /Apply on official site/ }).getAttribute('href'),
    ).toBe('https://notices.example/apply');
    await page.getByText('Conflicting information', { exact: true }).waitFor();
    const salary = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'Salary', exact: true }) });
    await salary.locator('summary').first().click();
    await salary.getByText('SYNTHETIC salary A', { exact: true }).first().waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await mkdir('data', { recursive: true });
    await page.screenshot({ path: 'data/m7-portal-mobile.png', fullPage: true });
    fixture.job.status = 'closed';
    await page.reload();
    expect(await page.getByRole('link', { name: /Apply on official site/ }).count()).toBe(0);
    fixture.job.status = 'unknown';
    fixture.job.stale = true;
    await page.reload();
    await page
      .getByText('Verification is stale; check the original notice.', { exact: true })
      .waitFor();
    unavailable = true;
    await page.reload();
    await page.getByText('SYNTHETIC cancellation event', { exact: true }).waitFor();
    expect(await page.getByText('BSc CSE', { exact: true }).count()).toBe(0);
    expect(await page.getByRole('link', { name: /Apply on official site/ }).count()).toBe(0);
  } finally {
    process.env.PORTAL_API_ORIGIN = api;
    await page.close();
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
it('R17/R28 revocation removes published facts from freshly requested detail and discovery', async () => {
  const approver = await c.session('approver-sub');
  const state = (
    await c.app.inject({
      url: `/v1/admin/sources/${c.source.config.id}`,
      headers: { cookie: approver.cookie },
    })
  ).json();
  expect(
    (
      await c.post(approver, `/v1/admin/sources/${c.source.config.id}/controls`, {
        expectedEpoch: state.control_epoch,
        collectionHalted: true,
        displayHalted: true,
        reason: 'SYNTHETIC M7 display revocation',
      })
    ).statusCode,
  ).toBe(200);
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/jobs/${id}?lang=en`);
    await page.getByRole('heading', { name: 'Job unavailable', exact: true }).waitFor();
    expect(await page.getByText('BSc CSE', { exact: true }).count()).toBe(0);
    expect(await page.getByRole('link', { name: /Open original notice/ }).count()).toBe(0);
    await page.goto(`${origin}/jobs?lang=en`);
    await page.getByRole('heading', { name: 'No matching jobs' }).waitFor();
    expect(await page.getByRole('link', { name: 'Software Engineer', exact: true }).count()).toBe(
      0,
    );
  } finally {
    await page.close();
  }
});
it('R19 API outage is a visible retry state, never an invented empty result', async () => {
  const api = process.env.PORTAL_API_ORIGIN;
  process.env.PORTAL_API_ORIGIN = 'http://127.0.0.1:1';
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/jobs?lang=en`);
    await page.getByRole('heading', { name: 'Jobs unavailable' }).waitFor();
  } finally {
    process.env.PORTAL_API_ORIGIN = api;
    await page.close();
  }
});
