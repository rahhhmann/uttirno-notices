import { z } from 'zod';
import {
  JobsQuerySchema,
  JobsPageSchema,
  JobDetailSchema,
  EventsSchema,
  AuthoritiesSchema,
  SessionSchema,
  ApiErrorSchema,
  AckSchema,
  AdminReviewSnapshotSchema,
  ApproveBodySchema,
  RejectBodySchema,
  ControlsBodySchema,
  ScheduleBodySchema,
  IdentityResolutionSchema,
  RestoreBodySchema,
  type JobsQuery,
} from '@uttirno/contracts';
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId: string | null = null,
  ) {
    super(code);
  }
}
export type ClientOptions = { baseUrl: string; fetch?: typeof fetch };
const page = z.strictObject({
  items: z.array(z.record(z.string(), z.unknown())).max(50),
  nextCursor: z.string().nullable(),
});
export class PublicApiClient {
  protected readonly base: URL;
  private readonly fetcher: typeof fetch;
  constructor(options: ClientOptions) {
    this.base = new URL(options.baseUrl);
    if (
      this.base.origin !== options.baseUrl ||
      this.base.username ||
      this.base.password ||
      !['https:', 'http:'].includes(this.base.protocol) ||
      (this.base.protocol === 'http:' &&
        !['127.0.0.1', 'localhost', '[::1]'].includes(this.base.hostname))
    )
      throw new Error('INVALID_API_ORIGIN');
    this.fetcher = options.fetch ?? fetch;
  }
  protected async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: {
      method?: 'GET' | 'POST';
      body?: unknown;
      headers?: Record<string, string>;
      admin?: boolean;
    } = {},
  ) {
    const signal = AbortSignal.timeout(20000);
    let response: Response;
    try {
      response = await this.fetcher(new URL(path, this.base), {
        method: options.method ?? 'GET',
        redirect: 'error',
        credentials: options.admin ? 'include' : 'omit',
        signal,
        headers: {
          Accept: 'application/json',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
    } catch {
      throw new ApiClientError(0, 'API_UNAVAILABLE');
    }
    if (!response.body || !response.headers.get('content-type')?.includes('application/json'))
      throw new ApiClientError(response.status, 'INVALID_API_RESPONSE');
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > (options.admin ? 16777216 : 2097152)) {
          await reader.cancel();
          throw new ApiClientError(response.status, 'API_RESPONSE_LIMIT');
        }
        chunks.push(part.value);
      }
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      throw new ApiClientError(0, 'API_UNAVAILABLE');
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new ApiClientError(response.status, 'INVALID_API_RESPONSE');
    }
    if (!response.ok) {
      const error = ApiErrorSchema.safeParse(value);
      throw new ApiClientError(
        response.status,
        error.success ? error.data.error.code : 'INVALID_API_RESPONSE',
        error.success ? error.data.error.requestId : null,
      );
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new ApiClientError(response.status, 'INVALID_API_RESPONSE');
    return parsed.data;
  }
  jobs(input: Partial<JobsQuery> = {}) {
    const query = JobsQuerySchema.parse(input),
      url = new URL('/v1/jobs', this.base);
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) url.searchParams.set(key, String(value));
    return this.request(url.pathname + url.search, JobsPageSchema);
  }
  job(id: string) {
    z.uuid().parse(id);
    return this.request(`/v1/jobs/${encodeURIComponent(id)}`, JobDetailSchema);
  }
  events(id: string) {
    z.uuid().parse(id);
    return this.request(`/v1/jobs/${encodeURIComponent(id)}/events`, EventsSchema);
  }
  authorities() {
    return this.request('/v1/authorities', AuthoritiesSchema);
  }
}
export class AdminApiClient extends PublicApiClient {
  private csrf: string | undefined;
  loginUrl() {
    return new URL('/v1/admin/auth/login', this.base).href;
  }
  async session() {
    const session = await this.request('/v1/admin/session', SessionSchema, { admin: true });
    this.csrf = session.csrfToken;
    return session;
  }
  private mutate<T>(
    path: string,
    schema: z.ZodType<T>,
    body: unknown,
    key: string = crypto.randomUUID(),
  ) {
    if (!this.csrf) throw new ApiClientError(401, 'SESSION_REQUIRED');
    z.uuid().parse(key);
    return this.request(path, schema, {
      admin: true,
      method: 'POST',
      body,
      headers: { 'X-CSRF-Token': this.csrf, 'Idempotency-Key': key },
    });
  }
  async logout() {
    const result = await this.mutate('/v1/admin/auth/logout', AckSchema, {});
    this.csrf = undefined;
    return result;
  }
  inventory(
    resource: 'sources' | 'runs' | 'revisions' | 'duplicates' | 'events' | 'audit' | 'stages',
    cursor?: string,
  ) {
    const url = new URL(`/v1/admin/${resource}`, this.base);
    if (cursor) url.searchParams.set('cursor', cursor);
    return this.request(url.pathname + url.search, page, { admin: true });
  }
  review(id: string) {
    z.uuid().parse(id);
    return this.request(`/v1/admin/revisions/${id}`, AdminReviewSnapshotSchema, { admin: true });
  }
  approve(id: string, body: z.input<typeof ApproveBodySchema>, key?: string) {
    z.uuid().parse(id);
    return this.mutate(
      `/v1/admin/revisions/${id}/approve`,
      z.strictObject({ revisionId: z.uuid(), actionId: z.uuid() }),
      ApproveBodySchema.parse(body),
      key,
    );
  }
  reject(id: string, body: z.input<typeof RejectBodySchema>, key?: string) {
    z.uuid().parse(id);
    return this.mutate(
      `/v1/admin/revisions/${id}/reject`,
      AckSchema,
      RejectBodySchema.parse(body),
      key,
    );
  }
  controls(id: string, body: z.input<typeof ControlsBodySchema>, key?: string) {
    return this.mutate(
      `/v1/admin/sources/${encodeURIComponent(id)}/controls`,
      AckSchema,
      ControlsBodySchema.parse(body),
      key,
    );
  }
  schedule(id: string, reason: string, key?: string) {
    return this.mutate(
      `/v1/admin/sources/${encodeURIComponent(id)}/runs`,
      z.strictObject({ runId: z.uuid() }),
      ScheduleBodySchema.parse({ reason }),
      key,
    );
  }
  resolve(id: string, body: z.input<typeof IdentityResolutionSchema>, key?: string) {
    z.uuid().parse(id);
    return this.mutate(
      `/v1/admin/duplicates/${id}/resolve`,
      z.record(z.string(), z.unknown()),
      IdentityResolutionSchema.parse(body),
      key,
    );
  }
  suppress(id: string, body: z.input<typeof RestoreBodySchema>, key?: string) {
    z.uuid().parse(id);
    return this.mutate(
      `/v1/admin/positions/${id}/suppress`,
      AckSchema,
      RestoreBodySchema.parse(body),
      key,
    );
  }
}
