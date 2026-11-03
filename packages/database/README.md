# Database — M4

Owns PostgreSQL persistence, typed Drizzle models, authored SQL migrations and repositories. Connecting never migrates or seeds. Run npm run db:migrate explicitly against the intended DATABASE_URL. The default schema is uttirno; tests use guarded random schemas on the dedicated loopback development DB.

SourceRepository manages accountable source/config/control history; DocumentRepository stores permitted archive receipts and immutable text; RevisionRepository reconciles memo/post identity and creates immutable drafts. PublicationRepository and EventRepository enforce reviewer roles, independent creator/reviewer, generation checks, deterministic evidence/coverage and scoped suppression/restore. ExecutionRepository and OutboxRepository provide durable stages, quotas, leases, retries and delivery recovery.

Raw bytes remain in the M3 private local archive. Metadata/text are private, retention-gated data. No public binary serving or default identities/approvals are seeded. Actor IDs are trusted service context; M5 supplies authentication and M8 provisions DB credential/grant separation.

[M4 acceptance](../../docs/milestones/M4.md), [data model](../../docs/DATA_MODEL.md), [ADR 0008](../../docs/decisions/0008-m4-persistence-and-execution.md).
