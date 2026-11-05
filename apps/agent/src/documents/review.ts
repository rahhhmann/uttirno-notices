import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nativeRunner } from './native.js';
export { extractPdf } from './native.js';
let active = 0;
// Reuse the M3 bounded, argv-only Poppler boundary. No remote fetch or active PDF in the browser.
export async function renderOriginalPng(bytes: Buffer, page: number) {
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100 ||
    bytes.length > 10485760 ||
    !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
  )
    throw new Error('INVALID_REVIEW_PAGE');
  if (active >= 2) throw new Error('DOCUMENT_REVIEW_BUSY');
  active++;
  let dir: string | undefined;
  try {
    dir = await mkdtemp(path.join(tmpdir(), 'uttirno-review-'));
    const file = path.join(dir, 'input.pdf');
    await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
    const png = await nativeRunner('pdftoppm', [
      '-f',
      String(page),
      '-l',
      String(page),
      '-singlefile',
      '-scale-to',
      '1400',
      '-png',
      file,
    ]);
    if (
      png.length < 24 ||
      png.length > 8388608 ||
      !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      png.readUInt32BE(16) > 1400 ||
      png.readUInt32BE(20) > 1400
    )
      throw new Error('INVALID_REVIEW_IMAGE');
    return png;
  } finally {
    try {
      if (dir) {
        await removeReviewDirectory(dir);
      }
    } finally {
      active--;
    }
  }
}

async function removeReviewDirectory(dir: string) {
  const target = path.resolve(dir),
    root = path.resolve(tmpdir());
  if (!target.startsWith(root + path.sep) || !path.basename(target).startsWith('uttirno-review-'))
    throw new Error('INVALID_REVIEW_TEMP_PATH');
  await rm(target, { recursive: true, force: true });
}
