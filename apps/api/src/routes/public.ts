import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  JobsQuerySchema,
  JobsPageSchema,
  JobDetailSchema,
  EventsSchema,
  AuthoritiesSchema,
  ApiErrorSchema,
  type Taxonomy,
} from '@uttirno/contracts';
import { PublicReadRepository, type DatabaseOptions } from '@uttirno/database';
import type { CursorCodec } from '../cursor.js';
export function registerPublic(
  app: FastifyInstance,
  options: DatabaseOptions,
  taxonomy: Taxonomy,
  cursor: CursorCodec,
) {
  const read = new PublicReadRepository(options, taxonomy);
  const response = (schema: z.ZodType) => ({
    200: z.toJSONSchema(schema, { target: 'draft-7' }),
    400: z.toJSONSchema(ApiErrorSchema, { target: 'draft-7' }),
    503: z.toJSONSchema(ApiErrorSchema, { target: 'draft-7' }),
  });
  app.get(
    '/v1/jobs',
    {
      schema: {
        tags: ['public'],
        summary: 'Approved jobs only; original Unicode titles and explicit unknowns',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(
            [
              'q',
              'authority',
              'category',
              'location',
              'education',
              'skill',
              'status',
              'deadlineFrom',
              'deadlineTo',
              'cursor',
              'limit',
            ].map((name) => [name, { type: 'string', maxLength: name === 'cursor' ? 3000 : 500 }]),
          ),
        },
        response: response(JobsPageSchema),
      },
    },
    async (request) => {
      const query = JobsQuerySchema.parse(request.query),
        { cursor: token, ...filters } = query;
      const filter = cursor.fingerprint({ ...filters, taxonomyVersion: taxonomy.version });
      const after = token ? cursor.decode(token, 'jobs', filter) : null;
      if (after) z.uuid().parse(after.after);
      const result = await read.jobs(query, after?.after, after?.asOf);
      const asOf = result.asOf;
      return JobsPageSchema.parse({
        items: result.items,
        nextCursor: result.after ? cursor.encode('jobs', filter, result.after, asOf) : null,
        asOf,
      });
    },
  );
  app.get(
    '/v1/jobs/:id',
    {
      schema: {
        tags: ['public'],
        summary: 'Approved unsuppressed job detail and permitted original sources',
        response: {
          ...response(JobDetailSchema),
          404: z.toJSONSchema(ApiErrorSchema, { target: 'draft-7' }),
        },
      },
    },
    async (request, reply) => {
      const { id } = z.strictObject({ id: z.uuid() }).parse(request.params);
      const value = await read.job(id);
      if (!value)
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Record not found.', requestId: request.id },
        });
      return value;
    },
  );
  app.get(
    '/v1/jobs/:id/events',
    {
      schema: {
        tags: ['public'],
        summary:
          'Approved events only; cancellation timeline can remain after facts are suppressed',
        response: {
          ...response(EventsSchema),
          404: z.toJSONSchema(ApiErrorSchema, { target: 'draft-7' }),
        },
      },
    },
    async (request, reply) => {
      const { id } = z.strictObject({ id: z.uuid() }).parse(request.params);
      const value = await read.events(id);
      if (!value)
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Record not found.', requestId: request.id },
        });
      return EventsSchema.parse(value);
    },
  );
  app.get(
    '/v1/authorities',
    {
      schema: {
        tags: ['public'],
        summary: 'Authorities with currently permitted approved public records',
        response: response(AuthoritiesSchema),
      },
    },
    async () => AuthoritiesSchema.parse(await read.authorities()),
  );
}
