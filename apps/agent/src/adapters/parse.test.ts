import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { syntheticSource } from '../../../../tests/helpers/source.js';
import { SourceConfigSchema, AdapterSchema } from '@uttirno/source-config';
import { parsePage } from './parse.js';
import { validateProposal, proposeHtml } from '../onboarding/propose.js';
it('R03/R05 configured attachment attributes support mixed links and retain quarantine', () => {
  const c = syntheticSource().config;
  const adapter = AdapterSchema.parse({
    kind: 'html',
    items: '.job',
    title: 'h2',
    attachments: 'a',
    attachmentAttributes: ['pdf-link', 'href'],
  });
  const result = parsePage(
    c,
    'https://notices.example/list',
    '<article class="job"><h2>SYNTHETIC</h2><a pdf-link="/a.pdf">PDF</a><a href="/b.pdf">TOR</a><a pdf-link="http://127.0.0.1/private" href="/ignored.pdf">Unapproved primary</a></article>',
    adapter,
  );
  expect(result.items[0]?.attachments).toEqual([
    'https://notices.example/a.pdf',
    'https://notices.example/b.pdf',
  ]);
  expect(result.quarantined).toHaveLength(1);
});
it('R05 additional real BCC and Bangladesh Bank attachment fixtures match exact documented inventories', async () => {
  for (const name of ['bcc-recruitment', 'bangladesh-bank-notices']) {
    const config = SourceConfigSchema.parse(
      JSON.parse(await readFile(`config/sources/${name}.public-local.json`, 'utf8')).config,
    );
    const metadata = JSON.parse(
      await readFile(`tests/fixtures/real/${name}.metadata.json`, 'utf8'),
    );
    const parsed = parsePage(
      config,
      metadata.sourceUrl,
      await readFile(metadata.fixturePath, 'utf8'),
    );
    expect(parsed.items.flatMap((i) => i.attachments)).toEqual(metadata.expectedAttachments);
    expect(parsed.errors).toEqual([]);
    expect(parsed.quarantined).toEqual([]);
  }
  const config = SourceConfigSchema.parse(
    JSON.parse(await readFile('config/sources/buet-recruitment.public-local.json', 'utf8')).config,
  );
  const meta = JSON.parse(
    await readFile('tests/fixtures/real/buet-recruitment.metadata.json', 'utf8'),
  );
  const fragments = (await readFile(meta.fixturePath, 'utf8')).trim().split(/\r?\n/);
  const attachments = fragments.flatMap((html, index) =>
    parsePage(config, meta.sourceUrls[index], html).items.flatMap((i) => i.attachments),
  );
  expect(attachments).toEqual(meta.expectedAttachments);
});
it('R05 bounded embedded base64 HTML is inert data and preserves URL gates', () => {
  const config = syntheticSource().config;
  const seed = 'https://notices.example/list';
  const adapter = AdapterSchema.parse({
    kind: 'html',
    embeddedHtml: { selector: 'notice-data', attribute: 'payload', encoding: 'base64' },
    items: 'a.pdf',
    title: '$self',
    attachments: '$self',
  });
  const encoded = Buffer.from(
    '<script>throw 1</script><a class="pdf" href="/a.pdf">SYNTHETIC notice</a><a class="pdf" href="http://127.0.0.1/secret.pdf">Unapproved</a>',
  ).toString('base64');
  const html = `<notice-data payload="${encoded}"></notice-data>`;
  const result = parsePage(config, seed, html, adapter);
  expect(result.items[0]?.attachments).toEqual(['https://notices.example/a.pdf']);
  expect(result.quarantined).toHaveLength(1);
  expect(() => parsePage(config, seed, html + html, adapter)).toThrow('EMBEDDED_HTML_CARDINALITY');
  expect(() =>
    parsePage(config, seed, '<notice-data payload="invalid!"></notice-data>', adapter),
  ).toThrow('INVALID_EMBEDDED_HTML');
});
it('R05 current real encoded notice fragment reproduces its three documented links offline', async () => {
  const config = SourceConfigSchema.parse(
    JSON.parse(await readFile('config/sources/bpsc-authority.public-local.json', 'utf8')).config,
  );
  const html = await readFile('tests/fixtures/real/bpsc-authority.encoded.fragment.html', 'utf8');
  const seed = config.seeds[0];
  if (!seed) throw new Error('EXPECTED_REAL_FIXTURE_SEED');
  const result = parsePage(config, seed, html);
  const metadata = JSON.parse(
    await readFile('tests/fixtures/real/bpsc-authority.metadata.json', 'utf8'),
  );
  expect(result.items.flatMap((i) => i.attachments)).toEqual(metadata.observedLinks);
  expect(result.errors).toEqual([]);
  expect(result.quarantined).toEqual([]);
});
it('R05/R27 two layouts and new titles need only configuration', async () => {
  const root = new URL('../../../../tests/fixtures/synthetic/', import.meta.url);
  const card = AdapterSchema.parse({
    kind: 'html',
    items: '.job',
    title: 'h2',
    detailLink: 'a.more',
    fields: [{ name: 'deadline', selector: '.date', transforms: ['bangla_digits'] }],
  });
  const table = AdapterSchema.parse({
    kind: 'html',
    items: 'table.notices tbody tr',
    title: '.title',
    detailLink: 'a.more',
    next: 'a[rel=next]',
    fields: [{ name: 'deadline', selector: '.deadline', transforms: ['bangla_digits'] }],
  });
  const config = syntheticSource().config;
  for (const [name, adapter] of [
    ['cards', card],
    ['table', table],
  ] as const) {
    const parsed = parsePage(
      config,
      'https://notices.example/list',
      await readFile(new URL(`${name}.html`, root), 'utf8'),
      adapter,
    );
    expect(parsed.items[0]?.title).toBe('অজানা নতুন পদ');
    expect(parsed.items[0]?.fields.deadline?.normalized).toBe('30 নভেম্বর 2026');
    expect(parsed.items[0]?.detailUrl).toBe('https://notices.example/detail/a');
    expect(parsed.errors).toEqual([]);
  }
});
it('field extraction stays inside its selected position', () => {
  const config = syntheticSource().config;
  const adapter = AdapterSchema.parse({
    kind: 'html',
    items: '.job',
    title: 'h2',
    fields: [{ name: 'education', selector: '.edu', required: true }],
  });
  const parsed = parsePage(
    config,
    'https://notices.example/list',
    '<article class="job"><h2>A</h2><p class="edu">CSE</p></article><article class="job"><h2>B</h2><p class="edu">HSC</p></article>',
    adapter,
  );
  expect(parsed.items.map((i) => i.fields.education?.original)).toEqual(['CSE', 'HSC']);
});
it('invented selectors and multiple title matches fail visible validation', () => {
  const config = syntheticSource().config;
  expect(() =>
    validateProposal(config, 'https://notices.example/list', '<p>Nothing</p>', {
      kind: 'html',
      items: '.invented',
      title: 'h2',
    }),
  ).toThrow();
  const page = parsePage(
    config,
    'https://notices.example/list',
    '<article class="job"><h2>A</h2><h2>B</h2></article>',
  );
  expect(page.errors).toContain('TITLE_CARDINALITY:0');
});
it('unapproved links are quarantined without leaking credentials', () => {
  const result = parsePage(
    syntheticSource().config,
    'https://notices.example/list',
    '<article class="job"><h2>A</h2><a class="more" href="https://user:secret@other.example/">Go</a></article>',
  );
  expect(result.quarantined).toHaveLength(1);
  expect(JSON.stringify(result)).not.toContain('secret');
});
it('public JSON uses data pointers, no eval or prototype traversal', () => {
  const config = syntheticSource().config;
  const adapter = AdapterSchema.parse({
    kind: 'json',
    items: '/items',
    title: '/title',
    detailLink: '/url',
    next: '/next',
  });
  const result = parsePage(
    config,
    'https://notices.example/list',
    JSON.stringify({ items: [{ title: 'New title', url: '/detail/a' }], next: '/list?page=2' }),
    adapter,
  );
  expect(result.items[0]?.title).toBe('New title');
  expect(result.nextUrl).toBe('https://notices.example/list?page=2');
  expect(() => parsePage(config, 'https://notices.example/list', '{}', adapter)).toThrow(
    'JSON_ITEMS_NOT_ARRAY',
  );
});
it.each(['bpsc-noncadre', 'bpsc-authority'])(
  'R05 real observed %s fragment matches its draft config',
  async (name) => {
    const fixtureRoot = new URL('../../../../tests/fixtures/real/', import.meta.url);
    const draft = JSON.parse(
      await readFile(
        new URL(`../../../../config/sources/${name}.draft.json`, import.meta.url),
        'utf8',
      ),
    ) as { config: unknown };
    const config = SourceConfigSchema.parse(draft.config);
    const html = await readFile(new URL(`${name}.fragment.html`, fixtureRoot), 'utf8');
    const metadata = JSON.parse(
      await readFile(new URL(`${name}.metadata.json`, fixtureRoot), 'utf8'),
    ) as { expectedItems: number };
    const seed = config.seeds[0];
    if (!seed) throw new Error('Fixture missing seed');
    const result = parsePage(config, seed, html);
    expect(result.items).toHaveLength(metadata.expectedItems);
    expect(result.errors).toEqual([]);
    expect(config.state).toBe('candidate');
    if (name === 'bpsc-authority') {
      expect(result.quarantined).toHaveLength(3);
      expect(result.items.flatMap((i) => i.attachments)).toHaveLength(0);
    } else {
      expect(result.items.flatMap((i) => i.attachments)).toHaveLength(2);
      expect(proposeHtml(config, seed, html).status).toBe('needs_review');
    }
  },
);
