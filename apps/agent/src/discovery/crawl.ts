import { SourcePolicyError } from '@uttirno/source-config';
import type { SourceClient, AcquiredPage } from '../fetch/client.js';
import { renderPage } from '../fetch/render.js';
import { parsePage, type Candidate } from '../adapters/parse.js';
export type DiscoveryRun = {
  pages: AcquiredPage[];
  candidates: Candidate[];
  attachments: string[];
  quarantined: string[];
  errors: string[];
  truncated: boolean;
  complete: boolean;
};
export async function discover(client: SourceClient): Promise<DiscoveryRun> {
  const config = await client.current();
  const pending = config.seeds.map((url) => ({ url, detail: false }));
  const seen = new Set<string>();
  const run: DiscoveryRun = {
    pages: [],
    candidates: [],
    attachments: [],
    quarantined: [],
    errors: [],
    truncated: false,
    complete: false,
  };
  while (pending.length) {
    if (seen.size >= config.limits.maxPages) {
      run.truncated = true;
      run.errors.push('PAGE_BUDGET');
      break;
    }
    const item = pending.shift();
    if (!item) break;
    if (seen.has(item.url)) {
      run.errors.push('REPEATED_PAGE');
      continue;
    }
    seen.add(item.url);
    try {
      const rendered = config.render
        ? await renderPage(client, item.url, config.render.readySelector)
        : null;
      const page = rendered?.original ?? (await client.get(item.url));
      if (rendered?.blockedRequests) run.errors.push('BROWSER_REQUESTS_BLOCKED');
      const type = (page.headers['content-type'] ?? '').split(';')[0] ?? '';
      const adapter = item.detail ? config.detailAdapter : config.adapter;
      if (!adapter) throw new SourcePolicyError('MISSING_DETAIL_ADAPTER');
      if (!['text/html', 'application/xhtml+xml', 'application/json'].includes(type))
        throw new SourcePolicyError('NOT_A_LISTING_DOCUMENT');
      const parsed = parsePage(
        config,
        page.url,
        rendered?.html ?? page.body.toString('utf8'),
        adapter,
      );
      run.pages.push(page);
      run.candidates.push(...parsed.items);
      run.errors.push(...parsed.errors);
      run.quarantined.push(...parsed.quarantined);
      for (const candidate of parsed.items) {
        run.attachments.push(...candidate.attachments);
        const follow = [
          ...(candidate.detailUrl && config.detailAdapter ? [candidate.detailUrl] : []),
          ...candidate.siblings,
        ];
        for (const url of follow)
          if (!seen.has(url) && !pending.some((p) => p.url === url))
            pending.push({ url, detail: true });
      }
      if (parsed.nextUrl) {
        if (seen.has(parsed.nextUrl)) run.errors.push('PAGINATION_LOOP');
        else if (!pending.some((p) => p.url === parsed.nextUrl))
          pending.push({ url: parsed.nextUrl, detail: item.detail });
      }
    } catch (error) {
      run.errors.push(error instanceof SourcePolicyError ? error.code : 'DISCOVERY_FAILED');
    }
  }
  run.attachments = [...new Set(run.attachments)];
  run.quarantined = [...new Set(run.quarantined)];
  run.complete =
    !run.truncated && !run.errors.length && !run.quarantined.length && run.pages.length > 0;
  return run;
}
