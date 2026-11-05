import { beforeAll, afterAll, it, expect } from 'vitest';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { adminFixture } from './setup.js';
let c: Awaited<ReturnType<typeof adminFixture>>;
let good: Awaited<ReturnType<typeof c.stage>>, bad: Awaited<ReturnType<typeof c.stage>>;
beforeAll(async () => {
  c = await adminFixture();
  bad = await c.stage('SYNTHETIC-BAD', true);
  good = await c.stage('SYNTHETIC-GOOD');
});
afterAll(async () => {
  await c?.close();
});

it('R18/R26 real browser OIDC login, role-gated access, mobile keyboard/theme and logout', async () => {
  const context = await c.browser.newContext({ viewport: { width: 390, height: 844 } }),
    page = await context.newPage();
  try {
    await page.goto(c.origin);
    await page.getByRole('link', { name: 'Continue with SSO' }).waitFor();
    const loginAudit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(loginAudit.violations).toEqual([]);
    await c.login(page, 'operator-sub');
    await page.goto(`${c.origin}/reviews`);
    await page.getByText('Independent revision review requires a reviewer role.').waitFor();
    await page.goto(`${c.origin}/audit`);
    await page.getByText('Audit access requires administrator permission.').waitFor();
    expect(await page.getByRole('link', { name: 'Audit', exact: true }).count()).toBe(0);
    await page.getByRole('button', { name: 'Dark theme' }).click();
    expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');
    await page.keyboard.press('Control+Home');
    await page.reload();
    await page.getByRole('button', { name: 'Sign out' }).waitFor();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Skip to content');
    await page.keyboard.press('Enter');
    expect(
      await page.locator('#content').evaluate((element) => element === document.activeElement),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
    expect(
      (
        await page.request.post(`${c.origin}/v1/admin/auth/logout`, {
          headers: { origin: 'https://evil.example' },
          data: {},
        })
      ).status(),
    ).toBe(403);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('heading', { name: 'Staff sign in' }).waitFor();
    expect((await page.request.get(`${c.origin}/v1/admin/session`)).status()).toBe(401);
  } finally {
    await context.close();
  }
});

it('R02/R06 real observed BPSC sample previews offline; unsupported unsigned source cannot enable', async () => {
  const context = await c.browser.newContext(),
    page = await context.newPage();
  try {
    await c.login(page, 'approver-sub');
    await page.goto(`${c.origin}/sources/onboard`);
    const bundle = JSON.parse(await readFile('config/sources/bpsc-noncadre.draft.json', 'utf8'));
    await page.getByLabel('Source bundle JSON').fill(JSON.stringify(bundle));
    await page.getByLabel('Original sample URL').fill(bundle.config.seeds[0]);
    await page.getByLabel('Expected candidate count').fill('2');
    await page
      .getByLabel('HTML or JSON sample')
      .fill(await readFile('tests/fixtures/real/bpsc-noncadre.fragment.html', 'utf8'));
    await page.getByRole('button', { name: 'Preview sample' }).click();
    await page.getByText('Expected inventory matched', { exact: false }).waitFor();
    const candidate = {
      config: {
        ...c.source.config,
        id: 'synthetic-pending',
        state: 'candidate',
        collection: 'unknown',
        display: 'unknown',
      },
    };
    const session = await c.session('approver-sub');
    expect(
      (
        await c.post(session, '/v1/admin/sources', {
          authorityId: 'synthetic-authority',
          bundle: candidate,
        })
      ).statusCode,
    ).toBe(200);
    await page.goto(`${c.origin}/sources/synthetic-pending`);
    await page.getByLabel('Pause collection').waitFor();
    await page.getByLabel('Pause collection').uncheck();
    await page.getByLabel('I reviewed the current policy', { exact: false }).check();
    expect(await page.getByRole('button', { name: 'Apply source controls' }).isDisabled()).toBe(
      true,
    );
    const response = await c.post(session, '/v1/admin/sources/synthetic-pending/controls', {
      expectedEpoch: 1,
      collectionHalted: false,
      displayHalted: true,
      reason: 'SYNTHETIC denied bypass',
    });
    expect(response.statusCode).toBe(422);
  } finally {
    await context.close();
  }
});

it('R13/R17 reviewer sees original evidence, rejects wrong sibling values and publishes a correct revision', async () => {
  const context = await c.browser.newContext(),
    page = await context.newPage();
  try {
    await c.login(page, 'reviewer-sub');
    await page.goto(`${c.origin}/reviews/${bad.draft.revisionId}`);
    await page.getByText('SYNTHETIC wrong sibling qualification', { exact: true }).waitFor();
    const originalRegion = page.getByRole('region', { name: 'Retained original text' });
    await originalRegion.getByText('Qualifications: BSc CSE', { exact: false }).waitFor();
    expect(await originalRegion.textContent()).not.toContain('SYNTHETIC wrong sibling qualification');
    await page
      .getByLabel('Decision reason', { exact: true })
      .first()
      .fill('SYNTHETIC qualification differs from original scope');
    await page.getByRole('button', { name: 'Reject revision', exact: true }).click();
    await page.getByText('Revision rejected. No candidate facts were published.').waitFor();
    expect((await c.app.inject('/v1/jobs')).json().items).toHaveLength(0);
    await page.goto(`${c.origin}/reviews/${good.draft.revisionId}`);
    await page.getByRole('button', { name: 'Approve revision', exact: true }).waitFor();
    expect(
      await page.getByRole('button', { name: 'Approve revision', exact: true }).isDisabled(),
    ).toBe(true);
    const evidenceButton = page.getByRole('button', { name: /Page 1, engineer:/ }).first();
    await evidenceButton.click();
    await page.getByText('Exact quote at recorded page offsets', { exact: false }).waitFor();
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download retained original' }).click();
    expect((await download).suggestedFilename()).toContain(good.doc.artifactSha256);
    await page.getByLabel('I compared all original pages', { exact: false }).check();
    await page.getByLabel('I checked every field', { exact: false }).check();
    await page
      .getByLabel('Decision reason', { exact: true })
      .first()
      .fill('SYNTHETIC original pages and all scoped fields verified');
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
    await mkdir('data', { recursive: true });
    await page.screenshot({ path: 'data/m6-admin-review.png', fullPage: true });
    await page.getByRole('button', { name: 'Approve revision', exact: true }).click();
    await page
      .getByText(
        'Revision approved. Public queries still enforce current permissions. Reload to inspect published positions.',
      )
      .waitFor();
    expect((await c.app.inject('/v1/jobs')).json().items).toHaveLength(2);
    await page.getByRole('button', { name: 'Reload revision' }).click();
    await page.getByText(/Generation 1 · approved/).waitFor();
    expect(
      await page.getByRole('button', { name: 'Approve revision', exact: true }).isDisabled(),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

it('R16/R17 critical cancellation suppresses facts until independent browser event review', async () => {
  const context = await c.browser.newContext(),
    page = await context.newPage();
  try {
    const notice = await c.makeDocument({
      memoValue: 'SYNTHETIC-GOOD',
      note: 'Cancellation: SYN-ENG',
    });
    const target = (
      await c.database.pool.query(
        "SELECT p.id FROM positions p JOIN circulars c ON c.id=p.circular_id WHERE c.memo='SYNTHETIC-GOOD' AND p.post_key='SYN-ENG'",
      )
    ).rows[0]?.id;
    const start = notice.doc.pages[0]?.text.indexOf('Cancellation: SYN-ENG') ?? -1;
    if (!target || start < 0) throw new Error('EXPECTED_EVENT_EVIDENCE');
    const id = await c.events.record('operator', {
      circularId: (
        await c.database.pool.query('SELECT circular_id FROM circular_revisions WHERE id=$1', [
          good.draft.revisionId,
        ])
      ).rows[0].circular_id,
      kind: 'cancellation',
      targets: [target],
      textVersion: notice.doc.textVersion,
      evidence: {
        sourceId: notice.doc.sourceId,
        artifactSha256: notice.doc.artifactSha256,
        textVersion: notice.doc.textVersion,
        scopeId: 'engineer',
        page: 1,
        start,
        end: start + 'Cancellation: SYN-ENG'.length,
        quote: 'Cancellation: SYN-ENG',
      },
      reason: 'SYNTHETIC critical event',
    });
    expect((await c.app.inject(`/v1/jobs/${target}`)).statusCode).toBe(404);
    await c.login(page, 'reviewer-sub');
    await page.goto(`${c.origin}/events/${id}`);
    await page.getByRole('button', { name: 'Approve event' }).waitFor();
    await page.getByLabel('I compared original pages, scoped evidence', { exact: false }).check();
    await page
      .getByLabel('Decision reason', { exact: true })
      .first()
      .fill('SYNTHETIC original cancellation verified');
    await page.getByRole('button', { name: 'Approve event' }).click();
    await page.getByText('Event decision recorded.', { exact: false }).waitFor();
    expect((await c.app.inject(`/v1/jobs/${target}/events`)).json().status).toBe('cancelled');
    expect((await c.app.inject(`/v1/jobs/${target}`)).statusCode).toBe(404);
  } finally {
    await context.close();
  }
});

it('R15/R17 duplicate identity review creates an unpublished draft and stale browser approval is rejected', async () => {
  const context = await c.browser.newContext(),
    page = await context.newPage();
  try {
    const item = await c.makeDocument({ memo: false }),
      run = await c.beginRun();
    const candidate = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle: item.bundle,
      inventory: item.inventory,
    });
    await c.execution.complete(run.claim, { syntheticFixturePrepared: true });
    if (candidate.state !== 'needs_identity_review') throw new Error('EXPECTED_IDENTITY_REVIEW');
    await c.login(page, 'reviewer-sub');
    await page.goto(`${c.origin}/duplicates/${candidate.candidateId}`);
    await page.getByLabel('Verified authority memo').fill('SYNTHETIC-MANUAL');
    await page
      .getByLabel('Scope ID to verified original post code mapping (JSON)')
      .fill(JSON.stringify({ engineer: 'SYN-ENG', analyst: 'SYN-ANA' }));
    await page.getByLabel('I compared original pages, scoped evidence', { exact: false }).check();
    await page
      .getByLabel('Decision reason', { exact: true })
      .fill('SYNTHETIC original memo identity decision');
    await page.getByRole('button', { name: 'Resolve into draft' }).click();
    await page.getByText('Identity resolved into a new draft.', { exact: false }).waitFor();
    const revisions = (
      await c.database.pool.query(
        "SELECT r.id FROM circular_revisions r JOIN circulars c ON c.id=r.circular_id WHERE c.memo='SYNTHETIC-MANUAL'",
      )
    ).rows;
    expect(revisions).toHaveLength(1);
    const current = await c.stage('SYNTHETIC-STALE');
    await page.goto(`${c.origin}/reviews/${current.draft.revisionId}`);
    await page.getByRole('button', { name: 'Approve revision', exact: true }).waitFor();
    await page.getByLabel('I compared all original pages', { exact: false }).check();
    await page.getByLabel('I checked every field', { exact: false }).check();
    await page
      .getByLabel('Decision reason', { exact: true })
      .first()
      .fill('SYNTHETIC stale tab cannot overwrite newer draft');
    const changed = await c.makeDocument({ memoValue: 'SYNTHETIC-STALE', deadline: '17/12/2026' }),
      run2 = await c.beginRun();
    await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: run2.runId,
      bundle: changed.bundle,
      inventory: changed.inventory,
    });
    await c.execution.complete(run2.claim, { syntheticFixturePrepared: true });
    await page.getByRole('button', { name: 'Approve revision', exact: true }).click();
    await page
      .getByText('This record changed or was already reviewed.', { exact: false })
      .waitFor();
    expect(
      (
        await c.database.pool.query(
          "SELECT count(*) FROM review_actions WHERE circular_revision_id=$1 AND action='approved'",
          [current.draft.revisionId],
        )
      ).rows[0].count,
    ).toBe('0');
  } finally {
    await context.close();
  }
});

it('R16/R17 browser replacement review resolves a scoped critical amendment without publishing stale facts', async () => {
  const context = await c.browser.newContext(),
    page = await context.newPage();
  try {
    const first = await c.stage('SYNTHETIC-AMENDMENT');
    await c.publication.approve(
      'reviewer',
      first.draft.revisionId,
      1,
      await c.attestation(first),
      'SYNTHETIC baseline review',
    );
    const circularId = (
      await c.database.pool.query('SELECT circular_id FROM circular_revisions WHERE id=$1', [
        first.draft.revisionId,
      ])
    ).rows[0].circular_id;
    const target = (
      await c.database.pool.query(
        "SELECT id FROM positions WHERE circular_id=$1 AND post_key='SYN-ENG'",
        [circularId],
      )
    ).rows[0].id;
    const item = await c.makeDocument({
        memoValue: 'SYNTHETIC-AMENDMENT',
        note: 'Amendment: SYN-ENG',
        deadline: '17/12/2026',
      }),
      text = item.doc.pages[0]?.text ?? '',
      start = text.indexOf('Amendment: SYN-ENG');
    const eventId = await c.events.record('operator', {
      circularId,
      kind: 'amendment',
      targets: [target],
      textVersion: item.doc.textVersion,
      evidence: {
        sourceId: item.doc.sourceId,
        artifactSha256: item.doc.artifactSha256,
        textVersion: item.doc.textVersion,
        scopeId: 'engineer',
        page: 1,
        start,
        end: start + 'Amendment: SYN-ENG'.length,
        quote: 'Amendment: SYN-ENG',
      },
      reason: 'SYNTHETIC critical deadline correction',
    });
    expect((await c.app.inject(`/v1/jobs/${target}`)).statusCode).toBe(404);
    const run = await c.beginRun(),
      replacement = await c.revisions.stage('operator', {
        sourceId: c.source.config.id,
        runId: run.runId,
        bundle: item.bundle,
        inventory: item.inventory,
      });
    await c.execution.complete(run.claim, { syntheticFixturePrepared: true });
    if (replacement.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    await c.login(page, 'reviewer-sub');
    await page.goto(`${c.origin}/reviews/${replacement.revisionId}`);
    await page.getByRole('button', { name: 'Approve revision', exact: true }).waitFor();
    await page.getByLabel('I compared all original pages', { exact: false }).check();
    await page.getByLabel('I checked every field', { exact: false }).check();
    await page.getByLabel('This replacement resolves event amendment', { exact: false }).check();
    await page
      .getByLabel('Decision reason', { exact: true })
      .first()
      .fill('SYNTHETIC original amendment and all replacement positions reviewed');
    await page.getByRole('button', { name: 'Approve revision', exact: true }).click();
    await page.getByText('Revision approved.', { exact: false }).waitFor();
    expect((await c.app.inject(`/v1/jobs/${target}`)).statusCode).toBe(200);
    expect(
      (
        await c.database.pool.query(
          'SELECT state,resolved_revision FROM recruitment_events WHERE id=$1',
          [eventId],
        )
      ).rows[0],
    ).toMatchObject({ state: 'approved', resolved_revision: replacement.revisionId });
  } finally {
    await context.close();
  }
});

it('R18/R22/R24 browser shows drift failure, enforces pause, resumes approved policy and records rerun/audit', async () => {
  const context = await c.browser.newContext(),
    page = await context.newPage();
  try {
    const run = await c.beginRun();
    await c.execution.fail(run.claim, 'SYNTHETIC_LAYOUT_DRIFT', { permanent: true, drift: true });
    await c.login(page, 'admin-sub');
    await page.goto(`${c.origin}/operations`);
    await page.getByText('SYNTHETIC_LAYOUT_DRIFT', { exact: true }).waitFor();
    const row = page.getByRole('row').filter({ has: page.getByText(run.runId, { exact: true }) });
    await row.getByLabel('Decision reason').fill('SYNTHETIC retry while paused must fail');
    await row.getByRole('button', { name: 'Schedule rerun' }).click();
    await row.getByRole('alert').waitFor();
    await page.goto(`${c.origin}/sources/${c.source.config.id}`);
    await page.getByLabel('Pause collection').uncheck();
    await page.getByLabel('I reviewed the current policy', { exact: false }).check();
    await page
      .getByLabel('Decision reason', { exact: true })
      .first()
      .fill('SYNTHETIC reviewed drift recovery');
    await page.getByRole('button', { name: 'Apply source controls' }).click();
    await page.getByText('Action recorded.', { exact: false }).waitFor();
    await page.goto(`${c.origin}/operations`);
    const updated = page
      .getByRole('row')
      .filter({ has: page.getByText(run.runId, { exact: true }) });
    await updated.getByLabel('Decision reason').fill('SYNTHETIC bounded rerun after review');
    await updated.getByRole('button', { name: 'Schedule rerun' }).click();
    await updated
      .getByText('Rerun scheduled through current source gates.', { exact: false })
      .waitFor();
    expect(
      (await c.database.pool.query("SELECT count(*) FROM audit_events WHERE action='run_rerun'"))
        .rows[0].count,
    ).not.toBe('0');
    await page.goto(`${c.origin}/audit`);
    await page.getByRole('heading', { name: 'Audit', exact: true }).waitFor();
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
  } finally {
    await context.close();
  }
});
