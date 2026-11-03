import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { syntheticSource } from '../../../../tests/helpers/source.js';
import { SourceConfigSchema, AdapterSchema } from '@uttirno/source-config';
import { parsePage } from './parse.js';
import { validateProposal, proposeHtml } from '../onboarding/propose.js';
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
