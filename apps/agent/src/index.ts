// Public server-side agent capabilities; importing this module never starts CLI/network acquisition.
export { SourceClient } from './fetch/client.js';
export type { HostThrottle } from './fetch/limiter.js';
export { HostLimiter } from './fetch/limiter.js';
export { discover } from './discovery/crawl.js';
export { ArtifactArchive } from './documents/archive.js';
export { acquireJobDocument } from './documents/pipeline.js';
