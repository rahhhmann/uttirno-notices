# Operations and deployment plan

## Execution
Sources have reviewed discovery/recheck schedules; default starting policy 6-hour discovery/24-hour recheck, override for permitted needs. Rate limits remain separate. Worker acquires a source lease, pins config version and access policy, creates a run, checkpoints and records completeness. Recheck access before retry; revoked jobs cannot bypass gates.

Retries are bounded, honor retry-after, use exponential backoff+jitter; classify permanent vs transient failures. Poison jobs go to dead letters; recovery requires a recorded rerun. No overlapping source runs. Hash/ETag/Last-Modified reduce repeated work.

## Observability
Structured redacted logs with run/source/config/artifact/revision/request IDs. Metrics: discovered/processed/failed/truncated counts, attachment/position coverage, critical-field support, publication lag, stale records, queue depth/age, policy failures, latency, model/OCR cost and source drift.
Alerts: repeated access blocks, critical mismatch, permission expiry, zero-result change, restore failure and publication leak. Assign owner and response channel before enabling.

## Deployment
Local service plan in infra/local; staging/prod templates in infra/deployment. Build immutable images, separate API/worker/browser runtimes, non-root containers/resource limits and secrets from environment/managed storage. Select hosting provider/region at M8 with cost, database backup and permitted document/model processing constraints. No provider is silently provisioned by this scaffold.

Deploy sequence: preflight -> backup/migration compatibility -> migrations -> service rollout -> readiness -> bounded smoke -> monitor. Retain previous app image; schema expand/contract supports rollback. No automatic destructive database reversal.

## Backups and restore
Target initial RPO <=24h and RTO <=4h, to be proven with an agreed production-size restore drill. DB backups and permitted artifact backups/versioning; encrypted and access-controlled. Redis loss recoverable from DB run/outbox records. Test restore into an isolated environment, record timings and consistency.

## Incident playbooks
Blocked source: pause, preserve published view with stale labels unless display rights revoked, record failure, review policy.
Critical amendment: suppress affected stale facts, review original new authority notice, publish corrected revision with timeline.
Compromised credentials: revoke/rotate, stop affected writes, examine audits, restore only after integrity review.
Bad extraction: stop promotion, locate artifact/model/config version, fix, replay drafts and re-review.

## M8 implemented controls and execution

Use [deployment runbook](../infra/deployment/README.md) for protected per-service environments, immutable image preflight, explicit owner migration/grants, readiness and namespace-group replacement. No script provisions cloud hosting or activates sources. Production PDF operations require the network-disabled Unix-socket parser; API/worker images contain no native tools. Keep API trust configuration separate from migration/worker secret files. The acquisition profile remains opt-in.

API request-ID logs omit query/body/cookie/secret content. [Protected metrics and alert evaluation](../infra/monitoring/README.md) cover real dependency failures and DB aggregate execution/policy/retention signals. Redis quotas are shared across API instances and fail closed. A source's signed request/byte limits and shared-DB host leases remain separate from API abuse quotas. Process/container limits and disabled LLM defaults bound development costs; actual budget/traffic targets remain Q06/Q09.

The [incident test](../tests/integration/operations.test.ts) injects drift, observes an owned synthetic alert through real protected HTTP metrics and records reviewed pause recovery. Before live use, assign the actual owner/channel and test delivery, acknowledgment, escalation and recovery. Operator stdout is not proof that an external on-call channel received a notification. No automatic messages are sent to third parties.

## Backup/restore and rollback evidence

[Restore rehearsal](../tests/integration/backup-restore.test.ts) performs real PostgreSQL custom-format dump/restore, authenticated AES-GCM encryption/tamper rejection, approved projection/evidence/audit comparison and archive byte/hash recovery in a new guarded database/folder. Dump and key remain in memory; only encrypted dump is temporarily written, then cleaned. The [64-MiB bounded encryption helper](../packages/database/src/backup.ts) is development tooling, not a large-volume streaming/offsite backup service. Configure actual encrypted backup storage, separate key custody/rotation, scheduling, retention and production-size restore before claiming RPO/RTO. PostgreSQL [pg_dump guidance](https://www.postgresql.org/docs/current/app-pgdump.html) distinguishes logical dumps from a complete production backup strategy.

Schema 0004's helper is additive, but the old M7 image rejects that schema history. App-only rollback to M7 is unsupported. Record a genuinely retained 0004-compatible image, or separately authorize a write-frozen restore of a matching DB/archive backup. Never automatically drop/rewrite migration history. The local container recreation check is restart recovery, not a previous-release rollback drill.

Retained content expiration still blocks reads/publication through current gates. Metrics enumerate expired artifact candidates. Actual destructive purge/legal-hold/takedown behavior must follow a reviewed storage policy/owner (Q06/Q10); no unreviewed deletion is added. [M8 report](milestones/M8.md) separates bounded rehearsal from missing live/production acceptance.
