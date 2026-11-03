// SYNTHETIC source transport only; real PostgreSQL/Redis, broker gates, archive and native PDF parser.
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { expect, it } from 'vitest';
import { m4Context } from '../helpers/m4.js';
import { extractionFixture } from '../helpers/extraction.js';
import { extractPdf } from '../../apps/agent/src/documents/native.js';
import { configFingerprint } from '@uttirno/source-config';
import { createHandlers } from '../../apps/worker/src/handlers.js';
import { createRuntime } from '../../apps/worker/src/runtime.js';
function assertTestQueue(name: string) {
  if (!/^m4test_[a-f0-9]{32}$/.test(name)) throw new Error('UNSAFE_TEST_QUEUE');
}
it('R21 real BullMQ recovers lost queue messages and runs broker -> archive -> native PDF -> durable review candidate', async () => {
  const c = await m4Context({
    adapter: { kind: 'html', items: '.job', title: 'h2', attachments: 'a.pdf' },
    limits: { maxRequests: 20 },
  });
  let runtime: ReturnType<typeof createRuntime> | undefined;
  const failures: string[] = [];
  const queueName = `m4test_${randomUUID().replaceAll('-', '')}`;
  try {
    const url = 'https://notices.example/synthetic.pdf';
    const bytes = await readFile('tests/fixtures/documents/mixed-text.pdf');
    const text = await extractPdf(bytes, {
      sourceId: c.source.config.id,
      configFingerprint: configFingerprint(c.source.config),
    });
    const page = text.pages[0];
    if (!page) throw new Error('FIXTURE_PAGE_MISSING');
    const plan = extractionFixture().plan;
    plan.positions = [
      { id: 'synthetic-post', ranges: [{ page: 1, start: 0, end: page.text.length }] },
    ];
    const requests: string[] = [];
    const handlers = createHandlers({
      database: c.options,
      actorId: 'operator',
      archiveRoot: c.root,
      plans: { [url]: { artifactSha256: createHash('sha256').update(bytes).digest('hex'), plan } },
      acquisition: {
        resolver: async () => [{ address: '8.8.8.8', family: 4 }],
        transport: async (request) => {
          requests.push(request.url.pathname);
          if (request.url.pathname === '/robots.txt')
            return {
              status: 200,
              headers: { 'content-type': 'text/plain' },
              body: Buffer.from('User-agent: *\nAllow: /'),
            };
          if (request.url.pathname === '/synthetic.pdf')
            return { status: 200, headers: { 'content-type': 'application/pdf' }, body: bytes };
          return {
            status: 200,
            headers: { 'content-type': 'text/html' },
            body: Buffer.from(
              '<article class="job"><h2>SYNTHETIC sample</h2><a class="pdf" href="/synthetic.pdf">Synthetic PDF</a></article>',
            ),
          };
        },
      },
    });
    runtime = createRuntime({
      database: c.options,
      redisUrl: c.env.REDIS_URL,
      actorId: 'operator',
      handlers,
      queueName,
      onStageError: (_claim, error) => {
        failures.push(error instanceof Error ? error.message : 'UNKNOWN');
      },
    });
    await runtime.worker.waitUntilReady();
    await runtime.worker.pause();
    const runId = await c.sources.schedule('operator', c.source.config.id);
    await runtime.tick();
    expect(await runtime.queue.getWaitingCount()).toBe(1);
    // Delete only this unique test queue's message AFTER its outbox ack; DB work must survive.
    await runtime.queue.drain();
    expect(await runtime.queue.getWaitingCount()).toBe(0);
    await runtime.close();
    runtime = createRuntime({
      database: c.options,
      redisUrl: c.env.REDIS_URL,
      actorId: 'operator',
      handlers,
      queueName,
      onStageError: (_claim, error) => {
        failures.push(error instanceof Error ? error.message : 'UNKNOWN');
      },
    });
    await runtime.worker.waitUntilReady();
    await runtime.worker.pause();
    await runtime.tick();
    expect(await runtime.queue.getWaitingCount()).toBe(1);
    await runtime.worker.resume();
    const deadline = Date.now() + 60000;
    let state = '';
    while (Date.now() < deadline) {
      await runtime.tick();
      state = (await c.database.pool.query('SELECT state FROM source_runs WHERE id=$1', [runId]))
        .rows[0].state;
      if (['complete', 'failed', 'blocked'].includes(state)) break;
      await delay(150);
    }
    expect(state, JSON.stringify(failures)).toBe('complete');
    expect(requests).toContain('/synthetic.pdf');
    expect(
      (await c.database.pool.query('SELECT count(*) FROM artifact_text_versions')).rows[0].count,
    ).toBe('1');
    expect(
      (await c.database.pool.query('SELECT reason FROM duplicate_candidates')).rows[0].reason,
    ).toBe('AMBIGUOUS_ISSUER_MEMO_POST_IDENTITY');
    expect(
      (await c.database.pool.query("SELECT count(*) FROM stage_runs WHERE state='complete'"))
        .rows[0].count,
    ).toBe('3');
    expect(await c.publication.publicPositions()).toHaveLength(0);
  } finally {
    if (runtime) {
      await runtime.worker.pause();
      assertTestQueue(queueName);
      await runtime.queue.obliterate({ force: true });
      await runtime.close();
    }
    await c.close();
  }
}, 90000);
