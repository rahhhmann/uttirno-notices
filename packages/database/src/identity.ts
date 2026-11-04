import { RoleSchema, type Role } from '@uttirno/contracts';
import { transaction, requireRole, audit, digest, type DatabaseOptions } from './shared.js';
export type IdentityInput = {
  actorId: string;
  issuer: string;
  subject: string;
  roles: Role[];
  reason: string;
};
function validate(input: IdentityInput) {
  if (
    !input.actorId.trim() ||
    input.actorId.length > 200 ||
    !input.subject ||
    input.subject.length > 300 ||
    input.roles.length < 1 ||
    input.roles.length > 4 ||
    new Set(input.roles).size !== input.roles.length ||
    !input.reason.trim()
  )
    throw new Error('INVALID_IDENTITY_BINDING');
  const url = new URL(input.issuer);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw new Error('INVALID_IDENTITY_BINDING');
  input.roles.forEach((role) => {
    RoleSchema.parse(role);
  });
}
export class IdentityRepository {
  constructor(private readonly options: DatabaseOptions) {}
  async provision(actor: string, input: IdentityInput) {
    validate(input);
    return transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['administrator']);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'uttirno-admin-membership',
      ]);
      await c.query('INSERT INTO admin_identities(id) VALUES($1) ON CONFLICT DO NOTHING', [
        input.actorId,
      ]);
      const existing = (
        await c.query('SELECT actor_id FROM identity_bindings WHERE issuer=$1 AND subject=$2', [
          input.issuer,
          input.subject,
        ])
      ).rows[0];
      if (existing && existing.actor_id !== input.actorId)
        throw new Error('IDENTITY_ALREADY_BOUND');
      const admins = (
        await c.query(
          "SELECT count(*) FROM admin_roles r JOIN admin_identities i ON i.id=r.actor_id WHERE r.role='administrator' AND NOT i.disabled",
        )
      ).rows[0]?.count;
      const wasAdmin = (
        await c.query("SELECT 1 FROM admin_roles WHERE actor_id=$1 AND role='administrator'", [
          input.actorId,
        ])
      ).rowCount;
      if (wasAdmin && Number(admins) <= 1 && !input.roles.includes('administrator'))
        throw new Error('LAST_ADMINISTRATOR_REQUIRED');
      await c.query(
        'INSERT INTO identity_bindings(issuer,subject,actor_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
        [input.issuer, input.subject, input.actorId],
      );
      await c.query('DELETE FROM admin_roles WHERE actor_id=$1', [input.actorId]);
      for (const role of input.roles)
        await c.query('INSERT INTO admin_roles(actor_id,role) VALUES($1,$2)', [
          input.actorId,
          role,
        ]);
      await audit(c, actor, 'identity_provisioned', input.actorId, {
        issuer: input.issuer,
        roles: input.roles,
        reason: input.reason,
      });
      return { actorId: input.actorId };
    });
  }
  // Explicit owner-operated bootstrap only. No HTTP route or automatic account creation calls this.
  async bootstrap(input: IdentityInput) {
    validate(input);
    if (!input.roles.includes('administrator')) throw new Error('INITIAL_ADMINISTRATOR_REQUIRED');
    return transaction(this.options.pool, async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'uttirno-admin-membership',
      ]);
      if ((await c.query("SELECT 1 FROM admin_roles WHERE role='administrator' LIMIT 1")).rowCount)
        throw new Error('BOOTSTRAP_ALREADY_COMPLETE');
      await c.query('INSERT INTO admin_identities(id) VALUES($1)', [input.actorId]);
      await c.query('INSERT INTO identity_bindings(issuer,subject,actor_id) VALUES($1,$2,$3)', [
        input.issuer,
        input.subject,
        input.actorId,
      ]);
      for (const role of input.roles)
        await c.query('INSERT INTO admin_roles(actor_id,role) VALUES($1,$2)', [
          input.actorId,
          role,
        ]);
      await audit(c, input.actorId, 'identity_bootstrapped', input.actorId, {
        issuer: input.issuer,
        roles: input.roles,
        reason: input.reason,
      });
    });
  }
  async startLogin(stateHash: string, browserHash: string, encrypted: string) {
    if (
      !/^[a-f0-9]{64}$/.test(stateHash) ||
      !/^[a-f0-9]{64}$/.test(browserHash) ||
      encrypted.length > 10000
    )
      throw new Error('INVALID_LOGIN_TRANSACTION');
    await this.options.pool.query(
      "INSERT INTO login_transactions(state_hash,browser_hash,encrypted_payload,expires_at) VALUES($1,$2,$3,clock_timestamp()+interval '5 minutes')",
      [stateHash, browserHash, encrypted],
    );
    await this.options.pool.query(
      'DELETE FROM login_transactions WHERE expires_at<=clock_timestamp()',
    );
  }
  async consumeLogin(stateHash: string, browserHash: string) {
    const row = (
      await this.options.pool.query(
        'DELETE FROM login_transactions WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>clock_timestamp() RETURNING encrypted_payload',
        [stateHash, browserHash],
      )
    ).rows[0];
    return row?.encrypted_payload as string | undefined;
  }
  async createSession(issuer: string, subject: string, tokenHash: string) {
    if (!/^[a-f0-9]{64}$/.test(tokenHash)) throw new Error('INVALID_SESSION');
    return transaction(this.options.pool, async (c) => {
      const binding = (
        await c.query(
          'SELECT b.actor_id FROM identity_bindings b JOIN admin_identities i ON i.id=b.actor_id WHERE b.issuer=$1 AND b.subject=$2 AND NOT i.disabled FOR SHARE OF b,i',
          [issuer, subject],
        )
      ).rows[0];
      if (!binding) throw new Error('IDENTITY_NOT_PROVISIONED');
      await requireRole(c, binding.actor_id, [
        'operator',
        'reviewer',
        'source_approver',
        'administrator',
      ]);
      await c.query(
        "INSERT INTO admin_sessions(token_hash,actor_id,issuer,subject,expires_at,idle_expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '8 hours',clock_timestamp()+interval '15 minutes')",
        [tokenHash, binding.actor_id, issuer, subject],
      );
      await audit(c, binding.actor_id, 'session_started', binding.actor_id, {});
      return binding.actor_id as string;
    });
  }
  async session(tokenHash: string) {
    return transaction(this.options.pool, async (c) => {
      const row = (
        await c.query(
          `UPDATE admin_sessions s SET idle_expires_at=LEAST(s.expires_at,clock_timestamp()+interval '15 minutes')
        FROM admin_identities i,identity_bindings b WHERE s.token_hash=$1 AND i.id=s.actor_id AND NOT i.disabled
        AND b.issuer=s.issuer AND b.subject=s.subject AND b.actor_id=s.actor_id AND s.revoked_at IS NULL
        AND s.expires_at>clock_timestamp() AND s.idle_expires_at>clock_timestamp() RETURNING s.actor_id,s.expires_at`,
          [tokenHash],
        )
      ).rows[0];
      if (!row) return null;
      const roles = (
        await c.query('SELECT role FROM admin_roles WHERE actor_id=$1 ORDER BY role', [
          row.actor_id,
        ])
      ).rows.map((r) => RoleSchema.parse(r.role));
      if (!roles.length) return null;
      return {
        actorId: row.actor_id as string,
        expiresAt: (row.expires_at as Date).toISOString(),
        roles,
      };
    });
  }
  async revoke(actor: string, tokenHash: string) {
    await transaction(this.options.pool, async (c) => {
      await c.query(
        'UPDATE admin_sessions SET revoked_at=clock_timestamp() WHERE actor_id=$1 AND token_hash=$2 AND revoked_at IS NULL',
        [actor, tokenHash],
      );
      await audit(c, actor, 'session_revoked', actor, {});
    });
  }
  async idempotent<T>(
    actor: string,
    roles: Role[],
    key: string,
    request: unknown,
    action: () => Promise<T>,
    membership = false,
  ): Promise<T> {
    return transaction(this.options.pool, async (c) => {
      if (membership)
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          'uttirno-admin-membership',
        ]);
      await requireRole(c, actor, roles);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `uttirno-api:${actor}:${key}`,
      ]);
      const hash = digest(request);
      const old = (
        await c.query(
          'SELECT request_hash,result,expires_at>clock_timestamp() AS active FROM api_idempotency WHERE actor_id=$1 AND request_key=$2',
          [actor, key],
        )
      ).rows[0];
      if (old?.active) {
        if (old.request_hash !== hash) throw new Error('IDEMPOTENCY_CONFLICT');
        return old.result as T;
      }
      const result = await action();
      await c.query(
        "INSERT INTO api_idempotency(actor_id,request_key,request_hash,result,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '24 hours') ON CONFLICT(actor_id,request_key) DO UPDATE SET request_hash=excluded.request_hash,result=excluded.result,expires_at=excluded.expires_at",
        [actor, key, hash, JSON.stringify(result)],
      );
      return result;
    });
  }
  async disable(actor: string, target: string, reason: string) {
    if (!reason.trim()) throw new Error('REASON_REQUIRED');
    await transaction(this.options.pool, async (c) => {
      await requireRole(c, actor, ['administrator']);
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'uttirno-admin-membership',
      ]);
      const count = (
        await c.query(
          "SELECT count(*) FROM admin_roles r JOIN admin_identities i ON i.id=r.actor_id WHERE r.role='administrator' AND NOT i.disabled",
        )
      ).rows[0]?.count;
      if (
        (
          await c.query("SELECT 1 FROM admin_roles WHERE actor_id=$1 AND role='administrator'", [
            target,
          ])
        ).rowCount &&
        Number(count) <= 1
      )
        throw new Error('LAST_ADMINISTRATOR_REQUIRED');
      const updated = await c.query(
        'UPDATE admin_identities SET disabled=true WHERE id=$1 RETURNING id',
        [target],
      );
      if (!updated.rowCount) throw new Error('IDENTITY_NOT_FOUND');
      await c.query(
        'UPDATE admin_sessions SET revoked_at=clock_timestamp() WHERE actor_id=$1 AND revoked_at IS NULL',
        [target],
      );
      await audit(c, actor, 'identity_disabled', target, { reason });
    });
  }
}
