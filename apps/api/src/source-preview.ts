import { Worker } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { SignedSourceSchema, assertSourceUrl, configFingerprint } from '@uttirno/source-config';
import { SourcePreviewBodySchema, SourcePreviewSchema } from '@uttirno/contracts';
// Offline uploaded sample only. No source/network call, signer or executable proposal.
export async function previewSource(input: unknown) {
  const body = SourcePreviewBodySchema.parse(input),
    bundle = SignedSourceSchema.parse(body.bundle);
  assertSourceUrl(bundle.config, body.url);
  if (Buffer.byteLength(body.sample) > 262144) throw new Error('INVALID_SAMPLE_LIMIT');
  const result = await new Promise<unknown>((resolve, reject) => {
    const worker = new Worker(
      `const{parentPort,workerData}=require('node:worker_threads');
      import(workerData.module).then(({parsePage})=>{
        try{const result=parsePage(workerData.config,workerData.url,workerData.sample);if(Buffer.byteLength(JSON.stringify(result))>1048576)throw Error();parentPort.postMessage({ok:true,result})}
        catch{parentPort.postMessage({ok:false})}
      }).catch(()=>parentPort.postMessage({ok:false}));`,
      {
        eval: true,
        env: {},
        resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
        workerData: {
          module: import.meta.resolve('@uttirno/agent/preview'),
          config: bundle.config,
          url: body.url,
          sample: body.sample,
        },
      },
    );
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error('INVALID_SAMPLE_LIMIT'));
    }, 3000);
    worker.once('message', (message) => {
      clearTimeout(timer);
      void worker.terminate();
      if (message.ok) resolve(message.result);
      else reject(new Error('INVALID_SOURCE_SAMPLE'));
    });
    worker.once('error', () => {
      clearTimeout(timer);
      reject(new Error('INVALID_SOURCE_SAMPLE'));
    });
    worker.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error('INVALID_SOURCE_SAMPLE'));
    });
  });
  const parsed = SourcePreviewSchema.parse({
    ...(result as object),
    state: 'needs_review',
    fingerprint: configFingerprint(bundle.config),
    sampleSha256: createHash('sha256').update(body.sample).digest('hex'),
    matchesExpected: false,
  });
  parsed.matchesExpected =
    parsed.items.length === body.expectedCandidates &&
    parsed.errors.length === 0 &&
    parsed.quarantined.length === 0;
  return parsed;
}
