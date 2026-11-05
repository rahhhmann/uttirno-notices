import { it, expect } from 'vitest';
import { evaluateMetrics, probeMetrics } from './monitor.mjs';
it('R24 missing signals fail closed, alert names are bounded and owner is required', () => {
  expect(() => evaluateMetrics('', { uttirno_dead_stages: 1 }, '')).toThrow('ALERT_OWNER_REQUIRED');
  expect(
    evaluateMetrics('uttirno_dead_stages 2\n', { uttirno_dead_stages: 1 }, 'SYNTHETIC owner')[0],
  ).toMatchObject({ active: true, value: 2 });
  expect(evaluateMetrics('', { uttirno_dead_stages: 1 }, 'SYNTHETIC owner')[0]).toMatchObject({
    active: true,
    value: null,
  });
  expect(
    evaluateMetrics('uttirno_dead_stages 0\n', { uttirno_dead_stages: 1 }, 'SYNTHETIC owner')[0]
      ?.active,
  ).toBe(false);
});
it('R24 monitor rejects credential URLs and short tokens', async () => {
  await expect(
    probeMetrics('https://user:pass@example.org', 'short', {}, 'SYNTHETIC', async () => {}),
  ).rejects.toThrow();
});
