# ADR 0001 — TypeScript monorepo with narrow runtime boundaries
Status: accepted planning decision; concrete versions pending M1.

Context: Both agent and portal are required; the existing prototype is Node, and avoidable cross-language business-rule duplication would complicate development.

Decision: Next.js portal/admin, Fastify API, TypeScript agent and worker, PostgreSQL/Drizzle, Redis/BullMQ, private S3-compatible artifacts and npm workspaces. Deploy API/worker/web separately while sharing contracts/domain/persistence. Choose OCR engines through a benchmark, with a process/service boundary for Python/native tools if necessary.

Consequences: shared schemas and simpler toolchain; browser/OCR work still needs isolated resources. Do not deploy five independent microservices per extraction stage. Exact versions verified at M1. This is our design choice, not a claim that the reference report requires this stack.
