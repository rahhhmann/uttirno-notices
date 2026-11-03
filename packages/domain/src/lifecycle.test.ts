import { expect, it } from 'vitest';
import { stageId, stateAfterEvent, identityPart, retryDelay } from './lifecycle.js';
import type { StageJob } from '@uttirno/contracts';
it('R21 stable stage IDs pin run, config, stage, input and rerun generation', () => {
  const job: StageJob = {
    schemaVersion: 1,
    runId: '00000000-0000-4000-8000-000000000000',
    sourceId: 'synthetic',
    fingerprint: 'a'.repeat(64),
    stage: 'document',
    inputKey: 'synthetic-input',
    generation: 0,
  };
  expect(stageId(job)).toMatch(/^[a-f0-9]{64}$/);
  expect(stageId({ ...job })).toBe(stageId(job));
  for (const update of [
    { generation: 1 },
    { inputKey: 'different' },
    { fingerprint: 'b'.repeat(64) },
  ])
    expect(stageId({ ...job, ...update })).not.toBe(stageId(job));
});
it('R15/R16 identity preserves Unicode arbitrary titles and notice disappearance is not a cancellation event', () => {
  expect(identityPart('  নতুন\tপদ  ')).toBe('নতুন পদ');
  expect(() => identityPart(' ')).toThrow();
  for (const kind of ['exam', 'admit', 'result', 'amendment', 'extension'] as const)
    expect(stateAfterEvent('closed', kind)).toBe('closed');
  expect(stateAfterEvent('open', 'cancellation')).toBe('cancelled');
});
it('R21 retry backoff is bounded, jittered and never accepts invalid attempt counters', () => {
  expect(retryDelay(1, () => 0)).toBe(1000);
  expect(retryDelay(2, () => 1)).toBe(3000);
  expect(() => retryDelay(0)).toThrow();
  expect(() => retryDelay(11)).toThrow();
});
