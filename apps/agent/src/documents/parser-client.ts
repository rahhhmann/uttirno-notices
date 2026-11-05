import { request } from 'node:http';
export async function parserCall(operation: 'extract' | 'page', body: unknown): Promise<Buffer> {
  const socketPath = process.env.PARSER_SOCKET;
  if (!socketPath?.startsWith('/') || !socketPath.endsWith('.sock'))
    throw new Error('PARSER_SOCKET_REQUIRED');
  const payload = Buffer.from(JSON.stringify(body));
  if (payload.length > 15000000) throw new Error('PARSER_INPUT_LIMIT');
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath,
        path: `/${operation}`,
        method: 'POST',
        signal: AbortSignal.timeout(100000),
        headers: { 'content-type': 'application/json', 'content-length': payload.length },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 16777216) {
            res.destroy();
            reject(new Error('PARSER_OUTPUT_LIMIT'));
          } else chunks.push(chunk);
        });
        res.on('error', () => reject(new Error('PARSER_UNAVAILABLE')));
        res.on('end', () =>
          res.statusCode === 200
            ? resolve(Buffer.concat(chunks))
            : reject(new Error('PARSER_REJECTED')),
        );
      },
    );
    req.setTimeout(100000, () => req.destroy());
    req.on('error', () => reject(new Error('PARSER_UNAVAILABLE')));
    req.end(payload);
  });
}
