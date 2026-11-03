# Durable stages — M4

[Runtime](../runtime.ts) validates DB-pinned job payloads and uses PostgreSQL source leases/checkpoints/retries/dead letters. [Handlers](../handlers.ts) connect discovery, private document extraction and one reconciliation fan-in. Dependents and outbox entries are committed before dispatch.

Redis acknowledgements are disposable. Recovery re-enqueues canonical queued/retry/expired work, and stale tokens cannot commit. No handler can approve publication. Tests use a synthetic source transport with real DB/Redis/native PDF parsing; no recruiting-site requests. [M4 report](../../../../docs/milestones/M4.md).
