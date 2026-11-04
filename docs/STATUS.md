# Current state

Updated: 2026-11-04.

## Completed

M0-M4 are complete: foundations, official-source trust/adaptation, deterministic document/evidence processing and durable persistence/worker/publication. M4 commit 0d6747a passed remote CI run 41681098242.

M5-T01-T03 are complete: approved-only public API/search/cursors/OpenAPI; confidential OIDC, explicit staff roles, opaque sessions/CSRF and audited idempotent admin APIs; typed clients with DB/HTTP contract acceptance. [M5 report](milestones/M5.md), [ADR0009](decisions/0009-m5-api-and-identity.md).

129 unit + 4 original prototype + 39 integration cases passed (172 total). Lint/boundaries/strict types, all builds and built API/web HTTP smoke passed. M5 remote CI is independent evidence to verify against the pushed commit/run.

## Sources and local data

Real checked-in sources remain unsigned disabled candidates; collection/display/retention unresolved. No live OIDC registration, real staff account, source activation, applicant processing or model provider was introduced. Tests use generated signed OIDC/staff/source fixtures in guarded temporary schemas/queues only.

PostgreSQL is canonical for metadata, revisions/reviews/run/checkpoint/outbox and identity/session/idempotency state. Original bytes remain private. Schema 0003 was explicitly applied to local development, without seeding. Root .env is ignored; random API secrets and loopback origins were added without replacing credentials. Dedicated services use 55432/56379/54566 with retained volumes; native PostgreSQL 5432 stays separate. [Development](DEVELOPMENT.md).

## Remaining and approval boundary

M6-M9: admin review UI, actual public portal features, production deployment/operations and legitimate source/gold-set acceptance. Both web apps still show foundation notices. M5 was explicitly authorized and is complete. **STOP before M6.** A model/session change does not authorize it. Next task after explicit approval: M6-T01 in [tasks](TASKS.md).

Generic OIDC is implemented but live issuer registration and staff subjects remain Q05. Physical production DB grants, distributed quotas/proxy topology, cleanup scheduling, production storage/OS isolation, restore and measured SLOs remain later gates. No production completion claim. [M5 limits](milestones/M5.md), [open questions](OPEN_QUESTIONS.md).

Use shared-database worker for multi-process acquisition. Unknown layouts/quality/coverage pause for review; no source activation to pass a demo. Original language/evidence, explicit unknowns and independent reviewed publication remain mandatory.
