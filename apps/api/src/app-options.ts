import type { ApiEnvironment } from '@uttirno/env';
import type { DatabaseOptions } from '@uttirno/database';
import type { Taxonomy } from '@uttirno/contracts';
export type ApiOptions = {
  env: ApiEnvironment;
  database: DatabaseOptions;
  taxonomy: Taxonomy;
  rateLimitMax?: number;
  archiveRoot?: string;
};
