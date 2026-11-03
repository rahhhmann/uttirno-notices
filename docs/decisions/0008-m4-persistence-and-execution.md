# ADR 0008 — Durable revisions, review transactions and worker recovery

Status: accepted for M4. M5 is not authorized.

## Decision

PostgreSQL owns source/config history, artifact/text lineage, logical notice/post identities, draft revisions, events, reviews, approved projections, run/checkpoints and transactional outbox records. Typed Drizzle definitions expose core tables; explicit authored SQL migrations own cross-table constraints, indexes and history/publication triggers. Migrations run deliberately, under an advisory lock with checksummed ordered history. Connecting never migrates or seeds accounts, permissions or jobs.

Use exact reviewed issuer binding plus NFC/whitespace-normalized memo and original post code for automatic reconciliation. Neither URL, byte hash nor title alone identifies a job. Changed same-URL bytes yield a new immutable draft; identical bundle/config/inventory replays reuse the existing draft. Missing/ambiguous identity creates an auditable human-resolution candidate. Manual resolution preserves original field evidence and records reviewer/reason; it does not invent an official post code.

Publication is a separate two-person review transaction. Lock source and circular, compare expected generation, load immutable persisted text, reproduce M3 fields, check discovery/attachment/post inventory, scope/quality/application destinations, verify current external signature/display permissions and commit review/projection/outbox together. Link-only permission cannot copy full fields. Pending critical events suppress only their affected positions. Replacement evidence must include the correcting event document for each affected post; approving old evidence cannot clear the correction. Explicit cancellation approval is terminal in this event vocabulary. Disappearance/fetch failure never means cancellation. Restore requires a new reviewed decision and exact published revision/generation.

Actor registry/roles are service-side prerequisites, not authentication. Worker receives an operator identity and cannot pass reviewer checks or approve its own output. M5 must bind these actor IDs to authenticated identities; M8 must provision separate DB credentials/grants. Development owner credentials are not a production privilege boundary.

Use BullMQ 6.5.4 as disposable Redis delivery. Queue data contains only a durable stage ID. PostgreSQL pins run/config/stage/input identity, attempts, checkpoint, availability and source leases. A 45-second source lease with 10-second renewal and unique tokens fences stale writes/checkpoints/completion. Artifact/draft writes from worker stages recheck the token inside their DB transaction. Expired work is recoverable; bounded attempts end in durable dead letters. Manual rerun records its actor/reason. Dependencies and one document fan-in are created with stage outbox entries in the same completion transaction. Outbox acknowledgements have separate lease tokens.

Worker reconstruction after lost messages reads PostgreSQL, so Redis loss cannot erase canonical work. Publication/suppression outbox entries remain pending for future consumers; M4 does not pretend to send notifications or update a nonexistent search service.

Per-host acquisition uses a shared local serializer plus PostgreSQL session advisory locking, start intervals and a 120-second crash/error reservation. The reservation exceeds the broker's bounded DNS/request window. Lost host sessions fail closed and remaining reservation prevents immediate overlapping takeover. Retry-After propagates into host/source cooldowns and durable availability without shortening a long server-requested delay. Aggregate request/byte budgets survive stage/retry boundaries. All HTTP/browser requests still pass M2 permission/robots/origin/DNS/IP gates.

Source schedules default to 6-hour discovery; every stage reloads current policy/keys. Config changes block old queued work. Drift pauses collection and records an audit; it does not erase previously approved unrelated data. Automatic document processing additionally requires signed jobNoticeOnly scope and exact artifact-bound operator plans. Missing plans or changed artifacts pause for review. Configurable memo/event labels carry meaning; unknown event prose is not silently classified.

## Consequences and limits

The implemented extraction grammar remains M3's reviewed labelled lines/ranges. Complex prose/table/footnote inheritance and real source accuracy still need source-specific acceptance. Supporting attachments require explicit applicability and quality review; they cannot silently supply fabricated fields.

M3's private local immutable archive remains the raw-byte backend. PostgreSQL stores permitted text/metadata, not public binary downloads. Production S3/OS isolation, credential separation, retention purge, restore/load and adjudicated real-source acceptance remain release gates. Expiry/revocation denies new processing/public serving; it does not claim that historical private bytes have already been purged. Standalone agent CLI retains its single-broker operating constraint; multi-process collection must use the shared-database worker.

References: [BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs), [job IDs](https://docs.bullmq.io/guide/jobs/job-ids), [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).
