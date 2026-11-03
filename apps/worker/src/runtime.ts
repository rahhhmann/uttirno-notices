import { Queue, Worker } from 'bullmq';
import {
  SourceRepository,
  ExecutionRepository,
  OutboxRepository,
  type StageClaim,
  type DatabaseOptions,
} from '@uttirno/database';
import { SourcePolicyError } from '@uttirno/source-config';
import { StageJobSchema, type StageJob } from '@uttirno/contracts';
export class StageFailure extends Error {
  constructor(
    readonly code: string,
    readonly permanent = false,
    readonly drift = false,
  ) {
    super(code);
  }
}
export type StageResult = { checkpoint: unknown; next?: StageJob[] };
export type StageHandler = (claim: StageClaim) => Promise<StageResult>;
export type RuntimeOptions = {
  database: DatabaseOptions;
  redisUrl: string;
  actorId: string;
  handlers: Record<StageJob['stage'], StageHandler>;
  queueName?: string;
  onStageError?: (stage: StageClaim, error: unknown) => void;
};
export function createRuntime(options: RuntimeOptions) {
  const execution = new ExecutionRepository(options.database),
    sources = new SourceRepository(options.database),
    outbox = new OutboxRepository(options.database);
  const connection = { url: options.redisUrl, maxRetriesPerRequest: null };
  const name = options.queueName ?? 'uttirno-stages-v1';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(name)) throw new Error('INVALID_QUEUE_NAME');
  const queue = new Queue<{ stageId: string }>(name, { connection });
  const processStage = async (id: string) => {
    const claim = await execution.claim(id, options.actorId);
    if (!claim) return { state: 'not_claimed' };
    let lost = false;
    let renewing = false;
    const timer = setInterval(() => {
      if (renewing) return;
      renewing = true;
      execution
        .heartbeat(claim)
        .catch(() => {
          lost = true;
        })
        .finally(() => {
          renewing = false;
        });
    }, 10000);
    try {
      StageJobSchema.parse(claim.payload);
      const result = await options.handlers[claim.payload.stage](claim);
      if (lost) throw new StageFailure('STAGE_LEASE_LOST', true);
      await execution.complete(claim, result.checkpoint, result.next ?? []);
      return { state: 'complete' };
    } catch (error) {
      try {
        options.onStageError?.(claim, error);
      } catch {
        /* Observability callbacks cannot bypass durable failure handling. */
      }
      const code =
        error instanceof StageFailure || error instanceof SourcePolicyError
          ? error.code
          : 'STAGE_FAILED';
      const retryAfter = error instanceof SourcePolicyError ? error.retryAfterMs : undefined;
      await execution.fail(claim, code, {
        permanent:
          error instanceof StageFailure
            ? error.permanent
            : error instanceof SourcePolicyError &&
              /^(INVALID_|SOURCE_ACCESS_|ORIGIN_|UNTRUSTED_|NON_PUBLIC_|COLLECTION_|POLICY_)/.test(
                code,
              ),
        drift: error instanceof StageFailure ? error.drift : false,
        ...(retryAfter !== undefined ? { retryAfterMs: retryAfter } : {}),
      });
      return { state: 'recorded_failure', code };
    } finally {
      clearInterval(timer);
    }
  };
  const worker = new Worker<{ stageId: string }>(
    name,
    async (job) => {
      try {
        if (!job.data || !/^[a-f0-9]{64}$/.test(job.data.stageId))
          throw new Error('INVALID_STAGE_REFERENCE');
        return await processStage(job.data.stageId);
      } catch {
        throw new Error('WORKER_STAGE_FAILED');
      }
    },
    { connection, concurrency: 2, maxStalledCount: 1, lockDuration: 45000 },
  );
  worker.on('error', () => {
    /* Caller observes durable stage state; no raw transport/Redis errors logged. */
  });
  queue.on('error', () => {});
  let ticking = false;
  async function deliver(stageId: string) {
    await queue.add(
      'stage',
      { stageId },
      {
        jobId: await outbox.dispatchIdentity(stageId),
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      await execution.authorize(options.actorId);
      const scheduling = await sources.due(options.actorId);
      for (const event of await outbox.claim('stage')) {
        const reference = event.payload as { stageId?: unknown };
        if (typeof reference.stageId !== 'string' || !/^[a-f0-9]{64}$/.test(reference.stageId))
          throw new Error('INVALID_OUTBOX_PAYLOAD');
        await deliver(reference.stageId);
        await outbox.acknowledge(event);
      }
      // Rebuild queue transport after Redis loss/ack crash from canonical DB stage state.
      for (const id of await execution.recoverable()) await deliver(id);
      return scheduling;
    } finally {
      ticking = false;
    }
  }
  return {
    queue,
    worker,
    tick,
    execution,
    outbox,
    close: async () => {
      await worker.close();
      await queue.close();
    },
  };
}
