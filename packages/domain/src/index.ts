import type { TitleFact } from '@uttirno/contracts';
export * from './extraction.js';

export type ReviewState = 'draft' | 'needs_review' | 'approved' | 'rejected' | 'superseded';
export function titleLabel(fact: TitleFact): string | null {
  return fact.status === 'stated' ? fact.value : null;
}
export function needsFactReview(fact: TitleFact): boolean {
  return fact.status === 'conflicting' || fact.status === 'not_extracted';
}
// Publication policy and semantic verification are implemented in their later milestones.
