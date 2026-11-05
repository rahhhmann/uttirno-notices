import { apiOrigin } from '../../../../lib/settings';

export const dynamic = 'force-dynamic';
async function forward(request: Request) {
  const reject = (code: string, status = 503) =>
    Response.json(
      {
        error: { code, message: 'Request could not be completed.', requestId: crypto.randomUUID() },
      },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  try {
    const url = new URL(request.url),
      base = apiOrigin(process.env.ADMIN_API_ORIGIN);
    if (
      !url.pathname.startsWith('/v1/admin/') ||
      url.pathname.includes('%') ||
      url.pathname.includes('\\')
    )
      return reject('INVALID_REQUEST', 400);
    // Next's internal request URL can differ behind a proxy. The API enforces the configured exact public Origin.
    if (request.method === 'POST' && !request.headers.get('origin'))
      return reject('ORIGIN_REJECTED', 403);
    const headers = new Headers();
    for (const name of [
      'accept',
      'content-type',
      'cookie',
      'origin',
      'x-csrf-token',
      'idempotency-key',
    ]) {
      const value = request.headers.get(name);
      if (value && name !== 'cookie') headers.set(name, value);
      if (value && name === 'cookie')
        headers.set(
          name,
          value
            .split(';')
            .filter((part) =>
              [
                '__Host-uttirno_session',
                '__Host-uttirno_login',
                'uttirno_dev_session',
                'uttirno_dev_login',
              ].includes(part.trim().split('=')[0] ?? ''),
            )
            .join(';'),
        );
    }
    let body: Uint8Array | undefined;
    if (request.method === 'POST') {
      if (Number(request.headers.get('content-length') ?? 0) > 2097152)
        return reject('REQUEST_TOO_LARGE', 413);
      const reader = request.body?.getReader(),
        parts: Uint8Array[] = [];
      let size = 0;
      if (reader)
        while (true) {
          const item = await reader.read();
          if (item.done) break;
          size += item.value.length;
          if (size > 2097152) {
            await reader.cancel();
            return reject('REQUEST_TOO_LARGE', 413);
          }
          parts.push(item.value);
        }
      body = new Uint8Array(size);
      let offset = 0;
      for (const part of parts) {
        body.set(part, offset);
        offset += part.length;
      }
    }
    const upstream = await fetch(new URL(url.pathname + url.search, base), {
      method: request.method,
      headers,
      ...(body ? { body: body as BodyInit } : {}),
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
    const outgoing = new Headers({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    for (const name of ['content-type', 'content-disposition', 'location', 'retry-after','cross-origin-resource-policy']) {
      const value = upstream.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) outgoing.append('set-cookie', cookie);
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch {
    return reject('API_UNAVAILABLE');
  }
}
export const GET = forward;
export const POST = forward;
