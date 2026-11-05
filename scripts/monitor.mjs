import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export function evaluateMetrics(metrics, thresholds, owner) {
  if (!owner || typeof owner !== 'string') throw new Error('ALERT_OWNER_REQUIRED');
  const values = new Map(
    metrics
      .split('\n')
      .filter((line) => /^uttirno_[a-z0-9_]+ [0-9.e+-]+$/.test(line))
      .map((line) => {
        const [key, value] = line.split(' ');
        return [key, Number(value)];
      }),
  );
  return Object.entries(thresholds).map(([metric, limit]) => {
    if (!/^uttirno_[a-z0-9_]+$/.test(metric) || !Number.isFinite(limit) || limit <= 0)
      throw new Error('INVALID_ALERT_RULE');
    const value = values.get(metric);
    return {
      owner,
      metric,
      active: value === undefined || !Number.isFinite(value) || value >= limit,
      value: value ?? null,
      threshold: limit,
    };
  });
}
export async function probeMetrics(origin, token, thresholds, owner, deliver) {
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    !(
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))
    ) ||
    typeof token !== 'string' ||
    token.length < 32
  )
    throw new Error('INVALID_MONITOR_CONFIG');
  let metrics = '';
  try {
    const response = await fetch(new URL('/internal/metrics', url), {
      headers: { authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      if (!response.body) throw new Error('METRICS_EMPTY');
      const reader = response.body.getReader(),
        chunks = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 1048576) {
          await reader.cancel();
          throw new Error('METRICS_LIMIT');
        }
        chunks.push(part.value);
      }
      metrics = Buffer.concat(chunks).toString();
    }
  } catch {
    /* Missing metrics become actionable alerts, not success. */
  }
  const signals = evaluateMetrics(metrics, thresholds, owner);
  for (const signal of signals.filter((s) => s.active)) await deliver(signal);
  return signals;
}
async function main() {
  const rules = JSON.parse(
    await readFile(new URL('../infra/monitoring/rules.json', import.meta.url), 'utf8'),
  );
  const signals = await probeMetrics(
    process.env.MONITOR_API_ORIGIN,
    process.env.OPERATIONS_TOKEN,
    rules.thresholds,
    process.env.ALERT_OWNER,
    async (signal) => console.log(JSON.stringify({ event: 'operator_alert', ...signal })),
  );
  if (signals.some((s) => s.active)) process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => {
    console.error('MONITOR_CONFIG_OR_DELIVERY_FAILED');
    process.exitCode = 1;
  });
