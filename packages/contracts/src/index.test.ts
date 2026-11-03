import { describe, it, expect } from 'vitest';
import { TitleFactSchema } from './index.js';
const evidence = {
  sourceId: 'synthetic',
  artifactSha256: 'a'.repeat(64),
  textVersion: 'v1',
  positionScope: 'post-a',
  locator: 'page:1',
  quote: 'নতুন পদের নাম',
};
describe('R12/R27 factual contract', () => {
  it('retains a previously unseen Bangla title with scoped evidence', () => {
    const v = { status: 'stated', value: 'নতুন পদের নাম', evidence: [evidence] };
    expect(TitleFactSchema.parse(v)).toEqual(v);
  });
  it.each(['not_stated', 'not_extracted'])('rejects invented values on %s', (status) => {
    expect(TitleFactSchema.safeParse({ status, value: 0 }).success).toBe(false);
    expect(TitleFactSchema.safeParse({ status }).success).toBe(true);
  });
  it('does not accept an unsupported factual value', () => {
    expect(
      TitleFactSchema.safeParse({ status: 'stated', value: 'Job', evidence: [] }).success,
    ).toBe(false);
  });
  it('keeps both contradictory values instead of silently choosing', () => {
    expect(
      TitleFactSchema.parse({
        status: 'conflicting',
        candidates: [
          { value: 'A', evidence: [evidence] },
          { value: 'B', evidence: [evidence] },
        ],
      }).status,
    ).toBe('conflicting');
  });
  it('rejects malformed provenance and unexplained not-applicable', () => {
    expect(
      TitleFactSchema.safeParse({
        status: 'stated',
        value: 'A',
        evidence: [{ ...evidence, positionScope: '' }],
      }).success,
    ).toBe(false);
    expect(TitleFactSchema.safeParse({ status: 'not_applicable' }).success).toBe(false);
  });
});
