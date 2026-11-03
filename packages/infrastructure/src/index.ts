import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { Redis } from 'ioredis';
import { createDatabase } from '@uttirno/database';
import type { ServerEnvironment } from '@uttirno/env';
export type DependencyHealth = { database: boolean; redis: boolean; storage: boolean };
export async function checkDependencies(env: ServerEnvironment): Promise<DependencyHealth> {
  const database = createDatabase(env.DATABASE_URL);
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 3000,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  redis.on('error', () => {}); // Report sanitized boolean health only; never connection strings.
  const storage = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    maxAttempts: 1,
    requestHandler: { requestTimeout: 3000, connectionTimeout: 3000 },
  });
  try {
    const results = await Promise.allSettled([
      database.pool.query('SELECT 1'),
      redis.connect().then(() => redis.ping()),
      storage.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }), {
        abortSignal: AbortSignal.timeout(4000),
      }),
    ]);
    return {
      database: results[0].status === 'fulfilled',
      redis: results[1].status === 'fulfilled' && results[1].value === 'PONG',
      storage: results[2].status === 'fulfilled',
    };
  } finally {
    redis.disconnect();
    storage.destroy();
    await database.close();
  }
}
