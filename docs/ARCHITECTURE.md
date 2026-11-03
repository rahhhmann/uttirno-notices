# Architecture

## Stack decision
Target: TypeScript across portal/admin/API/agent/worker; Next.js for the two browser apps; Fastify API; PostgreSQL with Drizzle-managed persistence; Redis/BullMQ for jobs; Playwright for necessary public rendering; S3-compatible object storage for permitted artifacts. Use npm workspaces initially to keep tooling lean. Exact maintained, mutually compatible versions must be checked and locked at M1, not guessed here.

PDF text and Bangla/English OCR are capability interfaces. Choose concrete engines through the M3 benchmark, including text layer, fonts, layout, tables, scanned PDFs and sandboxing. If Python/native tooling wins, isolate it behind a document-extraction process/service contract; do not maintain duplicate business rules in two languages.

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
