# Requirements and acceptance

All rows are required for first production release unless explicitly classified as later scope. Task completion must cite these IDs.

| ID | Requirement | Acceptance evidence |
|---|---|---|
| R01 | Official-only eligibility | Reject Bdjobs, aggregator, suffix-only trust and unverified destinations before acquisition |
| R02 | Access and display gates | Separate ownership, collection permission, robots, technical and republication state; pending/blocked never fetched/published |
| R03 | Safe egress | Every redirect, DNS result, origin/port and download checked; private/local/metadata IPs blocked; explicit reviewed legacy HTTP exceptions only |
| R04 | Respectful acquisition | Per-host policy, default 0.25 requests/s, one acquisition at a time, limits, conditional requests, retry-after/backoff and emergency stop |
| R05 | Generic source config | Add two differently structured sources using fixture-proven config, no core edits |
| R06 | Safe onboarding | Inspect bounded public pages, propose selectors/mappings, validate actual matches and get source approval; no executable generated code |
| R07 | Complete discovery | Accepted samples cover pagination, sibling positions, archives and attachments; visible truncation/failures |
| R08 | Reproducible archive | Permitted original bytes, hash, timestamp, URL, response metadata, config/parser/model versions |
| R09 | PDF/OCR | Text layer/scanned/mixed-language/table fixtures; OCR page locations and quality flags |
| R10 | Full position model | Scope title/vacancies/qualifications/age/salary/experience/district/quota/application conditions to the correct post |
| R11 | Application accuracy | Separate submit/payment deadlines, fees/categories, steps, documents, contact and approved destination |
| R12 | Explicit unknowns | Distinguish stated/not_stated/not_extracted/conflicting/not_applicable; no default zero fee or inferred midnight |
| R13 | Evidence verification | Field-level verbatim snapshot/page/position evidence plus value/meaning checks; derived fields carry tested derivation |
| R14 | Untrusted extraction | No tools/secrets for LLM, constrained schema, budgets, provider boundary and prompt-injection fixtures |
| R15 | Revision and dedupe | Stable issuer/memo/post identity, manual ambiguous merge, raw lineage and reproducible reprocessing |
| R16 | Notice lifecycle | Circular/amendment/extension/cancellation/exam/admit/result events; no cancellation inferred from disappearance |
| R17 | Publication gate | Only approved revision with satisfied critical evidence/access rules public; revoked/suppressed facts absent |
| R18 | Admin permissions | Authn/authz/CSRF/session controls, least privilege, immutable review/source-policy audit |
| R19 | Portal | Responsive Bangla/English rendering, jobs/search/filter/detail, original notice, official apply link, freshness and event history |
| R20 | Public API | Validated pagination/filter/detail/events, consistent errors, public projection only, OpenAPI contract |
| R21 | Scheduling | Source/config version pinned, idempotency, leases, bounded retries, dead letters, rerun/checkpoint |
| R22 | Drift and freshness | Alert on layout/zero-result/critical-field/policy changes; pause affected source; no silent replacement |
| R23 | Privacy and storage | No applicant scraping; minimized public result data; private artifacts and documented retention/takedown |
| R24 | Operations | Environment isolation, secrets, health/readiness, metrics, audit, alerts, deploy/rollback and restore drill |
| R25 | Evaluation | Gold set, two-reviewer adjudication, source/language/PDF slices, critical errors block release |
| R26 | Accessibility/security | Keyboard/focus/forms/mobile, WCAG 2.2 AA target verified by audit; public abuse controls and security checks |
| R27 | New titles | Arbitrary original titles stored without code edits; taxonomy optional and versioned |
| R28 | Permission changes | Expiry/revocation blocks new jobs and applies documented display/retention policy to stored content |
| R29 | Reproducible build | Locked deps, typecheck/build/tests, migration checks and deployment provenance in CI |

## Completion means
No requirement is satisfied by prose, a folder, a mocked success, or the old four prototype tests. Each task records code location and executed test evidence. New scope requires a decision; original official-only rules cannot be weakened by configuration.
