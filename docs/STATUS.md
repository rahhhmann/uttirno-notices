# Current state

Updated: 2026-11-03.

## Completed

- M0 planning; M1 executable foundations; M2 signed source trust/adaptation; M3 documents and deterministic evidence preflight.
- M4-T01–T04 persistence/schema/migrations, immutable drafts and reconciliation, scoped lifecycle handling, durable BullMQ/DB execution, reviewed publication/suppression and transactional outbox. [M4 report](milestones/M4.md).
- 125 unit + 4 original prototype + 28 integration cases passed (157 total). Lint/boundaries/types, all app/package builds and built HTTP smoke passed.
- M3 Linux CI independently passed for b2e142a. M4 remote CI is separate evidence to check against its pushed commit/run.

## Sources and data

Real checked-in sources remain unsigned candidates; collection/display/retention unresolved. No real approval, source activation, applicant processing or model provider was introduced. Tests use generated identities/keys/notice data inside guarded temporary schemas/queues only.

PostgreSQL is canonical for metadata, revisions/reviews/run/checkpoint/outbox state. Original bytes remain in the private local archive; permitted text is immutable and versioned. M4 does not provide production S3 deployment, purge or public downloads. Logical role checks are implemented; authenticated sessions/API and physical production DB credential separation remain M5/M8.

Native PostgreSQL on 5432 is separate. Dedicated local services use 55432/56379/54566 and retained volumes. Root .env remains ignored. Schema migration is an explicit command, not startup/seeding. [Development](DEVELOPMENT.md).

## Remaining

M5–M9: public/admin APIs and identity, admin review UI, actual job portal features, deployment/operations and legitimate real-source/gold-set acceptance. API still exposes health routes only; portal/admin still show foundation notices.

## Approval boundary

M4 was explicitly authorized and is complete. STOP before M5. Do not start it after a model/session change without separate user authorization. Next task, after authorization: M5-T01 in [tasks](TASKS.md).

## Conditions to preserve

Use the shared-database worker for multi-process acquisition; standalone agent CLI retains its single-broker constraint. No source activation to make a demo pass. Reviewed labelled-line plans and literal event/identity mappings remain the supported grammar; unknown layouts/quality/coverage pause for review. Draft ingestion cannot publish. [M4 limits](milestones/M4.md), [open questions](OPEN_QUESTIONS.md).
