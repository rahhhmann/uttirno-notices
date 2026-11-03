# Planned API contract

Design only; no endpoints implemented yet. Version under /v1. OpenAPI and shared runtime schemas become authoritative in M5.

## Public
- GET /v1/jobs: q, authority, category, location, education/skill where extracted, recruitment status, deadline range, stable cursor and bounded page size.
- GET /v1/jobs/:id: published revision, original/normalized fields, unknowns, official destination, permitted document links and timestamps.
- GET /v1/jobs/:id/events: only approved public lifecycle events.
- GET /v1/authorities: public eligible authority filters.
- GET /health/live and /health/ready: no secrets or internal inventory.

No client option can reveal drafts. Public IDs are opaque; stable cursor ordering includes a unique tie-breaker. Response reports stale state. Search never fabricates fields for ranking.

## Internal /v1/admin
Sources/config versions, ownership/access reviews, bounded onboarding proposals, canary/run controls, run health, candidate revisions, field evidence, duplicate candidates, approve/reject/suppress actions and audit views.

Validate identity and role for every action. Review actions include expected revision/version and reason; return conflict on a stale review. Mutations use idempotency where retried. Browser session mutations require appropriate CSRF defenses. Public and admin schemas differ to avoid internal evidence/identity leaks.

## Errors and delivery
Consistent error code/message/request_id; validated payload/query limits, body limits, rate limiting, timeouts. No raw source HTML/model responses/stack traces exposed. Contract tests exercise authorization, unknowns, dates, cursor consistency, publication gates and concurrent approvals.
