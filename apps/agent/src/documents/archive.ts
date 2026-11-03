import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, link, unlink, lstat, open } from 'node:fs/promises';
import path from 'node:path';
import {
  authorizeSource,
  assertSourceUrl,
  configFingerprint,
  type SignedSource,
  type TrustKeys,
} from '@uttirno/source-config';
import { DocumentTextSchema, type DocumentText } from '@uttirno/contracts';

export const sha256 = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');
export function sealText(input: Omit<DocumentText, 'textVersion'>): DocumentText {
  const { textVersion: _unused, ...body } = DocumentTextSchema.parse({
    ...input,
    textVersion: '0'.repeat(64),
  });
  return { ...body, textVersion: sha256(JSON.stringify(body)) };
}
export function validateText(input: unknown): DocumentText {
  const parsed = DocumentTextSchema.parse(input);
  const { textVersion, ...body } = parsed;
  if (sealText(body).textVersion !== textVersion) throw new Error('TEXT_HASH_MISMATCH');
  for (const [i, page] of parsed.pages.entries()) {
    if (page.page !== i + 1) throw new Error('INVALID_PAGE_ORDER');
    for (const word of page.words) {
      const [x, y, w, h] = word.box;
      if (
        word.start >= word.end ||
        word.end > page.text.length ||
        x < 0 ||
        y < 0 ||
        w < 0 ||
        h < 0 ||
        x + w > page.width + 1 ||
        y + h > page.height + 1
      )
        throw new Error('INVALID_WORD_PROVENANCE');
    }
  }
  return parsed;
}
type Capture = {
  sourceId: string;
  configFingerprint: string;
  configVersion: number;
  sha256: string;
  url: string;
  capturedAt: string;
  expiresAt: string;
  mediaType: string;
  size: number;
  response: { status: number; etag: string | null; lastModified: string | null } | null;
};
type ArchiveOptions = {
  root: string;
  load: () => Promise<SignedSource>;
  keys: () => Promise<TrustKeys>;
  now?: () => Date;
};
// Private local content-addressed backend. No public serving; DB/S3 metadata repositories arrive in M4.
export class ArtifactArchive {
  constructor(private readonly options: ArchiveOptions) {}
  private async gate(url?: string) {
    const now = this.options.now?.() ?? new Date();
    const source = authorizeSource(await this.options.load(), await this.options.keys(), now);
    if (!source.retention || Date.parse(source.retention.expiresAt) <= now.getTime())
      throw new Error('RETENTION_NOT_PERMITTED');
    if (url) assertSourceUrl(source, url);
    return { source, now, retention: source.retention };
  }
  async check(url: string) {
    return (await this.gate(url)).source;
  }
  private async readObject(namespace: string, key: string, maxBytes: number): Promise<Buffer> {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('INVALID_OBJECT_KEY');
    const folder = path.resolve(this.options.root, namespace);
    const file = path.join(folder, key);
    if ((await lstat(folder)).isSymbolicLink() || (await lstat(file)).isSymbolicLink())
      throw new Error('ARCHIVE_SYMLINK_DENIED');
    const handle = await open(file, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > maxBytes) throw new Error('ARCHIVE_OBJECT_LIMIT');
      const bytes = Buffer.alloc(maxBytes + 1);
      let offset = 0;
      while (offset < bytes.length) {
        const result = await handle.read(bytes, offset, bytes.length - offset, offset);
        if (!result.bytesRead) break;
        offset += result.bytesRead;
      }
      if (offset > maxBytes) throw new Error('ARCHIVE_OBJECT_LIMIT');
      return bytes.subarray(0, offset);
    } finally {
      await handle.close();
    }
  }
  private async immutable(namespace: string, key: string, bytes: Buffer): Promise<void> {
    const dir = path.resolve(this.options.root, namespace);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    if ((await lstat(dir)).isSymbolicLink()) throw new Error('ARCHIVE_SYMLINK_DENIED');
    const target = path.join(dir, key);
    const temporary = path.join(dir, `.pending-${randomUUID()}`);
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    try {
      try {
        await link(temporary, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (
          (await lstat(target)).isSymbolicLink() ||
          !(await this.readObject(namespace, key, bytes.length)).equals(bytes)
        )
          throw new Error('IMMUTABLE_CONTENT_CONFLICT');
      }
    } finally {
      await unlink(temporary);
    }
  }
  async capture(
    bytes: Buffer,
    url: string,
    mediaType: 'application/pdf' | 'text/html' | 'text/plain',
    acquisition?: {
      fingerprint: string;
      capturedAt: string;
      status: number;
      headers: Record<string, string>;
    },
  ) {
    const { source, now, retention } = await this.gate(url);
    if (
      acquisition &&
      (acquisition.fingerprint !== configFingerprint(source) ||
        acquisition.status !== 200 ||
        !Number.isFinite(Date.parse(acquisition.capturedAt)) ||
        Date.parse(acquisition.capturedAt) > now.getTime())
    )
      throw new Error('ACQUISITION_LINEAGE_MISMATCH');
    if (!bytes.length || bytes.length > source.limits.maxBytes)
      throw new Error('ARTIFACT_SIZE_LIMIT');
    const capture: Capture = {
      sourceId: source.id,
      configFingerprint: configFingerprint(source),
      configVersion: source.version,
      sha256: sha256(bytes),
      url,
      capturedAt: acquisition?.capturedAt ?? now.toISOString(),
      size: bytes.length,
      mediaType,
      response: acquisition
        ? {
            status: acquisition.status,
            etag: acquisition.headers.etag?.slice(0, 1000) ?? null,
            lastModified: acquisition.headers['last-modified']?.slice(0, 1000) ?? null,
          }
        : null,
      expiresAt: new Date(
        Math.min(
          now.getTime() + retention.maxDays * 86400000,
          Date.parse(retention.expiresAt),
          Date.parse(source.expiresAt),
        ),
      ).toISOString(),
    };
    const fresh = await this.gate(url);
    if (configFingerprint(fresh.source) !== capture.configFingerprint)
      throw new Error('ARCHIVE_POLICY_CHANGED');
    await this.immutable('bytes', capture.sha256, bytes);
    const captureId = sha256(JSON.stringify(capture));
    await this.immutable('captures', captureId, Buffer.from(JSON.stringify(capture)));
    return { captureId, ...capture };
  }
  async read(captureId: string): Promise<{ capture: Capture; bytes: Buffer }> {
    if (!/^[a-f0-9]{64}$/.test(captureId)) throw new Error('INVALID_CAPTURE_ID');
    const { source, now } = await this.gate();
    const raw = await this.readObject('captures', captureId, 16384);
    if (sha256(raw) !== captureId) throw new Error('CAPTURE_HASH_MISMATCH');
    const capture = JSON.parse(raw.toString()) as Capture;
    if (
      capture.sourceId !== source.id ||
      capture.configFingerprint !== configFingerprint(source) ||
      Date.parse(capture.expiresAt) <= now.getTime()
    )
      throw new Error('ARTIFACT_POLICY_STALE');
    assertSourceUrl(source, capture.url);
    const bytes = await this.readObject('bytes', capture.sha256, source.limits.maxBytes);
    if (bytes.length !== capture.size || sha256(bytes) !== capture.sha256)
      throw new Error('ARTIFACT_HASH_MISMATCH');
    return { capture, bytes };
  }
  async storeText(captureId: string, input: unknown): Promise<DocumentText> {
    const { capture } = await this.read(captureId);
    const text = validateText(input);
    if (
      text.sourceId !== capture.sourceId ||
      text.artifactSha256 !== capture.sha256 ||
      text.configFingerprint !== capture.configFingerprint
    )
      throw new Error('TEXT_LINEAGE_MISMATCH');
    const body = Buffer.from(JSON.stringify(text));
    if (body.length > 16777216) throw new Error('TEXT_ARCHIVE_LIMIT');
    await this.immutable('texts', text.textVersion, body);
    return text;
  }
  async readText(captureId: string, version: string) {
    const { capture } = await this.read(captureId);
    if (!/^[a-f0-9]{64}$/.test(version)) throw new Error('INVALID_TEXT_VERSION');
    const text = validateText(
      JSON.parse((await this.readObject('texts', version, 16777216)).toString('utf8')),
    );
    if (
      text.artifactSha256 !== capture.sha256 ||
      text.sourceId !== capture.sourceId ||
      text.configFingerprint !== capture.configFingerprint
    )
      throw new Error('TEXT_LINEAGE_MISMATCH');
    return text;
  }
}
