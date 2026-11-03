// SYNTHETIC ONLY. Maintainer utility, not run in CI or against official sources.
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const require = createRequire(new URL('../apps/agent/package.json', import.meta.url));
const { chromium } = require('playwright');
const folder = new URL('../tests/fixtures/documents/', import.meta.url);
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ chromiumSandbox: true });
try {
  const page = await browser.newPage();
  const style =
    '<style>body{font:22px "Nirmala UI","Noto Sans Bengali",Arial; padding:20px} table{border-collapse:collapse}td,th{border:1px solid black;padding:10px}</style>';
  const text =
    '<h1>SYNTHETIC TEST — NOT A JOB NOTICE</h1><p>নিয়োগ পরীক্ষার নমুনা — তথ্য প্রযুক্তি</p><p>Title: Software Engineer</p><p>Vacancies: ১২</p><p>Application deadline: ১৫/১২/২০২৬</p><p>Payment deadline: ১৬/১২/২০২৬ ১৭:০০ BDT</p><p>Fee: BDT ১০০ [general]</p>';
  await page.setContent(style + text);
  await page.pdf({
    path: new URL('mixed-text.pdf', folder).pathname.replace(/^\/(\w:)/, '$1'),
    format: 'A4',
  });
  await page.setContent(
    style +
      '<h1>SYNTHETIC TABLE TEST</h1><table><tr><th>Post</th><th>Vacancies</th><th>Requirement</th></tr><tr><td>Engineer</td><td>১২</td><td>কম্পিউটার বিজ্ঞান</td></tr><tr><td>Analyst</td><td>৩</td><td>Statistics</td></tr></table><p>Footnote: General fee BDT 100; reserved BDT 50.</p>',
  );
  await page.pdf({
    path: new URL('table.pdf', folder).pathname.replace(/^\/(\w:)/, '$1'),
    format: 'A4',
  });
  await page.setContent(
    style +
      '<h1>SYNTHETIC MULTICOLUMN</h1><div style="display:flex;gap:40px"><section><p>Engineer</p><p>Computer science</p></section><section><p>Analyst</p><p>Statistics only</p></section></div>',
  );
  await page.pdf({
    path: new URL('columns.pdf', folder).pathname.replace(/^\/(\w:)/, '$1'),
    format: 'A4',
  });
  const pdf = new URL('mixed-text.pdf', folder).pathname.replace(/^\/(\w:)/, '$1');
  const rendered = spawnSync('pdftoppm', ['-singlefile', '-scale-to', '2400', '-png', pdf], {
    maxBuffer: 16000000,
    windowsHide: true,
  });
  if (rendered.status !== 0) throw new Error('Fixture render failed');
  const image = `<img style="width:100%;height:100%;object-fit:contain" src="data:image/png;base64,${rendered.stdout.toString('base64')}">`;
  await page.setContent(`<style>@page{margin:0}body{margin:0}</style>${image}`);
  await page.pdf({
    path: new URL('scanned.pdf', folder).pathname.replace(/^\/(\w:)/, '$1'),
    format: 'A4',
  });
  await page.setContent(`${style + text}<div style="break-before:page"></div>${image}`);
  await page.pdf({
    path: new URL('mixed-pages.pdf', folder).pathname.replace(/^\/(\w:)/, '$1'),
    format: 'A4',
  });
  await writeFile(
    new URL('malformed.pdf', folder),
    '%PDF-1.7\nSYNTHETIC malformed document\n%%EOF',
  );
  const files = [
    'mixed-text.pdf',
    'table.pdf',
    'columns.pdf',
    'scanned.pdf',
    'mixed-pages.pdf',
    'malformed.pdf',
  ];
  const inventory = [];
  for (const file of files) {
    const bytes = await readFile(new URL(file, folder));
    inventory.push({
      file,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      size: bytes.length,
    });
  }
  await writeFile(
    new URL('manifest.json', folder),
    `${JSON.stringify(
      {
        synthetic: true,
        generatedBy: 'generate-document-fixtures.mjs',
        ownership: 'Project-created synthetic text; no real notices or personal data.',
        files: inventory,
      },
      null,
      2,
    )}\n`,
  );
  console.log('Six synthetic document fixtures generated with checksummed inventory.');
} finally {
  await browser.close();
}
