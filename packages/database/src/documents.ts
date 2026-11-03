import { DocumentTextSchema, HashSchema } from '@uttirno/contracts';
import { verifyDocument } from '@uttirno/domain';
import { assertSourceUrl } from '@uttirno/source-config';
import {
  transaction,
  gate,
  requireRole,
  assertWriter,
  type WriteFence,
  type DatabaseOptions,
} from './shared.js';
export type ArtifactReceipt = {
  captureId: string;
  sha256: string;
  sourceId: string;
  configFingerprint: string;
  url: string;
  capturedAt: string;
  expiresAt: string;
  mediaType: string;
  size: number;
  response: unknown;
};
export class DocumentRepository {
  constructor(private readonly options: DatabaseOptions) {}
  async put(actor: string, receipt: ArtifactReceipt, input: unknown, fence?: WriteFence) {
    const document = verifyDocument(DocumentTextSchema.parse(input));
    HashSchema.parse(receipt.captureId);
    HashSchema.parse(receipt.sha256);
    if (
      document.artifactSha256 !== receipt.sha256 ||
      document.sourceId !== receipt.sourceId ||
      document.configFingerprint !== receipt.configFingerprint ||
      !Number.isSafeInteger(receipt.size) ||
      receipt.size < 1 ||
      receipt.size > 10485760
    )
      throw new Error('ARTIFACT_LINEAGE_MISMATCH');
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['operator', 'administrator']);
      const { config } = await gate(
        c,
        this.options,
        receipt.sourceId,
        'collection',
        receipt.configFingerprint,
        true,
      );
      if(receipt.size>config.limits.maxBytes)throw new Error('ARTIFACT_SIZE_LIMIT');
      await assertWriter(c, receipt.sourceId, fence);
      assertSourceUrl(config, receipt.url);
      const now = (await c.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0]?.now;
      if (!now || !config.retention || Date.parse(config.retention.expiresAt) <= now.getTime())
        throw new Error('RETENTION_NOT_PERMITTED');
      const captured = Date.parse(receipt.capturedAt),
        expires = Date.parse(receipt.expiresAt);
      if (
        !Number.isFinite(captured) ||
        !Number.isFinite(expires) ||
        captured > now.getTime() ||
        expires <= now.getTime() ||
        expires >
          Math.min(
            captured + config.retention.maxDays * 86400000,
            Date.parse(config.retention.expiresAt),
            Date.parse(config.expiresAt),
          )
      )
        throw new Error('INVALID_ARTIFACT_RETENTION');
      await c.query(
        'INSERT INTO artifacts(sha256,size,media_type,storage_key) VALUES($1,$2,$3,$1) ON CONFLICT DO NOTHING',
        [receipt.sha256, receipt.size, receipt.mediaType],
      );
      const stored = (
        await c.query('SELECT size,media_type FROM artifacts WHERE sha256=$1', [receipt.sha256])
      ).rows[0];
      if (stored.size !== receipt.size || stored.media_type !== receipt.mediaType)
        throw new Error('ARTIFACT_METADATA_CONFLICT');
      await c.query(
        'INSERT INTO artifact_captures(id,sha256,source_id,fingerprint,url,captured_at,expires_at,response) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING',
        [
          receipt.captureId,
          receipt.sha256,
          receipt.sourceId,
          receipt.configFingerprint,
          receipt.url,
          receipt.capturedAt,
          receipt.expiresAt,
          JSON.stringify(receipt.response ?? null),
        ],
      );
      const existing = (
        await c.query(
          'SELECT sha256,source_id,fingerprint,url,captured_at,expires_at,response FROM artifact_captures WHERE id=$1',
          [receipt.captureId],
        )
      ).rows[0];
      if (
        existing.sha256 !== receipt.sha256 ||
        existing.source_id !== receipt.sourceId ||
        existing.fingerprint !== receipt.configFingerprint ||
        existing.url !== receipt.url ||
        existing.captured_at.getTime() !== captured ||
        existing.expires_at.getTime() !== expires
      )
        throw new Error('CAPTURE_METADATA_CONFLICT');
      await c.query(
        'INSERT INTO artifact_text_versions(text_version,capture_id,document,engine) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [document.textVersion, receipt.captureId, JSON.stringify(document), document.engine],
      );
      const old = (
        await c.query('SELECT document FROM artifact_text_versions WHERE text_version=$1', [
          document.textVersion,
        ])
      ).rows[0];
      if (JSON.stringify(DocumentTextSchema.parse(old.document)) !== JSON.stringify(document))
        throw new Error('TEXT_METADATA_CONFLICT');
      return document.textVersion;
    });
  }
}
