import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
// robots-parser 3.0.1 exports a CommonJS factory; the installed .d.ts default is not NodeNext-compatible.
const require = createRequire(import.meta.url);
const robotsParser = require('robots-parser') as (
  url: string,
  text: string,
) => {
  isAllowed(url: string, agent?: string): boolean | undefined;
  getCrawlDelay(agent?: string): number | undefined;
};
import {
  authorizeSource,
  assertSourceUrl,
  configFingerprint,
  SourcePolicyError,
  type SourceConfig,
  type TrustKeys,
} from '@uttirno/source-config';
import {
  resolvePublic,
  pinnedRequest,
  bodyHash,
  isPublicAddress,
  type Resolver,
  type Transport,
  type WireResponse,
} from './network.js';
import { sharedHostLimiter, type HostLimiter } from './limiter.js';
type Robots = ReturnType<typeof robotsParser>;
export type AcquiredPage = {
  url: string;
  status: number;
  body: Buffer;
  headers: Record<string, string>;
  sha256: string;
  capturedAt: string;
  configVersion: number;
  notModified: boolean;
};
type Options = {
  load: () => Promise<unknown>;
  keys: TrustKeys | (() => Promise<TrustKeys>);
  userAgent: string;
  resolver?: Resolver;
  transport?: Transport;
  limiter?: HostLimiter;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
};
export class SourceClient {
  private requests = 0;
  private stopped = false;
  private bytes = 0;
  private readonly robots = new Map<
    string,
    { policy: Robots; expires: number; fingerprint: string }
  >();
  private readonly cache = new Map<string, WireResponse>();
  constructor(private readonly options: Options) {
    if (!/^[A-Za-z_-]+\/[\w.-]+ .{5,}$/.test(options.userAgent) || /[\r\n]/.test(options.userAgent))
      throw new SourcePolicyError('INVALID_USER_AGENT');
  }
  private now() {
    return this.options.now?.() ?? new Date();
  }
  async current(): Promise<SourceConfig> {
    const keys =
      typeof this.options.keys === 'function' ? await this.options.keys() : this.options.keys;
    return authorizeSource(await this.options.load(), keys, this.now());
  }
  get requestCount() {
    return this.requests;
  }
  stop() {
    this.stopped = true;
  }
  private async gated(
    url: string,
    robotsOnly = false,
  ): Promise<{ config: SourceConfig; target: URL }> {
    if (this.stopped) throw new SourcePolicyError('CLIENT_STOPPED');
    const config = await this.current();
    return { config, target: assertSourceUrl(config, url, robotsOnly) };
  }
  private async wire(
    url: string,
    robotsOnly = false,
    extra: Record<string, string> = {},
  ): Promise<WireResponse> {
    const { config, target } = await this.gated(url, robotsOnly);
    const limiter = this.options.limiter ?? sharedHostLimiter;
    return limiter.run(target.hostname, config.limits.intervalMs, async () => {
      const fresh = await this.gated(url, robotsOnly);
      this.requests++;
      if (this.requests > fresh.config.limits.maxRequests)
        throw new SourcePolicyError('REQUEST_BUDGET');
      if (configFingerprint(fresh.config) !== configFingerprint(config))
        throw new SourcePolicyError('CONFIG_CHANGED_DURING_RUN');
      const addresses = await new Promise<Awaited<ReturnType<Resolver>>>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new SourcePolicyError('DNS_TIMEOUT')),
          fresh.config.limits.timeoutMs,
        );
        (this.options.resolver ?? resolvePublic)(fresh.target.hostname).then(
          (v) => {
            clearTimeout(timer);
            resolve(v);
          },
          (e) => {
            clearTimeout(timer);
            reject(e);
          },
        );
      });
      if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
        throw new SourcePolicyError('NON_PUBLIC_DNS');
      const finalGate = await this.gated(url, robotsOnly);
      if (configFingerprint(finalGate.config) !== configFingerprint(config))
        throw new SourcePolicyError('CONFIG_CHANGED_DURING_RUN');
      const response = await (this.options.transport ?? pinnedRequest)({
        url: fresh.target,
        addresses,
        headers: { 'user-agent': this.options.userAgent, 'accept-encoding': 'identity', ...extra },
        timeoutMs: fresh.config.limits.timeoutMs,
        maxBytes: robotsOnly
          ? Math.min(524288, fresh.config.limits.maxBytes)
          : fresh.config.limits.maxBytes,
      });
      this.bytes += response.body.length;
      if (
        response.body.length >
          (robotsOnly
            ? Math.min(524288, fresh.config.limits.maxBytes)
            : fresh.config.limits.maxBytes) ||
        this.bytes > fresh.config.limits.maxTotalBytes
      )
        throw new SourcePolicyError('BYTE_BUDGET');
      return response;
    });
  }
  private async ensureRobots(url: string): Promise<void> {
    const { config, target } = await this.gated(url);
    const fingerprint = configFingerprint(config);
    let stored = this.robots.get(target.origin);
    if (!stored || stored.expires <= this.now().getTime() || stored.fingerprint !== fingerprint) {
      const robotsUrl = new URL('/robots.txt', target.origin).href;
      let response = await this.wire(robotsUrl, true);
      const robotHops = new Set([robotsUrl]);
      let robotTarget = robotsUrl;
      while ([301, 302, 303, 307, 308].includes(response.status)) {
        if (!response.headers.location || robotHops.size > config.limits.maxRedirects)
          throw new SourcePolicyError('ROBOTS_REDIRECT_LIMIT');
        robotTarget = new URL(response.headers.location, robotTarget).href;
        if (robotHops.has(robotTarget)) throw new SourcePolicyError('ROBOTS_REDIRECT_LOOP');
        robotHops.add(robotTarget);
        response = await this.wire(robotTarget, true);
      }
      let body: string;
      if (response.status === 200) {
        body = response.body.toString('utf8');
        if (body.trim().startsWith('<') || (body.trim() && !/^\s*User-agent\s*:/im.test(body)))
          throw new SourcePolicyError('INVALID_ROBOTS_CONTENT');
      } else if ([404, 410].includes(response.status) && config.robots.missingReviewed) body = '';
      else throw new SourcePolicyError('ROBOTS_UNAVAILABLE');
      stored = {
        policy: robotsParser(robotsUrl, body),
        expires: this.now().getTime() + config.robots.maxAgeSeconds * 1000,
        fingerprint,
      };
      this.robots.set(target.origin, stored);
    }
    const agent = this.options.userAgent.split('/')[0] ?? '';
    if (stored.policy.isAllowed(target.href, agent) !== true)
      throw new SourcePolicyError('ROBOTS_DENIED');
    const crawlDelay = stored.policy.getCrawlDelay(agent);
    if (crawlDelay && crawlDelay * 1000 > config.limits.intervalMs)
      throw new SourcePolicyError('CRAWL_DELAY_REQUIRES_CONFIG_REVIEW');
  }
  async get(input: string): Promise<AcquiredPage> {
    let { config } = await this.gated(input);
    const originalFingerprint = configFingerprint(config);
    let url = input;
    let attempts = 0;
    const visited = new Set<string>();
    while (true) {
      const fresh = await this.gated(url);
      if (configFingerprint(fresh.config) !== originalFingerprint)
        throw new SourcePolicyError('CONFIG_CHANGED_DURING_RUN');
      config = fresh.config;
      await this.ensureRobots(url);
      const key = `${originalFingerprint}:${url}`,
        cached = this.cache.get(key);
      const headers: Record<string, string> = {};
      if (cached?.headers.etag) headers['if-none-match'] = cached.headers.etag;
      if (cached?.headers['last-modified'])
        headers['if-modified-since'] = cached.headers['last-modified'];
      let response: WireResponse;
      try {
        response = await this.wire(url, false, headers);
      } catch (error) {
        if (
          error instanceof SourcePolicyError &&
          ['TRANSPORT_FAILED', 'DNS_TIMEOUT'].includes(error.code) &&
          attempts++ < config.limits.retries
        ) {
          await (
            this.options.sleep ??
            (async (ms) => {
              await delay(ms);
            })
          )(1000);
          continue;
        }
        throw error;
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (visited.size >= config.limits.maxRedirects)
          throw new SourcePolicyError('REDIRECT_LIMIT');
        visited.add(url);
        const next = new URL(response.headers.location ?? '', url).href;
        if (!response.headers.location || visited.has(next))
          throw new SourcePolicyError('REDIRECT_LOOP_OR_MISSING_LOCATION');
        assertSourceUrl(config, next);
        url = next;
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        this.stopped = true;
        throw new SourcePolicyError('SOURCE_ACCESS_BLOCKED');
      }
      if (response.status === 429 || response.status >= 500) {
        if (attempts++ >= config.limits.retries) {
          this.stopped = true;
          throw new SourcePolicyError('RETRY_LIMIT');
        }
        const retry = response.headers['retry-after'];
        const seconds = retry
          ? Number.isFinite(Number(retry))
            ? Number(retry)
            : Math.max(0, (Date.parse(retry) - this.now().getTime()) / 1000)
          : 1;
        if (!Number.isFinite(seconds) || seconds > 30) throw new SourcePolicyError('RETRY_LATER');
        await (
          this.options.sleep ??
          (async (ms) => {
            await delay(ms);
          })
        )(Math.max(1000, seconds * 1000));
        continue;
      }
      let notModified = false;
      if (response.status === 304) {
        if (!cached) throw new SourcePolicyError('UNEXPECTED_NOT_MODIFIED');
        response = cached;
        notModified = true;
      }
      if (response.status !== 200) throw new SourcePolicyError('HTTP_NOT_SUCCESSFUL');
      if (response.body.length > config.limits.maxBytes) throw new SourcePolicyError('BODY_LIMIT');
      const allowed = [
        'text/html',
        'application/xhtml+xml',
        'text/plain',
        'application/json',
        'application/pdf',
        'text/javascript',
        'application/javascript',
        'text/css',
        'image/png',
        'image/jpeg',
        'image/svg+xml',
        'image/webp',
        'image/x-icon',
        'font/woff',
        'font/woff2',
        'application/octet-stream',
      ];
      const contentType = (response.headers['content-type'] ?? '')
        .split(';')[0]
        ?.trim()
        .toLowerCase();
      if (!allowed.includes(contentType ?? ''))
        throw new SourcePolicyError('UNSUPPORTED_CONTENT_TYPE');
      const finalConfig = (await this.gated(url)).config;
      if (configFingerprint(finalConfig) !== originalFingerprint)
        throw new SourcePolicyError('CONFIG_CHANGED_DURING_RUN');
      const oldest = this.cache.keys().next().value;
      if (this.cache.size >= 10 && oldest !== undefined) this.cache.delete(oldest);
      this.cache.set(key, response);
      return {
        url,
        status: 200,
        body: response.body,
        headers: response.headers,
        sha256: bodyHash(response.body),
        capturedAt: this.now().toISOString(),
        configVersion: config.version,
        notModified,
      };
    }
  }
}
