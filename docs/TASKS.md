# Dependency-ordered implementation plan

State: M0, M1 and M2 are complete. STOP after each milestone; M3 requires explicit user authorization. Each later checkbox requires implementation, tests and recorded acceptance evidence, not simply existing folders. Sequential milestone order below; tasks within a milestone may proceed independently only when their listed dependencies permit. No delegated agents unless explicitly authorized.

## M0 — Specification and scaffold
- [x] M0-T01: Document scope, R01-R29, component structure and ADRs.
- [x] M0-T02: Specify onboarding/adaptation, evidence/data model, UI/API and security.
- [x] M0-T03: Create physical folder contracts, release/test/runbooks and honest status; validate links and JSON; preserve prototype regressions.

## M1 — Executable foundation (after implementation authorization)
- [x] M1-T01: Confirm supported compatible stack versions; create npm workspaces, strict TypeScript and real app/package manifests. Acceptance: clean install from lockfile, workspace boundary check and minimal builds. R29; read DEVELOPMENT and ADR0001.
- [x] M1-T02: Migrate prototype to research/prototype, maintain research provenance and four existing tests; update root scripts/links. Depends T01. Acceptance: regressions pass, no production module imports prototype; disabled acquisition retained.
- [x] M1-T03: Implement contracts/domain and local DB/Redis/object-store setup, env validation and CI foundation. Depends T01. Acceptance: deterministic runtime config failures, local dependency readiness and minimal CI build/tests. R12/R24/R29.

## M2 — Source trust and easy adaptation
- [x] M2-T01: Source/config/policy schemas and versioning; official/access/display gates. Depends M1. Acceptance: ineligible, pending, expired and revoked configs fail before network. R01/R02/R05/R28.
- [x] M2-T02: Restricted fetch/render/download boundary with robots, host-wide throttling, redirects/DNS/private-IP/resource checks. Depends T01. Acceptance: each bypass path denied, retries respect permissions and limits. R03/R04.
- [x] M2-T03: Generic list/table/card/detail/public-JSON primitives, pagination and sibling navigation; bounded onboarding proposals. Depends T02. Acceptance: two different synthetic layouts configured without core edits; invented selectors rejected. R05/R06/R07/R27.
- [x] M2-T04: Real source research/config draft and drift expectations. Depends T03 and source access evidence. Acceptance: observed listing/detail/attachment samples, exact origins, default disabled and reviewed permissions.

## M3 — Documents, structured extraction and verification
- [ ] M3-T01: Immutable artifact/text storage; PDF/text/OCR benchmark and selected engine. Depends M2-T02 + M1 contracts. Acceptance: hashes/page provenance, limits, malformed/scanned/mixed text fixtures and benchmark report. R08/R09/R23.
- [ ] M3-T02: Position-scoped field extraction and value envelopes; deterministic dates/fees/age/transforms. Depends T01 + M2-T03. Acceptance: multi-position/footnote/fee/deadline cases and explicit unknowns. R10/R11/R12.
- [ ] M3-T03: Optional constrained LLM provider, versioned prompts/budgets and injection tests. Depends T02. Acceptance: no tools/secrets, invalid/unsupported output rejected and deterministic path works without API keys. R14.
- [ ] M3-T04: Evidence and semantic verifier, conflicts and attachment/position coverage gates. Depends T02/T03. Acceptance: wrong sibling, false quote meaning and partial extraction cannot pass publication eligibility. R07/R13.

## M4 — Persistence, lifecycle and reliable execution
- [ ] M4-T01: DB schema/repositories/migrations implementing DATA_MODEL. Depends M3 contracts. Acceptance: empty/previous-schema migration tests, uniqueness and immutable revision history. R08/R15/R29.
- [ ] M4-T02: Deduplication/reconciliation and official amendment/event handling. Depends T01 + M3-T04. Acceptance: changed same-URL PDF creates revision, disappearance not cancellation, ambiguous merge queued. R15/R16.
- [ ] M4-T03: Worker scheduling/leases/idempotent stages/checkpoints/retries/dead letters. Depends T01 + M2 access. Acceptance: retry/restart/concurrent run/revocation tests. R21/R22.
- [ ] M4-T04: Approval/publication/suppression transaction and outbox. Depends T02/T03. Acceptance: unreviewed revision never replaces live, concurrent stale approvals rejected, critical correction suppresses affected facts. R17/R28.

## M5 — Backend API and identity
- [ ] M5-T01: Public API/read projection/search/cursors/OpenAPI. Depends M4-T04. Acceptance: approved-only queries, safe errors, unknowns, Bangla search and cursor tests. R19/R20.
- [ ] M5-T02: Admin authentication/roles/session/CSRF and mutation APIs. Depends M4-T04 + identity decision. Acceptance: role matrix, policy gates, review race and audit tests. R18/R23/R26.
- [ ] M5-T03: API clients and end-to-end contract/integration tests. Depends T01/T02. Acceptance: DB-backed source->review->publish->read scenario, no direct UI DB access.

## M6 — Admin interface
- [ ] M6-T01: Source onboarding/sample/config/policy review, canary/enable/pause controls. Depends M5. Acceptance: unsupported source cannot be activated; accessible real state transitions. R02/R06/R18.
- [ ] M6-T02: Position/evidence/document/conflict review, duplicates and revision publication. Depends T01. Acceptance: reviewer compares original page, rejects mismatch and publishes a correct revision. R13/R15/R17.
- [ ] M6-T03: Health/run/audit screens, expiry and drift actions. Depends T01/T02. Acceptance: failure replay and critical amendment flows; admin E2E tests. R18/R22/R24.

## M7 — Public portal
- [ ] M7-T01: Shared tokens/components, responsive Bangla/English portal shell, jobs/search/filter states. Depends M5-T03. Acceptance: live API fixtures, keyboard/mobile and Unicode checks. R19/R26.
- [ ] M7-T02: Complete job details, source/evidence links, official apply destination, freshness and event history. Depends T01. Acceptance: unknown/conflicting/closed/revoked scenarios; only approved facts visible. R11/R17/R19.
- [ ] M7-T03: Browser E2E and accessibility audit with one approved real source record. Depends T02 + M6. Acceptance: candidate and admin journeys, no internal/draft data leaks. R19/R26.

## M8 — Deployment and operations
- [ ] M8-T01: Real container/service definitions and staging deployment workflow, secret/env separation and migration rollout. Depends M5-M7. Acceptance: reproducible staging build, readiness and compatible rollback. R24/R29.
- [ ] M8-T02: Metrics/traces/alerts/cost controls, source kill switch and incident drills. Depends T01. Acceptance: injected failure triggers expected owner alert and runbook recovery. R04/R22/R24.
- [ ] M8-T03: Backup/restore, retention/takedown, security review and realistic load/SLO measurement. Depends T01/T02 + hosting/volume decisions. Acceptance: isolated restore report, measured targets and fixed critical issues. R23/R24/R26.

## M9 — Source acceptance and release
- [ ] M9-T01: First BPSC authority/application pair research->config->canary->full inventory->review->portal verification. Depends M2-M8 + legitimate source access. Acceptance: source approval evidence, correct all positions/docs in accepted notices.
- [ ] M9-T02: Additional BCC/BB/government/university sources onboard independently with same gates. Depends T01. Acceptance: each passes its own fixtures/canary/policy; blocked sources stay disabled. Alljobs requires its own consent.
- [ ] M9-T03: Adjudicated gold-set evaluation, source-slice metrics and real regression suite. Depends T01 and accepted sources. Acceptance: TESTING targets and no release-set critical errors. R25.
- [ ] M9-T04: Requirements-to-code/test audit, release-gate report and production rollout. Depends T03 + RELEASE checklist. Acceptance: recorded build/config/test/restore provenance and bounded real source smoke; honest source coverage.

## Completion record
When completing a task append: task ID; requirement IDs; code locations; exact checks and observed results; known limits; decisions changed. Leave blocked/deferred tasks unchecked with an OPEN_QUESTIONS reference. Do not check M9-T02 for sources that are still pending.

## M1 completion evidence
M1-T01 (R29), M1-T02 (prototype isolation/provenance), and M1-T03 (R12/R24/R29) completed. Code locations and executed results: [M1 verification](milestones/M1.md). Next milestone requires explicit user permission.

## M2 completion evidence
M2-T01 (R01/R02/R05/R28), M2-T02 (R03/R04), M2-T03 (R05/R06/R07/R27), M2-T04 (observed draft configs and access assessment) completed. Code/test trace and source limitations: [M2 verification](milestones/M2.md). M3 needs explicit permission.
