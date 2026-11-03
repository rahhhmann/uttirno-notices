import { beforeAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Redis } from 'ioredis';
import { createDatabase } from '@uttirno/database';
import { parseServerEnvironment } from '@uttirno/env';
import { checkDependencies } from '@uttirno/infrastructure';
beforeAll(() => {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* CI injects env. */
  }
  const env = parseServerEnvironment(process.env);
  const targets = [env.DATABASE_URL, env.REDIS_URL, env.S3_ENDPOINT];
  if (
    env.NODE_ENV === 'production' ||
    targets.some(
      (target) => !['localhost', '127.0.0.1', '[::1]'].includes(new URL(target).hostname),
    )
  ) {
    throw new Error('Foundation integration tests require isolated loopback development services.');
  }
  if (!env.S3_BUCKET.startsWith('uttirno-dev-')) {
    throw new Error('Foundation integration tests require a development artifact bucket.');
  }
});
it('R24 real PostgreSQL, Redis and S3 are ready', async () => {
  expect(await checkDependencies(parseServerEnvironment(process.env))).toEqual({
    database: true,
    redis: true,
    storage: true,
  });
});
it('R29 PostgreSQL transaction is rolled back without application tables', async () => {
  const db = createDatabase(parseServerEnvironment(process.env).DATABASE_URL);
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE foundation_probe (value text) ON COMMIT DROP');
    await client.query('INSERT INTO foundation_probe VALUES ($1)', ['synthetic']);
    expect((await client.query('SELECT value FROM foundation_probe')).rows).toEqual([
      { value: 'synthetic' },
    ]);
    await client.query('ROLLBACK');
    expect(
      (await client.query("SELECT to_regclass('pg_temp.foundation_probe') AS name")).rows[0].name,
    ).toBeNull();
  } finally {
    client.release();
    await db.close();
  }
});
it('Redis and private S3 round-trip scoped synthetic data with cleanup', async () => {
  const env = parseServerEnvironment(process.env);
  const id = `foundation-test-${randomUUID()}`;
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 0,
    connectTimeout: 3000,
    retryStrategy: () => null,
  });
  const s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  try {
    await redis.set(id, 'synthetic', 'EX', 30);
    expect(await redis.get(id)).toBe('synthetic');
    await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: id, Body: 'synthetic' }));
    const result = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: id }));
    expect(await result.Body?.transformToString()).toBe('synthetic');
  } finally {
    await Promise.allSettled([
      redis.del(id),
      s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: id })),
    ]);
    redis.disconnect();
    s3.destroy();
  }
});
