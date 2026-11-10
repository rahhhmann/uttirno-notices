// biome-ignore-all lint/style/noNonNullAssertion: Synthetic fixture indexes are fixed by the test inventory.
import { expect, it } from 'vitest';
import { extractPdf, parseBbox, parseTsv, type Runner } from './native.js';
import { validateText } from './archive.js';
const xml =
  '<doc><page width="600" height="800"><flow><block><line><word xMin="10" yMin="20" xMax="120" yMax="40">SYNTHETIC document text</word></line></block></flow></page></doc>';
it('R08/R09 text layer retains page, quote offsets and bounding boxes; source lineage sealed', async () => {
  const run: Runner = async (tool, args) =>
    Buffer.from(
      tool === 'pdfinfo'
        ? args[0] === '-v'
          ? 'pdfinfo version SYNTHETIC'
          : 'Pages: 1\nEncrypted: no'
        : tool === 'pdftotext'
          ? xml
          : 'tesseract SYNTHETIC',
    );
  const text = await extractPdf(
    Buffer.from('%PDF-1.7 SYNTHETIC'),
    { sourceId: 'synthetic', configFingerprint: 'b'.repeat(64) },
    { run },
  );
  expect(validateText(text)).toEqual(text);
  expect(text.pages[0]!.words[0]).toEqual({
    start: 0,
    end: 23,
    box: [10, 20, 110, 20],
    confidence: null,
  });
  expect(text.pages[0]!.text).toBe('SYNTHETIC document text');
});
it('R09 TSV preserves OCR confidence/page coordinates and review flags', () => {
  const page = parseTsv(
    'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n1\t1\t0\t0\t0\t0\t0\t0\t600\t800\t-1\t\n5\t1\t1\t1\t1\t1\t10\t20\t30\t20\t70\tনিয়োগ\n',
    3,
  );
  expect(page.page).toBe(3);
  expect(page.flags).toContain('low_confidence');
  expect(page.words[0]!.box).toEqual([10, 20, 30, 20]);
});
it('R09/R13 invalid text-layer bounds trigger OCR instead of weakening provenance checks', async () => {
  const overflowing = xml.replace('yMin="20"', 'yMin="795"').replace('yMax="40"', 'yMax="820"');
  const calls: string[] = [];
  const run: Runner = async (tool, args) => {
    calls.push(tool);
    if (tool === 'pdfinfo')
      return Buffer.from(
        args[0] === '-v' ? 'pdfinfo version SYNTHETIC' : 'Pages: 1\nEncrypted: no',
      );
    if (tool === 'pdftotext') return Buffer.from(overflowing);
    if (tool === 'pdftoppm') return Buffer.from('SYNTHETIC PNG');
    if (args[0] === '--version') return Buffer.from('tesseract SYNTHETIC');
    return Buffer.from(
      'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n1\t1\t0\t0\t0\t0\t0\t0\t600\t800\t-1\t\n5\t1\t1\t1\t1\t1\t10\t20\t30\t20\t95\tSYNTHETIC OCR recovery\n',
    );
  };
  const text = await extractPdf(
    Buffer.from('%PDF-1.7 SYNTHETIC'),
    { sourceId: 'synthetic', configFingerprint: 'b'.repeat(64) },
    { run },
  );
  expect(calls).toContain('pdftoppm');
  expect(text.pages[0]!.method).toBe('ocr');
  expect(text.pages[0]!.flags).toContain('ocr_review');
  expect(validateText(text)).toEqual(text);
});
it('R09 rejects malformed signatures, excess pages, encryption and incomplete page output', async () => {
  const context = { sourceId: 'synthetic', configFingerprint: 'b'.repeat(64) };
  await expect(extractPdf(Buffer.from('malformed'), context)).rejects.toThrow('INVALID_PDF_INPUT');
  for (const info of ['Pages: 21', 'Pages: 1\nEncrypted: yes', 'no pages', 'Pages: 2']) {
    const run: Runner = async (tool) => Buffer.from(tool === 'pdfinfo' ? info : xml);
    await expect(extractPdf(Buffer.from('%PDF-1.7 SYNTHETIC'), context, { run })).rejects.toThrow();
  }
  expect(parseBbox(xml)[0]!.flags).toContain('layout_review');
});
