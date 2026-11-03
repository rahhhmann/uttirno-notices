import { load } from 'cheerio';
import { AdapterSchema, type AdapterConfig, type SourceConfig } from '@uttirno/source-config';
import { parsePage, type ParsedPage } from '../adapters/parse.js';
export type Proposal = {
  status: 'needs_review';
  adapter: AdapterConfig;
  sample: ParsedPage;
  warnings: string[];
};
export function validateProposal(
  config: SourceConfig,
  url: string,
  html: string,
  proposal: unknown,
): Proposal {
  const adapter = AdapterSchema.parse(proposal);
  const sample = parsePage(config, url, html, adapter);
  if (!sample.items.length || sample.errors.length) throw new Error('PROPOSAL_SAMPLE_INVALID');
  return {
    status: 'needs_review',
    adapter,
    sample,
    warnings: [
      'Offline selector matches do not establish ownership, access permission or complete job extraction.',
    ],
  };
}
export function proposeHtml(config: SourceConfig, url: string, html: string): Proposal {
  const $ = load(html);
  // Choose only actual document elements and observed classes; no invented endpoints or selectors.
  const links = $('a[href]')
    .toArray()
    .filter(
      (n) => $(n).text().trim() && $(n).attr('href')?.toLowerCase().split('?')[0]?.endsWith('.pdf'),
    );
  if (!links.length) throw new Error('NO_BOUNDED_DOCUMENT_LINK_PATTERN');
  const classes = links.map((n) =>
    ($(n).attr('class') ?? '').split(/\s+/).filter((c) => /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(c)),
  );
  const shared = classes[0]?.find((c) => classes.every((cs) => cs.includes(c)));
  const selector = shared ? `a.${shared}[href]` : 'a[href$=".pdf"]';
  return validateProposal(config, url, html, {
    kind: 'html',
    items: selector,
    title: '$self',
    attachments: '$self',
    fields: [],
    minItems: 1,
    maxItems: 200,
  });
}
