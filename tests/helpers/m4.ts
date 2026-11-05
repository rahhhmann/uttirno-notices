// SYNTHETIC ONLY: isolated loopback DB schemas, ephemeral signing keys, fictional notices/actors.
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createDatabase,
  migrate,
  SourceRepository,
  ExecutionRepository,
  DocumentRepository,
  RevisionRepository,
  PublicationRepository,
  EventRepository,
  OutboxRepository,
} from '@uttirno/database';
import { parseServerEnvironment } from '@uttirno/env';
import { configFingerprint, canonical } from '@uttirno/source-config';
import { RevisionBundleSchema } from '@uttirno/contracts';
import { extractPositions } from '@uttirno/domain';
import { ArtifactArchive } from '../../apps/agent/src/documents/archive.js';
import { extractionFixture, sealText, syntheticLines } from './extraction.js';
import { syntheticSource } from './source.js';
export function integrationEnvironment() {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* Injected CI environment is also supported. */
  }
  const env = parseServerEnvironment(process.env),
    url = new URL(env.DATABASE_URL);
  if (
    env.NODE_ENV === 'production' ||
    url.hostname !== '127.0.0.1' ||
    url.port !== '55432' ||
    url.pathname !== '/uttirno_dev' ||
    new URL(env.REDIS_URL).hostname !== '127.0.0.1' ||
    new URL(env.REDIS_URL).port !== '56379'
  )
    throw new Error('ISOLATED_M4_SERVICES_REQUIRED');
  return env;
}
export async function m4Context(overrides: Record<string, unknown> = {}, registerSource = true) {
  const env = integrationEnvironment(),
    schema = `m4_test_${randomUUID().replaceAll('-', '')}`;
  const database = createDatabase(env.DATABASE_URL, schema);
  const root = await mkdtemp(path.join(tmpdir(), 'uttirno-m4-test-'));
  const cleanup = async () => {
    if (!/^m4_test_[a-f0-9]{32}$/.test(schema)) throw new Error('UNSAFE_TEST_SCHEMA');
    try {
      await database.pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await database.close();
    }
    const resolved = path.resolve(root);
    if (
      !resolved.startsWith(path.resolve(tmpdir()) + path.sep) ||
      !path.basename(resolved).startsWith('uttirno-m4-test-')
    )
      throw new Error('UNSAFE_TEST_FOLDER');
    await rm(resolved, { recursive: true, force: true });
  };
  try {
    await migrate(database.pool, schema);
    await database.pool.query(
      "INSERT INTO admin_identities(id) VALUES('operator'),('reviewer'),('reviewer2'),('approver'),('outsider')",
    );
    await database.pool.query(
      "INSERT INTO admin_roles(actor_id,role) VALUES('operator','operator'),('reviewer','reviewer'),('reviewer2','reviewer'),('approver','source_approver')",
    );
    const source = syntheticSource({
      display: 'permitted',
      expiresAt: '2099-01-01T00:00:00.000Z',
      retention: {
        permitted: true,
        maxDays: 7,
        expiresAt: '2099-01-01T00:00:00.000Z',
        evidence: { url: 'https://notices.example/terms', note: 'SYNTHETIC archive grant' },
      },
      identityLabels: { memo: 'Memo' },
      eventLabels: {
        amendment: 'Amendment',
        extension: 'Extension',
        cancellation: 'Cancellation',
        exam: 'Exam',
        admit: 'Admit',
        result: 'Result',
      },
      documentExtraction: { forceOcr: false, jobNoticeOnly: true },
      ...overrides,
    });
    let keys: Record<string, string> = source.trust;
    const options = { pool: database.pool, keys: async () => keys };
    const sources = new SourceRepository(options),
      execution = new ExecutionRepository(options),
      documents = new DocumentRepository(options),
      revisions = new RevisionRepository(options),
      publication = new PublicationRepository(options),
      events = new EventRepository(options),
      outbox = new OutboxRepository(options);
    if (registerSource) {
      await sources.registerAuthority(
        'approver',
        'synthetic-authority',
        'SYNTHETIC authority',
        source.config.ownershipEvidence,
      );
      await sources.register('approver', 'synthetic-authority', source.bundle);
      const epoch = (
        await database.pool.query('SELECT control_epoch FROM sources WHERE id=$1', [
          source.config.id,
        ])
      ).rows[0].control_epoch;
      await sources.controls('approver', source.config.id, {
        collectionHalted: false,
        displayHalted: source.config.display !== 'permitted',
        reason: 'SYNTHETIC test activation',
        expectedEpoch: epoch,
      });
    }
    // Fixture receipts use the canonical DB clock, avoiding host/VM millisecond skew without relaxing production retention checks.
    let archiveNow = (await database.pool.query<{ now: Date }>('SELECT clock_timestamp() AS now'))
      .rows[0]?.now;
    if (!archiveNow) throw new Error('SYNTHETIC_CLOCK_REQUIRED');
    const archive = new ArtifactArchive({
      now: () => archiveNow ?? new Date(0),
      root,
      load: () => sources.current(source.config.id),
      keys: options.keys,
    });
    const url = 'https://notices.example/notice.txt';
    async function makeDocument(
      changes: {
        memo?: boolean;
        memoValue?: string;
        ocrMistake?: boolean;
        postCode?: boolean;
        note?: string;
        deadline?: string;
        apply?: string;
      } = {},
    ) {
      const header = `${changes.memo === false ? 'SYNTHETIC unlabelled notice' : `Memo: ${changes.memoValue ?? 'SYN-2026-001'}`}\n${changes.note ? `${changes.note}\n` : ''}`;
      const first = [
        syntheticLines[0],
        ...(changes.postCode === false ? [] : ['Post code: SYN-ENG']),
        ...syntheticLines.slice(1),
      ]
        .join('\n')
        .replace('১৫/১২/২০২৬', changes.deadline ?? '১৫/১২/২০২৬')
        .replace('১৬/১২/২০২৬', '18/12/2026')
        .replace('https://notices.example/apply', changes.apply ?? 'https://notices.example/apply');
      const second = first
        .replace('Software Engineer', 'Data Analyst')
        .replace('SYN-ENG', 'SYN-ANA')
        .replace('BSc CSE', 'MSc Statistics');
      const content = `${header}${first}\n${second}`;
      archiveNow = (await database.pool.query<{ now: Date }>('SELECT clock_timestamp() AS now'))
        .rows[0]?.now;
      if (!archiveNow) throw new Error('SYNTHETIC_CLOCK_REQUIRED');
      const capture = await archive.capture(Buffer.from(content), url, 'text/plain');
      // SYNTHETIC faulty OCR: retained original is unchanged; independent human page review must reject the text error.
      const extractedFirst = changes.ocrMistake
        ? first.replace('BSc CSE', 'SYNTHETIC wrong sibling qualification')
        : first;
      const extractedContent = `${header}${extractedFirst}\n${second}`;
      const doc = sealText({
        schemaVersion: 1,
        sourceId: source.config.id,
        configFingerprint: configFingerprint(source.config),
        artifactSha256: capture.sha256,
        engine: 'SYNTHETIC-m4-v1',
        pages: [
          {
            page: 1,
            width: 600,
            height: 900,
            method: changes.ocrMistake ? 'ocr' : 'text',
            text: extractedContent,
            words: [],
            flags: changes.ocrMistake ? ['ocr_review'] : [],
          },
        ],
      });
      await archive.storeText(capture.captureId, doc);
      await documents.put('operator', capture, doc);
      const plan = extractionFixture().plan;
      plan.positions = [
        {
          id: 'engineer',
          ranges: [{ page: 1, start: header.length, end: header.length + extractedFirst.length }],
        },
        {
          id: 'analyst',
          ranges: [
            {
              page: 1,
              start: header.length + extractedFirst.length + 1,
              end: extractedContent.length,
            },
          ],
        },
      ];
      const bundle = RevisionBundleSchema.parse({
        schemaVersion: 1,
        entries: [{ textVersion: doc.textVersion, plan, positions: extractPositions(doc, plan) }],
      });
      const inventory = {
        artifactHashes: [doc.artifactSha256],
        positionKeys: ['SYN-ENG', 'SYN-ANA'],
      };
      return { doc, plan, capture, bundle, inventory };
    }
    async function beginRun(documentUrls = [url]) {
      const runId = await sources.schedule('operator', source.config.id);
      const id = (await database.pool.query('SELECT id FROM stage_runs WHERE run_id=$1', [runId]))
        .rows[0].id;
      const claim = await execution.claim(id, 'operator');
      if (!claim) throw new Error('SYNTHETIC_CLAIM_FAILED');
      await execution.inventory(claim, { complete: true, documentUrls });
      return { runId, claim };
    }
    async function attestation(item: Awaited<ReturnType<typeof makeDocument>>) {
      // Mirrors explicit human attestation structure; facts are independently reproduced by the DB service.
      const hash = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');
      return {
        bundleDigest: hash(item.bundle),
        inventoryDigest: hash(item.inventory),
        textVersions: [item.doc.textVersion],
        acceptedQualityPages: { [item.doc.textVersion]: [] },
        supportingReviews: {},
      };
    }
    return {
      env,
      schema,
      database,
      root,
      source,
      options,
      sources,
      execution,
      documents,
      revisions,
      publication,
      events,
      outbox,
      archive,
      url,
      setKeys: (value: Record<string, string>) => {
        keys = value;
      },
      makeDocument,
      beginRun,
      attestation,
      close: cleanup,
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
