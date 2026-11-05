// Unix-only, byte-in/result-out service. No caller paths, URLs, commands or credentials.
import { createServer } from 'node:http';
import { chmod, lstat, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { extractPdfLocal, engineVersions } from './native.js';
import { renderOriginalPngLocal } from './review.js';
const socket = '/run/parser/native.sock';
const pdf = z
  .string()
  .min(12)
  .max(13981016)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/);
const extract = z.strictObject({
  pdf,
  context: z.strictObject({
    sourceId: z.string().min(1).max(100),
    configFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  forceOcr: z.boolean(),
});
const page = z.strictObject({ pdf, page: z.number().int().min(1).max(100) });
let active = false;
await engineVersions();
try {
  const stat = await lstat(socket);
  if (!stat.isSocket()) throw new Error('INVALID_SOCKET_FILE');
  await unlink(socket);
} catch (error) {
  if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
    throw error;
}
const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.end('ready');
    return;
  }
  if (active || req.method !== 'POST' || !['/extract', '/page'].includes(req.url ?? '')) {
    res.writeHead(503);
    res.end();
    return;
  }
  active = true;
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 15000000) throw new Error('INPUT_LIMIT');
      chunks.push(chunk);
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString());
    if (req.url === '/extract') {
      const input = extract.parse(value);
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify(
          await extractPdfLocal(Buffer.from(input.pdf, 'base64'), input.context, {
            forceOcr: input.forceOcr,
          }),
        ),
      );
    } else {
      const input = page.parse(value);
      res.setHeader('content-type', 'image/png');
      res.end(await renderOriginalPngLocal(Buffer.from(input.pdf, 'base64'), input.page));
    }
  } catch {
    res.writeHead(422);
    res.end();
  } finally {
    active = false;
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(socket, () => {
  void chmod(socket, 0o660);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close());
