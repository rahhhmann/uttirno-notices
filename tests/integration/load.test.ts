// Bounded SYNTHETIC baseline; no agreed production traffic/SLO has been supplied.
import { it, expect } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { m5Context } from '../helpers/m5.js';
it('R24 bounded synthetic published-job HTTP baseline reports latency/errors without inventing an SLO', async () => {
  const c = await m5Context();
  try {
    const item = await c.makeDocument(),
      run = await c.beginRun();
    const draft = await c.revisions.stage('operator', {
      sourceId: c.source.config.id,
      runId: run.runId,
      bundle: item.bundle,
      inventory: item.inventory,
    });
    if (draft.state !== 'draft') throw new Error('EXPECTED_DRAFT');
    await c.publication.approve(
      'reviewer',
      draft.revisionId,
      1,
      await c.attestation(item),
      'SYNTHETIC load baseline',
    );
    const origin = await c.app.listen({ host: '127.0.0.1', port: 0 }),
      latencies: number[] = [];
    let errors = 0;
    const started = performance.now();
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let i = 0; i < 25; i++) {
          const start = performance.now();
          const response = await fetch(`${origin}/v1/jobs`);
          if (response.status !== 200 || (await response.json()).items.length !== 2) errors++;
          latencies.push(performance.now() - start);
        }
      }),
    );
    latencies.sort((a, b) => a - b);
    const report = {
      profile: 'SYNTHETIC local two-position baseline',
      requests: 100,
      concurrency: 4,
      records: 2,
      errors,
      p50Ms: latencies[49],
      p95Ms: latencies[94],
      elapsedMs: performance.now() - started,
      productionSloEstablished: false,
    };
    await mkdir('.local', { recursive: true });
    await writeFile('.local/m8-load.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    expect(errors).toBe(0);
    expect(latencies).toHaveLength(100);
  } finally {
    await c.close();
  }
}, 30000);
