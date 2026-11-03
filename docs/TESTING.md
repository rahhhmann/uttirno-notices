# Test and evaluation plan

## Layers
Co-located unit tests: transforms, dates/numerals, field scoping, transitions, policy, config and evidence checks.
Integration: PostgreSQL transactions/constraints/migrations, queue retry/idempotency/outbox, object storage and restricted fetch boundaries.
Contract: public/admin API and queue/config schema version compatibility.
E2E: source onboarding -> candidate -> review -> approved portal -> official link; pause/revocation/critical amendment journeys.
Extraction evaluation: labelled source/language/format slices and false-positive analysis.

## Fixtures
Synthetic files explicitly marked synthetic; no fake government URLs disguised as real evidence. Real fixtures require source URL, capture time, hash, permission and expected position/document inventory. Current research snapshots are evidence, not automatically trusted gold labels. No network in unit tests; explicitly opted-in source smoke tests stay separate from CI defaults.

## Gold set
Target 150 adjudicated records, including at least 30 Bangla/mixed and 30 PDF-based records, plus amendments and multiple-position circulars. Counts may overlap. Two independent labels with adjudication. A first 50-record exercise is development feedback, not production acceptance. Hold out evaluation examples from prompt/config tuning.

## Proposed release metrics
Core-field exact-match at least 98% overall and per accepted source slice; no observed critical errors or unsupported published factual values in the release set. Requirements extraction F1 at least 0.90, duplicate precision at least 98%. These are acceptance targets, not measured results or guarantees. Report denominators/confidence limitations. Tighten or revise targets through a recorded decision, never quietly lower them.

## Failure fixtures
Wrong sibling qualifications; general fee disclaimer; multiple deadlines; Bangla digits/calendar ambiguity; date-only deadline; stale listings; replaced PDF at same URL; ambiguous merge; OCR corruption; prompt injection; unapproved host/redirect/private IP; revoked permissions; job replay; review race; API draft leak.

## Required checks by phase
M1: dependency/lock consistency, TypeScript, build and workspace boundary checks.
M2-M4: unit + policy/fetch/document integration + evaluation subsets.
M5-M7: API contract/auth + real DB + public/admin browser E2E.
M8-M9: migration/deploy/rollback/restore drills, performance with agreed dataset, release gold set and source canaries.
The existing four prototype tests remain useful regressions, not substitutes.

## M4 acceptance suite

[Persistence](../tests/integration/persistence.test.ts), [lifecycle](../tests/integration/lifecycle.test.ts), [execution](../tests/integration/execution.test.ts) and [worker](../tests/integration/worker.test.ts) exercise actual dedicated loopback PostgreSQL/Redis. Each uses guarded random schemas/queues, ephemeral synthetic roles/keys and explicit cleanup. The worker fixture injects synthetic source transport while using real broker gates, archive, native PDF parsing and persistence. No recruiting-site calls.

Cases include empty/previous-schema/checksum migration, immutable lineage/replay, ambiguous identity review, stale/concurrent review, complete attachments/quality, scoped correction/cancellation/restore, lost Redis messages, worker reconstruction, source lease expiry/stale-token write rejection, revocation/config changes, quotas, long Retry-After and distributed host spacing. This is development acceptance, not a production process-kill/restore/load or gold-set accuracy exercise.
