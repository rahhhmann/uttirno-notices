import { it, expect } from 'vitest';
import { createApp } from './app.js';
it('liveness is independent of dependencies; readiness reports real failure and no secret', async () => {
  const app = createApp(async () => ({ database: false, redis: true, storage: true }));
  try {
    expect((await app.inject('/health/live')).statusCode).toBe(200);
    const response = await app.inject('/health/ready');
    expect(response.statusCode).toBe(503);
    expect(response.json().dependencies.database).toBe(false);
    expect((await app.inject('/v1/jobs')).statusCode).toBe(404);
  } finally {
    await app.close();
  }
});
it('ready only when every dependency passed', async () => {
  const app = createApp(async () => ({ database: true, redis: true, storage: true }));
  try {
    expect((await app.inject('/health/ready')).statusCode).toBe(200);
  } finally {
    await app.close();
  }
});
it('unexpected readiness errors do not leak secrets', async () => {
  const app = createApp(async () => {
    throw new Error('private-secret');
  });
  try {
    const response = await app.inject('/health/ready');
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('private-secret');
  } finally {
    await app.close();
  }
});
