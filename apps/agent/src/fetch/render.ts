import { chromium } from 'playwright';
import { assertSourceUrl, configFingerprint, SourcePolicyError } from '@uttirno/source-config';
import type { SourceClient, AcquiredPage } from './client.js';
export type RenderedPage = {
  url: string;
  html: string;
  blockedRequests: number;
  original: AcquiredPage;
};
export async function renderPage(
  client: SourceClient,
  url: string,
  readySelector: string,
): Promise<RenderedPage> {
  const config = await client.current();
  url = assertSourceUrl(config, url).href;
  if (!readySelector || readySelector.length > 300)
    throw new SourcePolicyError('INVALID_READY_SELECTOR');
  const browser = await chromium.launch({
    headless: true,
    chromiumSandbox: true,
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--js-flags=--max-old-space-size=128',
    ],
  });
  let blockedRequests = 0;
  let browserRequests = 0;
  let original: AcquiredPage | undefined;
  const deadline = setTimeout(() => {
    void browser.close();
  }, config.limits.timeoutMs * 2);
  try {
    // Browser has no network capability. All HTTP responses are fulfilled through the Node broker.
    const context = await browser.newContext({
      offline: true,
      serviceWorkers: 'block',
      acceptDownloads: false,
      javaScriptEnabled: true,
    });
    await context.routeWebSocket('**/*', (socket) => {
      socket.close();
    });
    await context.route('**/*', async (route) => {
      if (++browserRequests > config.limits.maxRequests) {
        blockedRequests++;
        client.stop();
        await route.abort();
        return;
      }
      if (route.request().method() !== 'GET') {
        blockedRequests++;
        await route.abort();
        return;
      }
      try {
        const page = await client.get(route.request().url());
        const type = page.headers['content-type'] ?? 'application/octet-stream';
        // URL-changing redirects cannot be transparently fulfilled under a different browser origin.
        if (page.url !== route.request().url())
          throw new SourcePolicyError('BROWSER_REDIRECT_REQUIRES_REVIEW');
        if (route.request().url() === url && route.request().isNavigationRequest()) original = page;
        await route.fulfill({ status: 200, headers: { 'content-type': type }, body: page.body });
      } catch {
        blockedRequests++;
        await route.abort();
      }
    });
    const page = await context.newPage();
    context.on('page', (popup) => {
      if (popup !== page) void popup.close();
    });
    page.on('dialog', (dialog) => {
      void dialog.dismiss();
    });
    page.on('download', (download) => {
      void download.cancel();
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.limits.timeoutMs });
    await page.locator(readySelector).first().waitFor({ timeout: config.limits.timeoutMs });
    const fresh = await client.current();
    assertSourceUrl(fresh, page.url());
    if (page.url() !== url || configFingerprint(fresh) !== configFingerprint(config))
      throw new SourcePolicyError('BROWSER_CONTEXT_CHANGED');
    if ((await page.locator('*').count()) > 100000) throw new SourcePolicyError('DOM_LIMIT');
    const html = await page.content();
    if (Buffer.byteLength(html) > config.limits.maxBytes)
      throw new SourcePolicyError('RENDER_OUTPUT_LIMIT');
    if (!original) throw new SourcePolicyError('MISSING_ORIGINAL_RESPONSE');
    return { url: page.url(), html, blockedRequests, original };
  } finally {
    clearTimeout(deadline);
    await browser.close();
  }
}
