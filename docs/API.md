# API contract ? M5

Implemented under /v1. GET /v1/openapi.json generates OpenAPI 3.1 from route schemas. Runtime [DTOs](../packages/contracts/src/api.ts), server validation and [typed clients](../packages/api-client/README.md) govern transport. No source fetching occurs on public queries.

## Public

- GET /v1/jobs: q, authority, category, location, education, skill, status, deadlineFrom, deadlineTo, cursor and limit (default 20, maximum 50).
- GET /v1/jobs/:id: approved unsuppressed position, all 17 field envelopes, scoped evidence and permitted original document links.
- GET /v1/jobs/:id/events: approved lifecycle events; verified cancellation timeline may survive suppressed job facts. Hidden/pending facts are never returned.
- GET /v1/authorities: authorities with eligible approved projection rows.
- GET /health/live and /health/ready: process/dependency and schema readiness, sanitized.

Unknown query keys are rejected. Literal Unicode NFC search and configured aliases never rewrite original titles. Categories explicitly identify derived taxonomy/version. Date-only deadlines preserve date precision; unknown opening/status is not invented. Freshness reports last checked/verified times. HMAC cursors bind scope, filters, taxonomy and initial publication cutoff, ordered by stable UUID, expiring after 15 minutes. Concurrent republication may remove a record from a cursor window; current suppression/permission always wins. A page scans at most 1000 candidate rows and may continue with an empty page/cursor when filters exclude the bounded scan.

## Administrative

GET auth/login and auth/callback perform fixed-redirect OIDC; GET session supplies roles and session-bound CSRF; POST auth/logout revokes the session. No HTTP bootstrap. The explicit owner CLI provisions the first issuer/subject administrator. See [development](DEVELOPMENT.md) and [ADR 0009](decisions/0009-m5-api-and-identity.md).

GET sources, runs, stages, revisions, duplicates and events lists are bounded/cursor-based. GET audit is administrator-only. GET sources/:id returns configuration; GET revisions/:id returns reviewer-only immutable evidence and an attestation template. Empty quality/support review maps are not automatic approval. GET documents/:version returns permitted immutable extracted text, never arbitrary file paths or binary storage credentials.

POST authorities and sources register reviewed signed data; sources/:id/controls and sources/:id/runs control/schedule; runs/:id/rerun retries; revisions stages drafts; revisions/:id/approve or reject applies independent review; duplicates/:id/resolve records identity decisions; events records and events/:id/decision reviews lifecycle evidence; positions/:id/restore or suppress controls scoped public facts. identities provisions issuer/subject roles and identities/:actor/disable disables/revokes. No acquisition/submission/payment tools are exposed.

All mutations require an authenticated authorized session, exact configured Origin, X-CSRF-Token and a UUID Idempotency-Key (logout omits idempotency). Bindings are explicit, not inferred from provider role/email claims. Actor payloads are rejected. Reviewer/admin can publish; operator/admin schedules/stages; source_approver/admin manages source policies; administrator alone manages identities/audit. Repositories recheck session and role within write transactions. Domain review/evidence/source gates remain mandatory.

## Errors and limits

Errors are {error:{code,message,requestId}} without source HTML, provider tokens, SQL or stack traces. Invalid schemas return 400; unauthenticated 401; forbidden/origin/CSRF 403 (missing required headers 400); unknown public IDs 404; stale review/idempotency/last-admin conflicts 409; body limit 413; policy/evidence rejection 422; rate limit 429; unavailable dependencies 503. Bodies max 2 MiB, pages max 50, process-local IP quota 120/minute, cursor lifetime 15 minutes. Sessions idle after 15 minutes and absolutely expire after eight hours. API responses use no-store, nosniff and exact credentialed admin CORS; clients cap public/private response sizes. Production proxy/distributed quotas and measured SLOs remain M8.
