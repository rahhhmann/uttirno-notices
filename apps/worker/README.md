# Worker — M4

BullMQ delivery is backed by canonical PostgreSQL runs/stages/outbox. Queue payloads contain only a stage ID; current source/signature/config/role/lease gates are rechecked at execution and persistence boundaries. The worker has no publication handler.

## Commands

After npm run build:

- node apps/worker/dist/main.js check-config
- node apps/worker/dist/main.js run EXTERNAL_TRUST_KEYS_JSON PRIVATE_ARCHIVE_ROOT DOCUMENT_PLAN_REGISTRY_JSON OPERATOR_ACTOR_ID

run is an explicit operator command, not automatic web-server startup. It needs migrated schema, a legitimately provisioned operator identity and actually approved signed sources. Migrations create no default account or source approval. No real source is enabled by this repository.

The plan registry is a JSON object keyed by exact approved document URL, with artifactSha256 and plan. Plans use the [M3 schema](../../config/extraction/README.md); keys/plans are bounded regular-file reads. The signed source must additionally attest documentExtraction.jobNoticeOnly=true. Missing mapping or changed artifact pauses collection for review. No generated executable code, CAPTCHA/login/applicant processing or automatic applications.

## Runtime

A 5-second dispatcher schedules eligible due sources, claims stage outbox entries and repairs missing queue delivery from durable stage state. Defaults: 6-hour source discovery; one active source run; 45-second source lease, 10-second heartbeat; bounded DB attempts/dead letters; independently fenced outbox acknowledgements. Host serialization, request spacing/cooldown and aggregate budgets use shared DB state.

discover checkpoints bounded source inventory and creates document dependencies. document uses the existing broker/archive/native PDF pipeline, persists text/metadata and a pinned plan. One reconcile fan-in is created only after every expected document stage completes; it creates an evidence-scoped draft or a manual identity-review candidate. No model key is required.

Failure/drift never implies cancellation or publication. Revoked/config-stale work is blocked, stale lease owners cannot write, and operator reruns record a reason. Publication/suppression outbox events remain pending for future consumers. SIGINT/SIGTERM stop dispatch and close worker/queue/DB.

[M4 tests and limits](../../docs/milestones/M4.md). M5 authentication/API, production S3/OS/DB grants, purge and full failover/restore drills remain later gates.
