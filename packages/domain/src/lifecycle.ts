import { createHash } from 'node:crypto';
import { StageJobSchema, type StageJob, type EventKind } from '@uttirno/contracts';
export function stageId(input: StageJob): string {
  const job = StageJobSchema.parse(input);
  return createHash('sha256').update(JSON.stringify(job)).digest('hex');
}
export function identityPart(raw: string): string {
  const value = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!value || value.length > 200) throw new Error('INVALID_IDENTITY');
  return value;
}
export const isCriticalEvent = (kind: EventKind) =>
  ['amendment', 'extension', 'cancellation'].includes(kind);
export type RecruitmentState = 'unknown' | 'upcoming' | 'open' | 'closed' | 'cancelled';
export function stateAfterEvent(current: RecruitmentState, kind: EventKind): RecruitmentState {
  return kind === 'cancellation' ? 'cancelled' : current;
}
export function retryDelay(attempt: number, random: () => number = Math.random): number {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 10) throw new Error('INVALID_ATTEMPT');
  return (
    Math.min(3600000, 1000 * 2 ** (attempt - 1)) +
    Math.floor(Math.max(0, Math.min(1, random())) * 1000)
  );
}
