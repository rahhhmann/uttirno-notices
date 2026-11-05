# Current state

Updated: 2026-11-05.

## Completed

M0-M5 foundations, official source trust/adaptation, deterministic extraction/evidence, durable persistence/worker/publication and authenticated APIs are complete. M5 implementation commit a38ba9e passed remote CI run 41850442784.

M6-T01-T03 are complete: staff source/sample/config/policy/canary controls, immutable field/original-page review, independent publication/rejection, duplicates/events and scoped amendment handling, actual run/dependency/audit/recovery screens. The console uses typed API clients and a staff-cookie-only configured gateway. [M6 acceptance](milestones/M6.md), [ADR0010](decisions/0010-m6-admin-and-handoff.md), [lead handoff](ADMIN_HANDOFF.md).

131 unit + 4 prototype + 43 integration + 7 built browser cases passed (**185 total**). Lint/boundaries/strict types, all builds and built API/web HTTP smoke passed. The final regression run was sequential with unchanged DB/test limits. Remote M6 Linux CI is separate evidence to verify against the pushed commit/run.

## Sources and local data

Real sources remain unsigned disabled candidates with unresolved collection/display/retention permissions. BPSC captured listing preview was offline only. No real staff account, live provider registration, real-source activation, applicant processing or model provider was introduced. Tests use synthetic notices/keys/staff in guarded temporary loopback schemas/queues and a signed local OIDC protocol fixture.

PostgreSQL remains canonical for metadata, revisions/reviews/runs/outbox and staff identity/session/idempotency. Original bytes remain private. M6 added no migration; explicit db:migrate verified checksummed schema 0003 without seeding. Root .env is ignored. Dedicated services use 55432/56379/54566 and retained volumes; native PostgreSQL 5432 is separate. Configure a read-only PRIVATE_ARCHIVE_ROOT for retained original text/PNG/downloads; missing storage/tooling fails visibly. [Development](DEVELOPMENT.md).

## Remaining and approval boundary

**STOP before M7.** M6 was explicitly authorized and is complete. Next task after explicit user authorization is M7-T01 in [tasks](TASKS.md); a model/session change does not authorize it.

M7 implements the public job portal, host navigation/branding contract, verified preparation links and SEO/accessibility journeys. M8 handles actual host deployment/live staff provider, physical DB grants, parser isolation, quotas/monitoring/load/rollback/restore. M9 handles legitimate real-source onboarding and adjudicated gold-set/release acceptance. The current Uttirno main site and consumer identity/entitlements were not modified or integrated. Public portal pages still show the foundation notice.

Representative axe/mobile/keyboard checks are bounded evidence, not full accessibility certification. Preserve source/evidence/version gates, independent review, original language, explicit unknowns, archive policy and shared-DB worker acquisition. [M6 limits](milestones/M6.md), [open questions](OPEN_QUESTIONS.md), [release gates](RELEASE.md).
