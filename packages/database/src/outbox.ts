import { randomUUID } from 'node:crypto';
import { transaction, type DatabaseOptions } from './shared.js';
export type OutboxClaim = {
  id: string;
  topic: 'stage' | 'publication' | 'suppression';
  payload: unknown;
  token: string;
};
export class OutboxRepository {
  constructor(private readonly options: DatabaseOptions) {}
  async claim(topic: OutboxClaim['topic'], limit = 20): Promise<OutboxClaim[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error('INVALID_OUTBOX_LIMIT');
    return transaction(this.options.pool, async (c) => {
      const rows = (
        await c.query(
          'SELECT * FROM outbox_events WHERE topic=$1 AND delivered_at IS NULL AND (lease_until IS NULL OR lease_until<=clock_timestamp()) ORDER BY created_at LIMIT $2 FOR UPDATE SKIP LOCKED',
          [topic, limit],
        )
      ).rows;
      const result: OutboxClaim[] = [];
      for (const row of rows) {
        const token = randomUUID();
        await c.query(
          "UPDATE outbox_events SET lease_token=$2,lease_until=clock_timestamp()+interval '30 seconds' WHERE id=$1",
          [row.id, token],
        );
        result.push({ id: row.id, topic: row.topic, payload: row.payload, token });
      }
      return result;
    });
  }
  async acknowledge(claim: OutboxClaim) {
    const result = await this.options.pool.query(
      'UPDATE outbox_events SET delivered_at=clock_timestamp(),lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2 AND delivered_at IS NULL AND lease_until>clock_timestamp()',
      [claim.id, claim.token],
    );
    if (!result.rowCount) throw new Error('OUTBOX_LEASE_LOST');
  }
  async dispatchIdentity(stageId: string) {
    const row = (
      await this.options.pool.query('SELECT attempts,state FROM stage_runs WHERE id=$1', [stageId])
    ).rows[0];
    if (!row) throw new Error('STAGE_NOT_FOUND');
    return `${stageId}-${row.attempts}`;
  }
}
