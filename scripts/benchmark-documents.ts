import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { extractPdf } from '../apps/agent/src/documents/native.js';
import { sha256, validateText } from '../apps/agent/src/documents/archive.js';
const manifest = JSON.parse(await readFile('tests/fixtures/documents/manifest.json', 'utf8')) as {
  synthetic: boolean;
  files: Array<{ file: string; sha256: string }>;
};
if (!manifest.synthetic) throw new Error('SYNTHETIC_FIXTURES_ONLY');
const rows = [];
for (const entry of manifest.files) {
  for (const mode of entry.file === 'malformed.pdf' ? ['hybrid'] : ['hybrid', 'ocr-only']) {
    const bytes = await readFile(`tests/fixtures/documents/${entry.file}`);
    if (sha256(bytes) !== entry.sha256) throw new Error('FIXTURE_HASH_MISMATCH');
    const started = performance.now();
    try {
      const text = validateText(
        await extractPdf(
          bytes,
          { sourceId: 'synthetic-benchmark', configFingerprint: 'b'.repeat(64) },
          { forceOcr: mode === 'ocr-only' },
        ),
      );
      rows.push({
        file: entry.file,
        mode,
        sha256: entry.sha256,
        milliseconds: Math.round(performance.now() - started),
        engine: text.engine,
        pages: text.pages.map((p) => ({
          page: p.page,
          method: p.method,
          characters: p.text.length,
          bengaliCharacters: (p.text.match(/[\u0980-\u09FF]/g) ?? []).length,
          words: p.words.length,
          flags: p.flags,
          hasEngineer: p.text.includes('Engineer'),
          hasDate: p.text.includes('১৫/১২/২০২৬') || p.text.includes('15/12/2026'),
        })),
        outcome: 'extracted_needs_review',
      });
    } catch (error) {
      rows.push({
        file: entry.file,
        mode,
        sha256: entry.sha256,
        milliseconds: Math.round(performance.now() - started),
        outcome: 'rejected',
        reason: error instanceof Error ? error.message : 'failed',
      });
    }
  }
}
const output = process.argv[2] ?? 'data/m3-benchmark.json';
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify(
    { synthetic: true, platform: process.platform, node: process.version, rows },
    null,
    2,
  )}\n`,
);
console.log(
  JSON.stringify(
    rows.map((r) => ({ file: r.file, outcome: r.outcome, milliseconds: r.milliseconds })),
    null,
    2,
  ),
);
