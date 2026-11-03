import { open } from 'node:fs/promises';
import type { TrustKeys } from '@uttirno/source-config';
import { ExtractionPlanSchema, HashSchema } from '@uttirno/contracts';
import type { DocumentPlan } from './handlers.js';
export async function boundedJson(file: string): Promise<unknown> {
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 1048576) throw new Error('CONFIG_INPUT_LIMIT');
    const buffer = Buffer.alloc(1048577);
    let offset = 0;
    while (offset < buffer.length) {
      const result = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (!result.bytesRead) break;
      offset += result.bytesRead;
    }
    if (offset > 1048576) throw new Error('CONFIG_INPUT_LIMIT');
    return JSON.parse(buffer.subarray(0, offset).toString());
  } finally {
    await handle.close();
  }
}
export async function trustKeys(file: string): Promise<TrustKeys> {
  const value = await boundedJson(file);
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.values(value).some((v) => typeof v !== 'string')
  )
    throw new Error('INVALID_TRUST_KEYS');
  return value as TrustKeys;
}
export async function documentPlans(file: string): Promise<Readonly<Record<string, DocumentPlan>>> {
  const value = await boundedJson(file);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('INVALID_PLAN_REGISTRY');
  const result: Record<string, DocumentPlan> = Object.create(null);
  for (const [url, item] of Object.entries(value)) {
    if (
      !item ||
      typeof item !== 'object' ||
      !('artifactSha256' in item) ||
      !('plan' in item) ||
      !['http:', 'https:'].includes(new URL(url).protocol)
    )
      throw new Error('INVALID_PLAN_REGISTRY');
    result[url] = {
      artifactSha256: HashSchema.parse(item.artifactSha256),
      plan: ExtractionPlanSchema.parse(item.plan),
    };
  }
  return result;
}
