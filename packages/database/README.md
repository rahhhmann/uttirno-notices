# Database — M4

Owns PostgreSQL persistence, typed Drizzle models, authored SQL migrations and repositories. Connecting never migrates or seeds. Run npm run db:migrate explicitly against the intended DATABASE_URL. The default schema is uttirno; tests use guarded random schemas on the dedicated loopback development DB.

SourceRepository manages accountable source/config/control history; DocumentRepository stores permitted archive receipts and immutable text; RevisionRepository reconciles memo/post identity and creates immutable drafts. PublicationRepository and EventRepository enforce reviewer roles, independent creator/reviewer, generation checks, deterministic evidence/coverage and scoped suppression/restore. ExecutionRepository and OutboxRepository provide durable stages, quotas, leases, retries and delivery recovery.

Raw bytes remain in the M3 private local archive. Metadata/text are private, retention-gated data. No public binary serving or default identities/approvals are seeded. API actors bind to opaque authenticated sessions and transaction-time role/session locks. IdentityRepository owns explicit issuer/subject bindings, sessions and idempotent transactions; PublicReadRepository serves verified approved DTOs, AdminReadRepository bounds staff reads. M8 provisions physical DB credential/grant separation. Schema 0003 adds identity/session/idempotency tables without seeding or changing prior migration checksums.

[M4 acceptance](../../docs/milestones/M4.md), [data model](../../docs/DATA_MODEL.md), [ADR 0008](../../docs/decisions/0008-m4-persistence-and-execution.md).

M6 extends only read projections: separate signed-policy assessments/version history, current review context, private scoped cases and authorized original capture metadata. API transports/hash-checks original bytes; this package continues to own all SQL. No migration or default data was added.

M8 adds schema 0004 authorization row locking, owner-operated physical API/worker grants and aggregate operations reads. Grants remove stale table/column ACLs and reject owner/superuser/membership shortcuts; worker cannot mutate staff identities/publication/audit history. [Maintenance CLI](src/maintenance.ts) explicitly migrates or grants pre-created roles without seeding. [Backup helper](src/backup.ts) provides bounded authenticated encryption for the development restore rehearsal. No generic export of private data or destructive purge is added. See [deployment and rollback constraints](../../infra/deployment/README.md).
