import {
  SourceClient,
  HostLimiter,
  ArtifactArchive,
  discover,
  acquireJobDocument,
} from '@uttirno/agent';
import {
  SourceRepository,
  ExecutionRepository,
  DocumentRepository,
  RevisionRepository,
  type DatabaseOptions,
  type StageClaim,
} from '@uttirno/database';
import {
  RevisionBundleSchema,
  ExtractionPlanSchema,
  HashSchema,
  type ExtractionPlan,
  type StageJob,
} from '@uttirno/contracts';
import { StageFailure, type StageHandler } from './runtime.js';
export type DocumentPlan = { artifactSha256: string; plan: ExtractionPlan };
export type HandlerOptions = {
  database: DatabaseOptions;
  actorId: string;
  archiveRoot: string;
  plans: Readonly<Record<string, DocumentPlan>>;
  acquisition?: Pick<ConstructorParameters<typeof SourceClient>[0], 'resolver' | 'transport'>;
};
export function createHandlers(options: HandlerOptions): Record<StageJob['stage'], StageHandler> {
  const sources = new SourceRepository(options.database),
    execution = new ExecutionRepository(options.database);
  const documents = new DocumentRepository(options.database),
    revisions = new RevisionRepository(options.database);
  const local = new HostLimiter();
  function context(claim: StageClaim) {
    const load = async () => {
      await execution.assertClaim(claim);
      return sources.current(claim.payload.sourceId);
    };
    const client = new SourceClient({
      load,
      keys: options.database.keys,
      ...(options.acquisition?.resolver ? { resolver: options.acquisition.resolver } : {}),
      ...(options.acquisition?.transport ? { transport: options.acquisition.transport } : {}),
      userAgent: 'UttirnoNoticeBot/0.4 (+https://kaizenext.com; contact@kaizenext.com)',
      limiter: {
        run: (host, interval, action) =>
          local.run(host, interval, () => execution.withHost(host, interval, action)),
        defer: async (host, ms) => {
          local.defer(host, ms);
          await execution.deferHost(host, ms);
        },
      },
      reserveRequest: () => execution.reserveRequest(claim),
      recordResponse: (size) => execution.recordResponse(claim, size),
    });
    const archive = new ArtifactArchive({
      root: options.archiveRoot,
      load,
      keys: options.database.keys,
    });
    return { client, archive };
  }
  return {
    discover: async (claim) => {
      const { client } = context(claim);
      const run = await discover(client);
      const summary = {
        complete: run.complete,
        pages: run.pages.length,
        candidates: run.candidates.length,
        attachments: run.attachments,
        errors: run.errors,
        quarantined: run.quarantined.length,
        truncated: run.truncated,
      };
      await execution.checkpoint(claim, summary);
      if (!run.complete) throw new StageFailure('SOURCE_DISCOVERY_DRIFT', true, true);
      if (!run.attachments.length) throw new StageFailure('DOCUMENT_INVENTORY_EMPTY', true, true);
      const policy = await sources.current(claim.payload.sourceId);
      if (!policy.config.documentExtraction?.jobNoticeOnly)
        throw new StageFailure('JOB_DOCUMENT_SCOPE_REVIEW_REQUIRED', true, true);
      await execution.inventory(claim, { complete: true, documentUrls: run.attachments });
      return {
        checkpoint: summary,
        next: run.attachments.map((url) => ({
          ...claim.payload,
          stage: 'document' as const,
          inputKey: url,
        })),
      };
    },
    document: async (claim) => {
      const { client, archive } = context(claim);
      const result = await acquireJobDocument(client, archive, claim.payload.inputKey);
      const stored = await archive.read(result.captureId);
      const text = await archive.readText(result.captureId, result.textVersion);
      await documents.put(
        options.actorId,
        { ...stored.capture, captureId: result.captureId },
        text,
        claim,
      );
      const proposal = options.plans[claim.payload.inputKey];
      if (!proposal) {
        await execution.checkpoint(claim, {
          ...result,
          complete: false,
          reason: 'EXTRACTION_PLAN_REQUIRED',
        });
        throw new StageFailure('EXTRACTION_PLAN_REQUIRED', true, true);
      }
      HashSchema.parse(proposal.artifactSha256);
      if (proposal.artifactSha256 !== text.artifactSha256)
        throw new StageFailure('DOCUMENT_PLAN_ARTIFACT_DRIFT', true, true);
      const plan = ExtractionPlanSchema.parse(proposal.plan);
      // Extraction and identity are scoped in the reconcile stage from immutable stored text.
      return { checkpoint: { captureId: result.captureId, textVersion: result.textVersion, plan } };
    },
    reconcile: async (claim) => {
      const outputs = await execution.documentOutputs(claim),
        stages = outputs.rows,
        discovery = outputs.inventory;
      if (!discovery?.complete) throw new StageFailure('DISCOVERY_INCOMPLETE', true);
      // Fan-in waits until every expected attachment has a completed document stage.
      if (stages.length !== discovery.documentUrls.length)
        throw new StageFailure('ATTACHMENTS_NOT_READY');
      const { extractPositions } = await import('@uttirno/domain');
      const entries = [];
      const hashes: string[] = [];
      const keys: string[] = [];
      for (const stage of stages) {
        const doc = stage.document;
        if (!doc) throw new StageFailure('DOCUMENT_NOT_PERSISTED', true);
        const plan = ExtractionPlanSchema.parse(stage.checkpoint.plan),
          positions = extractPositions(doc, plan);
        entries.push({ textVersion: doc.textVersion, plan, positions });
        hashes.push(doc.artifactSha256);
        for (const pos of positions) {
          const post = pos.fields.postCode;
          keys.push(post.status === 'stated' ? post.candidate.raw : pos.positionId);
        }
      }
      const bundle = RevisionBundleSchema.parse({ schemaVersion: 1, entries });
      const result = await revisions.stage(
        options.actorId,
        {
          sourceId: claim.payload.sourceId,
          runId: claim.payload.runId,
          bundle,
          inventory: { artifactHashes: [...new Set(hashes)], positionKeys: keys },
        },
        claim,
      );
      return { checkpoint: result };
    },
  };
}
