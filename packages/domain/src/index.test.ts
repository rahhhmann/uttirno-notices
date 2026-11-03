import { it, expect } from 'vitest';
import { titleLabel, needsFactReview } from './index.js';
it('unknown/conflicting facts are never displayed as invented titles', () => {
  expect(titleLabel({ status: 'not_stated' })).toBeNull();
  expect(needsFactReview({ status: 'not_extracted' })).toBe(true);
  expect(needsFactReview({ status: 'not_stated' })).toBe(false);
});
