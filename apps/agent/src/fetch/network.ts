import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { gunzipSync, inflateSync, brotliDecompressSync } from 'node:zlib';
import ipaddr from 'ipaddr.js';
import { SourcePolicyError } from '@uttirno/source-config';

export type Address = { address: string; family: number };
export type Resolver = (hostname: string) => Promise<Address[]>;
export type WireResponse = { status: number; headers: Record<string, string>; body: Buffer };
export type WireRequest = {
  url: URL;
  addresses: Address[];
  headers: Record<string, string>;
  timeoutMs: number;
  maxBytes: number;
};
export type Transport = (request: WireRequest) => Promise<WireResponse>;
export function isPublicAddress(value: string): boolean {
  try {
    let address = ipaddr.parse(value);
    if (address.kind() === 'ipv6' && (address as ipaddr.IPv6).isIPv4MappedAddress())
      address = (address as ipaddr.IPv6).toIPv4Address();
    return address.range() === 'unicast';
  } catch {
    return false;
  }
}
export const resolvePublic: Resolver = async (hostname) => {
  const addresses = await dnsLookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new SourcePolicyError('NON_PUBLIC_DNS');
  return addresses;
};
export function decodeBody(body: Buffer, encoding: string | undefined, maxBytes: number): Buffer {
  try {
    let decoded: Buffer;
    if (!encoding || encoding === 'identity') decoded = body;
    else if (encoding === 'gzip') decoded = gunzipSync(body, { maxOutputLength: maxBytes });
    else if (encoding === 'deflate') decoded = inflateSync(body, { maxOutputLength: maxBytes });
    else if (encoding === 'br') decoded = brotliDecompressSync(body, { maxOutputLength: maxBytes });
    else throw new Error('Unsupported encoding');
    if (decoded.length > maxBytes) throw new Error('Too large');
    return decoded;
  } catch {
    throw new SourcePolicyError('INVALID_OR_OVERSIZED_BODY');
  }
}
// Internal transport: callers must first pass the public broker gates. Not exported by app's public entrypoint.
export const pinnedRequest: Transport = async ({
  url,
  addresses,
  headers,
  timeoutMs,
  maxBytes,
}) => {
  const address = addresses[0];
  if (!address) throw new SourcePolicyError('EMPTY_DNS');
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const agent =
      url.protocol === 'https:'
        ? new https.Agent({ keepAlive: false })
        : new http.Agent({ keepAlive: false });
    const req = client.request(
      url,
      {
        agent,
        method: 'GET',
        headers,
        maxHeaderSize: 16384,
        signal: AbortSignal.timeout(timeoutMs),
        lookup: (_hostname, _options, callback) => {
          callback(
            null,
            addresses.map((a) => ({ address: a.address, family: a.family })),
          );
        },
        ...(url.protocol === 'https:' ? { rejectUnauthorized: true } : {}),
      },
      (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.statusCode !== 304
        ) {
          const response = {
            status: res.statusCode,
            headers: pickHeaders(res.headers),
            body: Buffer.alloc(0),
          };
          res.destroy();
          resolve(response);
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let failed = false;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            failed = true;
            const error = new SourcePolicyError('BODY_LIMIT');
            reject(error);
            req.destroy(error);
            return;
          }
          chunks.push(chunk);
        });
        res.once('end', () => {
          if (failed || !res.complete) {
            reject(new SourcePolicyError('RESPONSE_INCOMPLETE'));
            return;
          }
          try {
            resolve({
              status: res.statusCode ?? 0,
              headers: pickHeaders(res.headers),
              body: decodeBody(Buffer.concat(chunks), res.headers['content-encoding'], maxBytes),
            });
          } catch (e) {
            reject(e);
          }
        });
        res.once('error', reject);
        res.once('aborted', () => reject(new SourcePolicyError('RESPONSE_ABORTED')));
      },
    );
    req.once('socket', (socket) => {
      socket.once('connect', () => {
        const remoteAddress = socket.remoteAddress;
        if (
          !remoteAddress ||
          !addresses.some((a) => normalizeIp(a.address) === normalizeIp(remoteAddress))
        )
          req.destroy(new SourcePolicyError('REMOTE_IP_MISMATCH'));
      });
    });
    req.once('close', () => agent.destroy());
    req.once('error', (e) =>
      reject(e instanceof SourcePolicyError ? e : new SourcePolicyError('TRANSPORT_FAILED')),
    );
    req.end();
  });
};
function normalizeIp(value: string): string {
  return ipaddr.process(value).toString();
}
function pickHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const key of ['content-type', 'etag', 'last-modified', 'location', 'retry-after']) {
    const value = headers[key];
    if (typeof value === 'string') selected[key] = value;
  }
  return selected;
}
export function bodyHash(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}
