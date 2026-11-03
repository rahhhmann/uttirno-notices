# Architecture

## Stack decision
Target: TypeScript across portal/admin/API/agent/worker; Next.js for the two browser apps; Fastify API; PostgreSQL with Drizzle-managed persistence; Redis/BullMQ for jobs; Playwright for necessary public rendering; S3-compatible object storage for permitted artifacts. Use npm workspaces initially to keep tooling lean. Exact maintained, mutually compatible versions must be checked and locked at M1, not guessed here.

M3 selected native Poppler bbox text and Tesseract ben+eng TSV behind a bounded subprocess contract, using synthetic hybrid/OCR-only benchmarks. Binary/model fingerprints and text versions are recorded. Layout/legacy-font/real-source accuracy and production OS isolation remain acceptance gates; see [ADR 0007](decisions/0007-m3-document-extraction.md). Business rules remain in TypeScript domain/contracts, not duplicated in native tools.

Search starts in PostgreSQL with Bangla Unicode/title-alias evaluation. Add a dedicated search service only after measured requirements. No Kubernetes, independent service per pipeline stage, or vector database is required for the first release.

## Data flow
```mermaid
flowchart LR
  Registry[Reviewed source configuration] --> Scheduler[Worker scheduler and access gates]
  Scheduler --> Agent[Agent acquisition and discovery]
  Agent --> Archive[Permitted immutable artifacts]
  Archive --> Extract[Text / OCR / structured extraction]
  Extract --> Verify[Evidence and semantic checks]
  Verify --> Draft[Draft revisions and review queue]
  Draft --> Admin[Admin review through API]
  Admin --> Published[Approved public projection]
  Published --> API[Public API]
  API --> Portal[Uttirno portal]
```

Agent produces candidates, never published facts. API owns authenticated review/publication transactions. Worker orchestrates agent stages; it cannot approve its own output. The agent application also exposes an operator CLI for a bounded single-source run.

## Transaction boundaries
Persist run/checkpoint/artifact metadata before dispatching dependent stages. Use job IDs based on source/config version, stage and artifact/revision identity. At-least-once delivery requires idempotent handlers, DB uniqueness and leases. Use a transactional outbox for publication/search-index events; queue delivery must not determine source-of-truth correctness.

Only explicit approved revisions enter the public projection. Re-extraction creates a draft. A credible cancellation/critical correction can suppress affected published facts pending review; unrelated jobs stay available. A failed fetch never erases approved data; show verification freshness.

## Security boundaries
API roles: operator, reviewer, source approver, administrator. Separate publish/source-policy privileges; record actor and decision. Use established authenticated sessions/identity provider selected at M5, secure cookies/CSRF where applicable, authorization on each mutation.

Network acquisition runs in a restricted worker boundary with an explicit egress policy, redirect revalidation, DNS/private-address protections and resource limits. Signed PDF/object downloads cannot bypass those controls. Object storage is private by default; approved download/display permissions govern public access.

## Environments
Local, staging and production use separate DB/Redis/buckets/secrets/source permissions. Staging uses fixtures by default. No real crawl merely because the web server starts. No application requires an LLM key for ordinary portal reads or deterministic extraction.

## M4 execution boundary

[ADR 0008](decisions/0008-m4-persistence-and-execution.md) records the implemented repositories, authored/checked SQL migrations, generation-checked two-person publication, scoped critical suppression, BullMQ 6.5.4 transport, durable DB leases/checkpoints/outbox and distributed host quotas/cooldowns. Multi-process acquisition must use the shared-DB worker. Logical actor roles are implemented; authenticated API identity and production DB credential/grant separation remain M5/M8. No real source or default actor is activated by migration/startup.
