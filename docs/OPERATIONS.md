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
