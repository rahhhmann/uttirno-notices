import type { Pool } from 'pg';
import { schemaName } from './migrate.js';
import { transaction } from './shared.js';
// Explicit owner-operated grants. Roles and credentials must already exist; no default users/passwords.
export async function provisionRuntimeGrants(
  pool: Pool,
  schema: string,
  apiRole: string,
  workerRole: string,
) {
  for (const name of [schema, apiRole, workerRole]) schemaName(name);
  if (apiRole === workerRole) throw new Error('DISTINCT_RUNTIME_ROLES_REQUIRED');
  await transaction(pool, async (c) => {
    const roles = await c.query(
      'SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls FROM pg_roles WHERE rolname=ANY($1::text[])',
      [[apiRole, workerRole]],
    );
    if (
      roles.rows.length !== 2 ||
      roles.rows.some((r) => r.rolsuper || r.rolcreaterole || r.rolcreatedb || r.rolbypassrls)
    )
      throw new Error('UNSAFE_RUNTIME_ROLE');
    if (
      (
        await c.query(
          'SELECT 1 FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname=ANY($1::text[]))',
          [[apiRole, workerRole]],
        )
      ).rowCount
    )
      throw new Error('RUNTIME_ROLE_MEMBERSHIP_REJECTED');
    const owner = (
      await c.query(
        'SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname=$1',
        [schema],
      )
    ).rows[0]?.owner;
    if (!owner || [apiRole, workerRole].includes(owner))
      throw new Error('SEPARATE_MIGRATION_OWNER_REQUIRED');
    if (
      (
        await c.query(
          'SELECT 1 FROM pg_class WHERE relnamespace=(SELECT oid FROM pg_namespace WHERE nspname=$1) AND relowner IN(SELECT oid FROM pg_roles WHERE rolname=ANY($2::text[]))',
          [schema, [apiRole, workerRole]],
        )
      ).rowCount
    )
      throw new Error('RUNTIME_OBJECT_OWNER_REJECTED');
    await c.query(`REVOKE ALL ON SCHEMA "${schema}" FROM PUBLIC`);
    const columns = (
      await c.query(
        "SELECT t.relname AS name,array_agg(a.attname::text ORDER BY a.attnum) AS columns FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=t.oid WHERE n.nspname=$1 AND t.relkind IN ('r','v') AND a.attnum>0 AND NOT a.attisdropped GROUP BY t.relname",
        [schema],
      )
    ).rows;
    const tables = (
      await c.query('SELECT tablename FROM pg_tables WHERE schemaname=$1', [schema])
    ).rows.map((r) => String(r.tablename));
    const workerTables = [
      'admin_identities',
      'admin_roles',
      'authorities',
      'sources',
      'source_config_versions',
      'source_runs',
      'stage_runs',
      'artifacts',
      'artifact_captures',
      'artifact_text_versions',
      'circulars',
      'circular_revisions',
      'positions',
      'position_revisions',
      'field_evidence',
      'application_routes',
      'source_listings',
      'duplicate_candidates',
      'recruitment_events',
      'review_actions',
      'outbox_events',
      'resource_leases',
      'host_windows',
      'schema_migrations',
    ];
    const history = [
      'authorities',
      'source_config_versions',
      'source_policy_reviews',
      'artifacts',
      'artifact_captures',
      'artifact_text_versions',
      'circular_revisions',
      'position_revisions',
      'field_evidence',
      'application_routes',
      'source_listings',
      'review_actions',
      'audit_events',
    ];
    const qualify = (names: string[]) =>
      names.map((n) => `"${schema}"."${schemaName(n)}"`).join(',');
    for (const role of [apiRole, workerRole]) {
      await c.query(`REVOKE ALL ON SCHEMA "${schema}" FROM "${role}"`);
      await c.query(`REVOKE ALL ON ALL TABLES IN SCHEMA "${schema}" FROM "${role}"`);
      for (const table of columns) {
        const names = (table.columns as string[]).map((name) => `"${schemaName(name)}"`).join(',');
        await c.query(
          `REVOKE SELECT(${names}),INSERT(${names}),UPDATE(${names}),REFERENCES(${names}) ON "${schema}"."${schemaName(table.name)}" FROM "${role}"`,
        );
      }
      await c.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${role}"`);
      await c.query(
        `GRANT EXECUTE ON FUNCTION "${schema}".lock_actor_role(text,text[]) TO "${role}"`,
      );
    }
    await c.query(`GRANT SELECT ON ALL TABLES IN SCHEMA "${schema}" TO "${apiRole}"`);
    await c.query(
      `GRANT INSERT ON ${qualify(tables.filter((n) => n !== 'schema_migrations'))} TO "${apiRole}"`,
    );
    await c.query(
      `GRANT UPDATE ON ${qualify(tables.filter((n) => n !== 'schema_migrations' && !history.includes(n)))} TO "${apiRole}"`,
    );
    await c.query(
      `GRANT DELETE ON ${qualify(['admin_roles', 'identity_bindings', 'login_transactions', 'admin_sessions', 'api_idempotency', 'resource_leases'])} TO "${apiRole}"`,
    );
    await c.query(`GRANT SELECT ON ${qualify(workerTables)} TO "${workerRole}"`);
    await c.query(
      `GRANT INSERT ON ${qualify(['source_runs', 'stage_runs', 'artifacts', 'artifact_captures', 'artifact_text_versions', 'circulars', 'circular_revisions', 'positions', 'position_revisions', 'field_evidence', 'application_routes', 'source_listings', 'duplicate_candidates', 'audit_events', 'outbox_events', 'resource_leases', 'host_windows'])} TO "${workerRole}"`,
    );
    await c.query(
      `GRANT UPDATE ON ${qualify(['source_runs', 'stage_runs', 'circulars', 'outbox_events', 'resource_leases', 'host_windows'])} TO "${workerRole}"`,
    );
    await c.query(
      `GRANT UPDATE(next_due,not_before,last_checked,last_success,collection_halted,reason,control_epoch) ON "${schema}".sources TO "${workerRole}"`,
    );
    await c.query(`GRANT DELETE ON "${schema}".resource_leases TO "${workerRole}"`);
  });
}
export async function operationsSnapshot(pool: Pool) {
  const row = (
    await pool.query(`SELECT
    (SELECT count(*)::int FROM stage_runs t JOIN source_runs r ON r.id=t.run_id JOIN sources s ON s.id=r.source_id WHERE t.state='dead' AND (s.last_success IS NULL OR s.last_success<t.updated_at)) AS dead_stages,
    (SELECT count(*)::int FROM stage_runs WHERE state='blocked') AS blocked_stages,
    (SELECT count(*)::int FROM stage_runs WHERE state IN ('queued','retry')) AS queued_stages,
    (SELECT coalesce(max(extract(epoch FROM clock_timestamp()-updated_at)),0)::float8 FROM stage_runs WHERE state IN ('queued','retry')) AS oldest_queue_seconds,
    (SELECT count(*)::int FROM sources WHERE collection_halted) AS collection_paused,
    (SELECT count(*)::int FROM sources WHERE display_halted) AS display_paused,
    (SELECT coalesce(sum(request_count),0)::float8 FROM source_runs WHERE created_at > clock_timestamp()-interval '24 hours') AS acquisition_requests_24h,
    (SELECT coalesce(sum(total_bytes),0)::float8 FROM source_runs WHERE created_at > clock_timestamp()-interval '24 hours') AS acquisition_bytes_24h,
    (SELECT count(*)::int FROM outbox_events WHERE delivered_at IS NULL) AS pending_outbox,
    (SELECT count(*)::int FROM recruitment_events WHERE state='pending' AND kind IN('amendment','extension','cancellation')) AS pending_critical_events,
    (SELECT count(*)::int FROM sources s JOIN source_config_versions v ON v.source_id=s.id AND v.fingerprint=s.current_fingerprint WHERE v.bundle->'config'->>'state'='active' AND (v.bundle->'config'->>'expiresAt')::timestamptz < clock_timestamp()+interval '24 hours') AS source_policy_expiring,
    (SELECT count(*)::int FROM artifacts a WHERE EXISTS(SELECT 1 FROM artifact_captures c WHERE c.sha256=a.sha256) AND NOT EXISTS(SELECT 1 FROM artifact_captures c WHERE c.sha256=a.sha256 AND c.expires_at>clock_timestamp())) AS expired_artifact_candidates`)
  ).rows[0];
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}
