# Data model and persistence boundaries

PostgreSQL is canonical. Object storage holds permitted bytes. Redis queues/cache are disposable transport, never the sole record of approvals or source policy.

| Persisted M4 table | Purpose and constraints |
|---|---|
| authorities | Issuer identity and official ownership evidence |
| sources / source_config_versions | Policy and immutable reviewed extraction configurations |
| source_policy_reviews | Terms/robots/access/display decisions with scope/expiry/actor/evidence |
| source_runs / stage_runs | Config version, checkpoints, completion coverage, failures and timings |
| artifacts / artifact_text_versions | Original byte hash/URL/response metadata, page text/OCR engine/version/quality |
| circulars / circular_revisions | Issuer memo identity and immutable notice revisions |
| positions / position_revisions | Original title/post code and revision-scoped facts |
| field_evidence | Revision + field path + artifact/text version + page/locator + quote + verification |
| application_routes | Method, verified destination, documents, instructions and fee/deadline evidence |
| recruitment_events | Corrections/extensions/cancellations/exam/admit/result relations and affected scope |
| source_listings / duplicate_candidates | Cross-source lineage, reconciliation and auditable merge decisions |
| review_actions / audit_events | Actor, action, before/after revision IDs, reason and timestamp |
| published_positions | Approved public projection, unique published revision per position |
| outbox_events | Transactional downstream publication/index notifications |
| admin_identities / admin_roles | Internal actor/role registry; authenticated identity binding is M5, no default accounts/passwords |

## Factual value envelope
Each populated field carries original value/language, normalized value, status, evidence references and verification result. Status is one of stated, not_stated, not_extracted, conflicting, not_applicable. Arrays carry field status too: [] cannot mean both absent and zero requirements.

Dates preserve raw string, calendar/date precision, timezone and explicitly stated time. Fee currency and service charges stay separate, as do application and payment deadlines. Age rules carry reference date and category exceptions. Titles/taxonomy remain separate; classifications are labelled derived.

## Lifecycle axes
Source: candidate, in_review, active, paused, disabled. Access: unknown, permitted_public, approved_api, permission_pending, manual_only, blocked. These do not automatically grant display rights.
Revision review: draft, needs_review, approved, rejected, superseded.
Recruitment status: upcoming, open, closed, cancelled, unknown; derive dates only where sufficient. Exam/result events do not change a closed application to open.
Freshness: last_checked, last_successful_fetch, last_verified; visible stale flag.

## Consistency
Artifact hash deduplicates bytes, not jobs. Logical IDs do not depend on source URL alone. Merge only with adequate issuer/memo/post evidence; ambiguous candidates require review. A new revision never deletes earlier evidence. All publication writes occur with revision checks inside a transaction to avoid approval races.

## Migrations
Forward migrations are reviewed and tested from an empty DB and the previous supported schema. Use expand/contract for public service changes. Rollback application compatibility is tested; destructive data rollback is not assumed. Seeds are synthetic only; never bootstrap real approvals.

## Implemented M4 constraints

See [authored SQL](../packages/database/migrations) and [typed Drizzle models](../packages/database/src/schema.ts). Additional artifact_captures, resource_leases and host_windows preserve capture-specific permissions, source fencing and distributed host state. Immutable history includes raw text, source configs, revisions, evidence, routes, reviews and audits. Source/post/circular/stage identity and pinned run inventory have DB guards.

Public projection writes require a distinct authorized reviewer, current circular generation and an approved/restored review action. Pending critical events and cancelled posts cannot be silently made visible. Repository transactions also reproduce immutable field evidence, verify live external trust/display/retention and complete discovery/attachment/post coverage. A view plus signature-gated repository serves approved unsuppressed rows only; M5 will add the actual public HTTP/query contract.

Database bytes deduplicate artifacts, never logical jobs. Default canonical identity uses reviewed issuer plus memo plus original post code; missing/ambiguous identities wait for audited manual resolution. Independent reprocessing creates a new draft when content/config/plan changes; replay of the same bundle/inventory is idempotent. [M4 acceptance and limits](milestones/M4.md).
