import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  SourceRepository,
  RevisionRepository,
  PublicationRepository,
  EventRepository,
  ExecutionRepository,
  AdminReadRepository,
  type DatabaseOptions,
} from '@uttirno/database';
import {
  ApproveBodySchema,
  RejectBodySchema,
  ControlsBodySchema,
  ScheduleBodySchema,
  IdentityResolutionSchema,
  EventRecordSchema,
  EventDecisionSchema,
  RestoreBodySchema,
  SourceRegistrationSchema,
  DraftBodySchema,
  AdminReviewSnapshotSchema,
  RoleSchema,
  ReasonSchema,
  HashSchema,
  SourceAssessmentSchema,
  SourcePreviewBodySchema,
  AuthorityRegistrationSchema,
  AdminCaseSchema,
  ReviewContextSchema,
  OriginalDocumentSchema,
  type Role,
} from '@uttirno/contracts';
import { ApiErrorSchema } from '@uttirno/contracts';
import type { createAuth } from '../auth/session.js';
import type { CursorCodec } from '../cursor.js';
import { previewSource } from '../source-preview.js';
import { readOriginal } from '../original.js';
import { SignedSourceSchema } from '@uttirno/source-config';
import { renderOriginalPng } from '@uttirno/agent/document-review';
type Auth = ReturnType<typeof createAuth>;
const readers: Role[] = ['operator', 'reviewer', 'source_approver', 'administrator'];
const roles = {
  operator: ['operator', 'administrator'],
  reviewer: ['reviewer', 'administrator'],
  approver: ['source_approver', 'administrator'],
  admin: ['administrator'],
} satisfies Record<string, Role[]>;
const jsonSchema = z.record(z.string(), z.unknown());
export function registerAdmin(
  app: FastifyInstance,
  options: DatabaseOptions,
  auth: Auth,
  cursor: CursorCodec,
  archiveRoot?: string,
  checkHealth?: () => Promise<{ database: boolean; redis: boolean; storage: boolean }>,
) {
  const source = new SourceRepository(options),
    revision = new RevisionRepository(options),
    publication = new PublicationRepository(options),
    events = new EventRepository(options),
    execution = new ExecutionRepository(options),
    read = new AdminReadRepository(options);
  const id = (request: FastifyRequest) => z.strictObject({ id: z.uuid() }).parse(request.params).id;
  const sourceId = (request: FastifyRequest) =>
    z.strictObject({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/) }).parse(request.params).id;
  async function get<T>(
    request: FastifyRequest,
    required: Role[],
    action: (actor: string) => Promise<T>,
  ) {
    const principal = await auth.principal(request, required);
    return auth.authorized(principal.actorId, principal.tokenHash, () => action(principal.actorId));
  }
  function post<S extends z.ZodType>(
    url: string,
    schema: S,
    required: Role[],
    action: (actor: string, body: z.infer<S>, request: FastifyRequest) => Promise<unknown>,
    membership = false,
  ) {
    app.post(
      url,
      {
        schema: {
          tags: ['admin'],
          summary: url,
          body: z.toJSONSchema(schema, { target: 'draft-7' }),
          response: { 200: z.toJSONSchema(jsonSchema, { target: 'draft-7' }) },
        },
      },
      async (request) => {
        const principal = await auth.principal(request, required);
        auth.checkCsrf(request, principal.token);
        const body = schema.parse(request.body),
          key = z.uuid().parse(request.headers['idempotency-key']);
        return auth.authorized(principal.actorId, principal.tokenHash, () =>
          auth.identities.idempotent(
            principal.actorId,
            required,
            key,
            { method: 'POST', url: request.url, body },
            async () => {
              const result = await action(principal.actorId, body, request);
              return result ?? { ok: true };
            },
            membership,
          ),
        );
      },
    );
  }
  app.get('/v1/admin/health', { schema: { tags: ['admin'] } }, async (request) =>
    get(request, readers, async () => {
      if (!checkHealth) throw new Error('HEALTH_UNAVAILABLE');
      const dependencies = await checkHealth();
      return {
        checkedAt: new Date().toISOString(),
        ready: Object.values(dependencies).every(Boolean),
        dependencies,
      };
    }),
  );
  const notFound = (request: FastifyRequest, reply: import('fastify').FastifyReply) =>
    reply
      .code(404)
      .send({ error: { code: 'NOT_FOUND', message: 'Record not found.', requestId: request.id } });
  post('/v1/admin/source-preview', SourcePreviewBodySchema, roles.approver, async (_actor, body) =>
    previewSource(body),
  );
  app.get(
    '/v1/admin/sources/:id/assessment',
    {
      schema: {
        tags: ['admin'],
        response: { 200: z.toJSONSchema(SourceAssessmentSchema, { target: 'draft-7' }) },
      },
    },
    async (request, reply) => {
      const result = await get(request, readers, (actor) =>
        read.assessment(actor, sourceId(request)),
      );
      return result ?? notFound(request, reply);
    },
  );
  app.get(
    '/v1/admin/revisions/:id/context',
    {
      schema: {
        tags: ['admin'],
        response: { 200: z.toJSONSchema(ReviewContextSchema, { target: 'draft-7' }) },
      },
    },
    async (request, reply) => {
      const result = await get(request, roles.reviewer, (actor) =>
        read.context(actor, id(request)),
      );
      return result ?? notFound(request, reply);
    },
  );
  for (const kind of ['duplicate', 'event'] as const)
    app.get(
      `/v1/admin/${kind === 'duplicate' ? 'duplicates' : 'events'}/:id`,
      {
        schema: {
          tags: ['admin'],
          response: { 200: z.toJSONSchema(AdminCaseSchema, { target: 'draft-7' }) },
        },
      },
      async (request, reply) => {
        const result = await get(request, roles.reviewer, (actor) =>
          read.case(actor, kind, id(request)),
        );
        return result ?? notFound(request, reply);
      },
    );
  app.get(
    '/v1/admin/documents/:id/original-text',
    { schema: { tags: ['admin'] } },
    async (request, reply) => {
      const version = z.strictObject({ id: HashSchema }).parse(request.params).id;
      const meta = await get(request, readers, (actor) => read.original(actor, version));
      if (!meta) return notFound(request, reply);
      if (!archiveRoot) throw new Error('ARCHIVE_NOT_CONFIGURED');
      if (!['text/plain', 'text/html'].includes(meta.mediaType))
        throw new Error('INVALID_TEXT_PREVIEW_TYPE');
      const bytes = await readOriginal(archiveRoot, meta.sha256, meta.size),
        text = bytes.toString('utf8');
      return { text: text.slice(0, 262144), truncated: text.length > 262144 };
    },
  );
  app.get(
    '/v1/admin/documents/:id/pages/:page',
    { schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { id: version, page } = z
        .strictObject({ id: HashSchema, page: z.coerce.number().int().min(1).max(100) })
        .parse(request.params);
      const document = await get(request, readers, (actor) => read.document(actor, version));
      if (!document?.pages.some((p) => p.page === page)) return notFound(request, reply);
      const meta = await get(request, readers, (actor) => read.original(actor, version));
      if (!meta) return notFound(request, reply);
      if (!archiveRoot) throw new Error('ARCHIVE_NOT_CONFIGURED');
      if (meta.mediaType !== 'application/pdf') throw new Error('INVALID_PDF_PREVIEW_TYPE');
      const png = await renderOriginalPng(
        await readOriginal(archiveRoot, meta.sha256, meta.size),
        page,
      );
      return reply
        .type('image/png')
        .header('Cross-Origin-Resource-Policy', 'same-origin')
        .send(png);
    },
  );
  app.get(
    '/v1/admin/documents/:id/original-info',
    {
      schema: {
        tags: ['admin'],
        response: { 200: z.toJSONSchema(OriginalDocumentSchema, { target: 'draft-7' }) },
      },
    },
    async (request, reply) => {
      const version = z.strictObject({ id: HashSchema }).parse(request.params).id;
      const result = await get(request, readers, (actor) => read.original(actor, version));
      return result ?? notFound(request, reply);
    },
  );
  app.get(
    '/v1/admin/documents/:id/original',
    { schema: { tags: ['admin'] } },
    async (request, reply) => {
      const version = z.strictObject({ id: HashSchema }).parse(request.params).id;
      const result = await get(request, readers, (actor) => read.original(actor, version));
      if (!result) return notFound(request, reply);
      if (!archiveRoot) throw new Error('ARCHIVE_NOT_CONFIGURED');
      const bytes = await readOriginal(archiveRoot, result.sha256, result.size);
      // Remote HTML/PDF never executes in the staff application's origin.
      return reply
        .type('application/octet-stream')
        .header(
          'Content-Disposition',
          `attachment; filename="notice-${result.sha256}.${result.mediaType === 'application/pdf' ? 'pdf' : 'txt'}"`,
        )
        .send(bytes);
    },
  );
  post('/v1/admin/sources/:id/canary', ScheduleBodySchema, roles.operator, async (actor, b, r) => {
    const bundle = SignedSourceSchema.parse(await source.current(sourceId(r)));
    if (
      bundle.config.limits.maxPages !== 1 ||
      bundle.config.limits.maxRequests > 5 ||
      bundle.config.limits.maxTotalBytes > 2097152
    )
      throw new Error('SOURCE_CANARY_LIMITS_REQUIRED');
    return { runId: await source.schedule(actor, sourceId(r), b.reason, 'canary') };
  });
  for (const resource of [
    'sources',
    'runs',
    'revisions',
    'duplicates',
    'events',
    'audit',
    'stages',
  ] as const) {
    app.get(
      `/v1/admin/${resource}`,
      { schema: { tags: ['admin'], summary: `Bounded ${resource} inventory` } },
      async (request) => {
        const query = z
          .strictObject({
            limit: z.coerce.number().int().min(1).max(50).default(20),
            cursor: z.string().max(3000).optional(),
          })
          .parse(request.query);
        return get(request, resource === 'audit' ? roles.admin : readers, async (actor) => {
          const filter = cursor.fingerprint({ actor, resource, limit: query.limit });
          const previous = query.cursor
            ? cursor.decode(query.cursor, `admin:${resource}`, filter)
            : null;
          const page = await read.list(actor, resource, previous?.after ?? null, query.limit),
            asOf = previous?.asOf ?? new Date().toISOString();
          return {
            items: page.items,
            nextCursor: page.next
              ? cursor.encode(`admin:${resource}`, filter, page.next, asOf)
              : null,
          };
        });
      },
    );
  }
  app.get('/v1/admin/sources/:id', { schema: { tags: ['admin'] } }, async (request, reply) => {
    const result = await get(request, readers, (actor) => read.source(actor, sourceId(request)));
    if (!result)
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: 'Record not found.', requestId: request.id },
      });
    return result;
  });
  app.get(
    '/v1/admin/revisions/:id',
    {
      schema: {
        tags: ['admin'],
        response: {
          200: z.toJSONSchema(AdminReviewSnapshotSchema, { target: 'draft-7' }),
          404: z.toJSONSchema(ApiErrorSchema, { target: 'draft-7' }),
        },
      },
    },
    async (request, reply) => {
      const result = await get(request, roles.reviewer, (actor) => read.review(actor, id(request)));
      if (!result)
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Record not found.', requestId: request.id },
        });
      return result;
    },
  );
  app.get('/v1/admin/documents/:id', { schema: { tags: ['admin'] } }, async (request, reply) => {
    const version = z.strictObject({ id: HashSchema }).parse(request.params).id;
    const result = await get(request, readers, (actor) => read.document(actor, version));
    if (!result)
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: 'Record not found.', requestId: request.id },
      });
    return result;
  });
  post('/v1/admin/authorities', AuthorityRegistrationSchema, roles.approver, (actor, b) =>
    source.registerAuthority(actor, b.id, b.name, b.evidence),
  );
  post('/v1/admin/sources', SourceRegistrationSchema, roles.approver, async (actor, b) => ({
    fingerprint: await source.register(actor, b.authorityId, b.bundle),
  }));
  post('/v1/admin/sources/:id/controls', ControlsBodySchema, roles.approver, (actor, b, r) =>
    source.controls(actor, sourceId(r), b),
  );
  post('/v1/admin/sources/:id/runs', ScheduleBodySchema, roles.operator, async (actor, b, r) => ({
    runId: await source.schedule(actor, sourceId(r), b.reason),
  }));
  post('/v1/admin/runs/:id/rerun', ScheduleBodySchema, roles.operator, async (actor, b, r) => ({
    runId: await execution.rerun(actor, id(r), b.reason),
  }));
  post('/v1/admin/revisions', DraftBodySchema, roles.operator, (actor, b) =>
    revision.stage(actor, b),
  );
  post('/v1/admin/revisions/:id/approve', ApproveBodySchema, roles.reviewer, (actor, b, r) =>
    publication.approve(actor, id(r), b.expectedGeneration, b.attestation, b.reason, b.resolves),
  );
  post('/v1/admin/revisions/:id/reject', RejectBodySchema, roles.reviewer, (actor, b, r) =>
    publication.reject(actor, id(r), b.expectedGeneration, b.reason),
  );
  post(
    '/v1/admin/duplicates/:id/resolve',
    IdentityResolutionSchema,
    roles.reviewer,
    (actor, b, r) => revision.resolveIdentity(actor, id(r), b),
  );
  post('/v1/admin/events', EventRecordSchema, roles.operator, async (actor, b) => ({
    eventId: await events.record(actor, b),
  }));
  post('/v1/admin/events/:id/decision', EventDecisionSchema, roles.reviewer, (actor, b, r) =>
    events.decide(actor, id(r), b.decision, b.reason, b.attestation),
  );
  post('/v1/admin/positions/:id/restore', RestoreBodySchema, roles.reviewer, (actor, b, r) =>
    events.restore(actor, id(r), b.expectedRevision, b.expectedGeneration, b.reason),
  );
  post('/v1/admin/positions/:id/suppress', RestoreBodySchema, roles.reviewer, (actor, b, r) =>
    publication.suppress(actor, id(r), b.expectedRevision, b.expectedGeneration, b.reason),
  );
  const binding = z.strictObject({
    actorId: z.string().trim().min(1).max(200),
    issuer: z.string().url(),
    subject: z.string().min(1).max(300),
    roles: z.array(RoleSchema).min(1).max(4),
    reason: ReasonSchema,
  });
  post(
    '/v1/admin/identities',
    binding,
    roles.admin,
    (actor, b) => auth.identities.provision(actor, b),
    true,
  );
  post(
    '/v1/admin/identities/:actor/disable',
    ScheduleBodySchema,
    roles.admin,
    (actor, b, r) => {
      const target = z.strictObject({ actor: z.string().min(1).max(200) }).parse(r.params).actor;
      return auth.identities.disable(actor, target, b.reason);
    },
    true,
  );
}
