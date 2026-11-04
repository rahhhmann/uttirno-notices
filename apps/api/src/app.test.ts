import { it, expect } from 'vitest';
import { createApp } from './app.js';
it('liveness is independent of dependencies; readiness reports real failure and no secret', async () => {
  const app = createApp(async () => ({ database: false, redis: true, storage: true }));
  try {
    expect((await app.inject('/health/live')).statusCode).toBe(200);
    const response = await app.inject('/health/ready');
    expect(response.statusCode).toBe(503);
    expect(response.json().dependencies.database).toBe(false);
    expect((await app.inject('/v1/jobs')).statusCode).toBe(503);
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
it('R26 public API errors and IP rate limits expose no internals and use security headers', async () => {
  const app = createApp(async () => ({ database: true, redis: true, storage: true }));
  try {
    const missing = await app.inject('/v1/unknown');
    expect(missing.statusCode).toBe(404);
    expect(missing.headers['cache-control']).toBe('no-store');
    expect(missing.headers['x-content-type-options']).toBe('nosniff');
    expect(missing.json().error.requestId).toBeTruthy();
    for (let i = 0; i < 120; i++) await app.inject('/health/live');
    const limited = await app.inject('/health/live');
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('RATE_LIMITED');
    expect(limited.body).not.toMatch(/stack|node_modules|postgres/);
  } finally {
    await app.close();
  }
});
