import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { load } from 'cheerio';
import type { DocumentText, TextPage } from '@uttirno/contracts';
import { sealText, sha256, validateText } from './archive.js';
import { parserCall } from './parser-client.js';

export type Tool = 'pdfinfo' | 'pdftotext' | 'pdftoppm' | 'tesseract';
export type Runner = (tool: Tool, args: string[], input?: Buffer) => Promise<Buffer>;
// Fixed executable vocabulary, argv only, sanitized environment. OS egress/memory isolation is an M8 gate.
export const nativeRunner: Runner = (tool, args, input) =>
  new Promise((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { OMP_THREAD_LIMIT: '1' };
    for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'LANG'])
      if (process.env[key]) env[key] = process.env[key];
    const child = spawn(tool, args, { shell: false, windowsHide: true, env, stdio: 'pipe' });
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        child.kill('SIGKILL');
        reject(error);
      } else resolve(Buffer.concat(chunks));
    };
    const timer = setTimeout(() => finish(new Error('DOCUMENT_PROCESS_TIMEOUT')), 30000);
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 16777216) finish(new Error('DOCUMENT_OUTPUT_LIMIT'));
      else chunks.push(chunk);
    });
    // Consume but never expose native stderr (may contain document text or local paths).
    let errors = 0;
    child.stderr.on('data', (chunk: Buffer) => {
      if (tool === 'pdfinfo' && args.length === 1 && args[0] === '-v') chunks.push(chunk);
      errors += chunk.length;
      if (errors > 65536) finish(new Error('DOCUMENT_ERROR_LIMIT'));
    });
    child.on('error', () => finish(new Error('DOCUMENT_TOOL_UNAVAILABLE')));
    child.on('close', (code) =>
      finish(code === 0 ? undefined : new Error('DOCUMENT_PROCESS_FAILED')),
    );
    child.stdin.on('error', () => {
      /* process exit handled above */
    });
    child.stdin.end(input);
  });

export async function engineVersions(
  run: Runner = nativeRunner,
  recordModels = true,
): Promise<string> {
  const poppler = (await run('pdfinfo', ['-v'])).toString().split('\n')[0];
  const tesseract = (await run('tesseract', ['--version'])).toString().split('\n')[0];
  if (!tesseract?.startsWith('tesseract ') || !poppler?.startsWith('pdfinfo version '))
    throw new Error('INVALID_ENGINE_VERSION');
  const models: string[] = [];
  if (recordModels) {
    const listing = (await run('tesseract', ['--list-langs'])).toString();
    const folder = /in "([^"]+)"/.exec(listing)?.[1];
    if (!folder || !path.isAbsolute(folder)) throw new Error('OCR_MODELS_NOT_IDENTIFIED');
    for (const language of ['ben', 'eng']) {
      if (!listing.split(/\r?\n/).includes(language)) throw new Error('OCR_LANGUAGE_UNAVAILABLE');
      const handle = await open(path.join(folder, `${language}.traineddata`), 'r');
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > 33554432) throw new Error('OCR_MODEL_LIMIT');
        models.push(`${language}:${sha256(await handle.readFile())}`);
      } finally {
        await handle.close();
      }
    }
  }
  return `poppler-bbox-v1/${poppler.trim()}+tesseract-tsv-v1/${tesseract.trim()}/ben+eng/psm3/scale2400/models:${models.join(',') || 'SYNTHETIC-runner'}`;
}
function appendWord(
  page: TextPage,
  word: string,
  box: [number, number, number, number],
  confidence: number | null,
  newLine: boolean,
) {
  if (!word) return;
  if (page.text) page.text += newLine ? '\n' : ' ';
  const start = page.text.length;
  page.text += word;
  page.words.push({ start, end: page.text.length, box, confidence });
}
export function parseBbox(xml: string): TextPage[] {
  const $ = load(xml, { xmlMode: true });
  return $('page')
    .toArray()
    .map((element, index) => {
      const p = $(element);
      const page: TextPage = {
        page: index + 1,
        width: Number(p.attr('width')),
        height: Number(p.attr('height')),
        method: 'text',
        text: '',
        words: [],
        flags: [],
      };
      p.find('line').each((_i, line) => {
        $(line)
          .find('word')
          .each((j, el) => {
            const w = $(el);
            const x = Number(w.attr('xMin'));
            const y = Number(w.attr('yMin'));
            appendWord(
              page,
              w.text(),
              [x, y, Number(w.attr('xMax')) - x, Number(w.attr('yMax')) - y],
              null,
              j === 0,
            );
          });
      });
      if (page.text.includes('\uFFFD')) page.flags.push('replacement_characters');
      // Tables / columns need explicit reviewed scope mapping; bbox reading order never proves semantics.
      page.flags.push('layout_review');
      return page;
    });
}
export function parseTsv(tsv: string, pageNumber: number): TextPage {
  const rows = tsv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((s) => s.split('\t'));
  const root = rows.find((r) => r[0] === '1');
  if (!root) throw new Error('INVALID_OCR_OUTPUT');
  const page: TextPage = {
    page: pageNumber,
    width: Number(root[8]),
    height: Number(root[9]),
    method: 'ocr',
    text: '',
    words: [],
    flags: ['ocr_review', 'layout_review'],
  };
  let last = '';
  for (const row of rows) {
    if (row[0] !== '5' || !row[11]?.trim()) continue;
    const line = row.slice(1, 5).join(':');
    const confidence = Number(row[10]);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100)
      throw new Error('INVALID_OCR_CONFIDENCE');
    appendWord(
      page,
      row.slice(11).join('\t').trim(),
      [Number(row[6]), Number(row[7]), Number(row[8]), Number(row[9])],
      confidence,
      line !== last,
    );
    last = line;
    if (confidence < 80 && !page.flags.includes('low_confidence'))
      page.flags.push('low_confidence');
  }
  if (!page.text) page.flags.push('empty');
  return page;
}
export async function extractPdf(
  bytes: Buffer,
  context: { sourceId: string; configFingerprint: string },
  options: { run?: Runner; forceOcr?: boolean } = {},
): Promise<DocumentText> {
  if (process.env.PARSER_SOCKET && !options.run) {
    const result = validateText(
      JSON.parse(
        (
          await parserCall('extract', {
            pdf: bytes.toString('base64'),
            context,
            forceOcr: options.forceOcr ?? false,
          })
        ).toString(),
      ),
    );
    if (
      result.artifactSha256 !== sha256(bytes) ||
      result.sourceId !== context.sourceId ||
      result.configFingerprint !== context.configFingerprint
    )
      throw new Error('PARSER_LINEAGE_MISMATCH');
    return result;
  }
  if (process.env.NODE_ENV === 'production' && !options.run)
    throw new Error('NATIVE_ISOLATION_REQUIRED');
  return extractPdfLocal(bytes, context, options);
}
export async function extractPdfLocal(
  bytes: Buffer,
  context: { sourceId: string; configFingerprint: string },
  options: { run?: Runner; forceOcr?: boolean } = {},
): Promise<DocumentText> {
  if (
    bytes.length > 10485760 ||
    bytes.length < 8 ||
    !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
  )
    throw new Error('INVALID_PDF_INPUT');
  const execute = options.run ?? nativeRunner;
  const startedAt = Date.now();
  const run: Runner = async (tool, args, input) => {
    if (Date.now() - startedAt > 60000) throw new Error('DOCUMENT_TOTAL_TIME_LIMIT');
    const output = await execute(tool, args, input);
    if (Date.now() - startedAt > 90000) throw new Error('DOCUMENT_TOTAL_TIME_LIMIT');
    return output;
  };
  const dir = await mkdtemp(path.join(tmpdir(), 'uttirno-document-'));
  const file = path.join(dir, 'input.pdf');
  try {
    await writeFile(file, bytes, { mode: 0o600, flag: 'wx' });
    const info = (await run('pdfinfo', [file])).toString();
    const count = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1]);
    if (!Number.isInteger(count) || count < 1 || count > 20 || /^Encrypted:\s+yes/m.test(info))
      throw new Error('PDF_PAGE_OR_ENCRYPTION_LIMIT');
    const pages = parseBbox(
      (await run('pdftotext', ['-bbox-layout', '-enc', 'UTF-8', file, '-'])).toString(),
    );
    if (pages.length !== count) throw new Error('INCOMPLETE_PDF_TEXT');
    const engine = await engineVersions(run, !options.run);
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page) throw new Error('INCOMPLETE_PDF_TEXT');
      if (
        options.forceOcr ||
        page.text.trim().length < 20 ||
        page.flags.includes('replacement_characters')
      ) {
        const png = await run('pdftoppm', [
          '-f',
          String(i + 1),
          '-l',
          String(i + 1),
          '-singlefile',
          '-scale-to',
          '2400',
          '-png',
          file,
        ]);
        pages[i] = parseTsv(
          (
            await run('tesseract', ['stdin', 'stdout', '-l', 'ben+eng', '--psm', '3', 'tsv'], png)
          ).toString(),
          i + 1,
        );
      }
      const extracted = pages[i];
      if (!extracted || extracted.text.length > 200000) throw new Error('DOCUMENT_TEXT_LIMIT');
      if (
        pages.reduce((n, p) => n + p.text.length, 0) > 400000 ||
        pages.reduce((n, p) => n + p.words.length, 0) > 50000
      )
        throw new Error('DOCUMENT_TOTAL_OUTPUT_LIMIT');
    }
    return validateText(
      sealText({ schemaVersion: 1, ...context, artifactSha256: sha256(bytes), engine, pages }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
