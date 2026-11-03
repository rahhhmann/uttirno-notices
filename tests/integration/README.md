# integration

Real local DB/queue/object-store, acquisition boundary, contracts/migrations/outbox and permission tests. No source network by default.

Implemented through M4: dedicated loopback PostgreSQL/Redis/S3, bounded HTTP/offline Chromium, native PDF/OCR, migrations/history, roles/review/coverage/lifecycle and durable queue/outbox recovery. Run npm run test:integration after local services are ready. M4 schemas/queues are random, guarded and cleaned; notices/keys/actors/transport are synthetic. No live recruiting sites. [M4 report](../../docs/milestones/M4.md).
