import type { ApiEnvironment } from '@uttirno/env';
import type { DatabaseOptions } from '@uttirno/database';
import type { Taxonomy } from '@uttirno/contracts';
import type { Redis } from 'ioredis';
import type { OperationsOptions } from './operations.js';
export type ApiOptions = {
  env: ApiEnvironment;
  database: DatabaseOptions;
  taxonomy: Taxonomy;
  rateLimitMax?: number;
  archiveRoot?: string;
  rateLimitRedis?: Redis;
  operations?: OperationsOptions;
  trustedProxies?: string[];
};
