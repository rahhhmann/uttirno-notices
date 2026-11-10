# Current state

Updated: 2026-11-10, for authorized M9/local handover work.

## Current handover work

Latest five-source real sweep: BPSC authority (3 PDFs/29 pages), BPSC Teletalk non-cadre (2/18), BCC own notice (1/1), Bangladesh Bank main authority recruitment notices/TOR (3/4), and representative public university BUET (2/4) all completed broker collection/text extraction in one run: **11 linked PDF copies, 56 pages, nine unique hashes**. [Sanitized provenance](milestones/M9-source-matrix.json), [M9 scope/results](milestones/M9.md), [Bangla local command](LOCAL_REAL_TEST.bn.md). Bank e-Recruitment separately rejected requests and remains unaccepted. No whole-site/all-university coverage, approved factual extraction or real-source publication is claimed; M9 acceptance checkboxes remain open.

`npm run sources:live` now performs the configured sequential local tests and generates aggregate/individual private reports. Sources are independently assessed, expiring and explicitly local-signed; registry activation is not production startup. The command uses system CA trust with TLS verification retained. Generic custom attachment attributes and exact-root path rules are fixture-tested; website-specific URLs/selectors remain configuration.

Latest sweep verification passed check/types/lint/boundaries, every build, **150 unit + four prototype + 48 integration + 12 browser cases (214 total)**. Full integration including restore cleanup passed in this run. The actual-network source matrix is separate from ordinary synthetic/offline tests. Actual position/field mapping and a genuinely approved real-source staff/public journey remain unfinished; raw text extraction does not close M9.

Latest user policy change: [ADR0013](decisions/0013-public-official-access.md) permits operator-assessed official public-source collection without a universal permission-letter prerequisite. The new opt-in seven-day BPSC local config has a distinct public-access basis, exact three attachment paths and a reviewed missing-robots 404/410 policy; local signing identifies the user's delegated operator decision, not external consent. Automated broker discovery/private PDF extraction/review reporting is implemented. Earlier source-permission blockers below describe the prior policy and are superseded for this local scope. Actual position mapping/review, public release and live operations remain separate.

Actual BPSC broker run now succeeded for the configured one-page slice: three original PDFs, **29 pages (8/10/11)** archived and text-extracted into an ignored private review report; the combined notice's page 6 used bounded OCR after an observed text-layer geometry failure. A generic config-driven embedded-HTML decoder fixed the actual current layout. Nothing was published and positions/fields remain unmapped pending original-document/user review. See [M9 live evidence](milestones/M9.md).

Latest verification: builds/types/lint/boundaries, 147 unit + four prototype + 12 browser cases passed. Full integration was 47/48 due to a temporary restore database cleanup statement timeout; the isolated restore retry passed unchanged and verified failed-run temporary database/schema leftovers were removed. All 211 distinct automated cases were verified across those runs; the original cleanup failure remains documented. These checks and real 29-page acquisition do not close factual/source/public-journey or production release gates.

### Earlier handover checkpoint, before the revised public-access policy

The user selected BPSC and volunteered to review. [Bounded public-page research](research/BPSC-2026-11-10.md) found the existing non-cadre seed's three document links; robots returned 404 in the research tool. At that earlier checkpoint, permission/robots decisions were unresolved and no PDF/automated collector had run. The current opt-in local assessment and actual run above supersede that blocker for this slice.

The user authorized real-case M9 testing and a locally testable pipeline/lead handover on 2026-11-10. This supersedes the historical stop-before-M9 boundary below; it does not complete unresolved M7/M8 acceptance. [Pipeline handover](PIPELINE_HANDOFF.md) describes the new local manual review-to-portal rehearsal and safely imported Google-client configuration. [M9 work/evidence](milestones/M9.md) records current checks and blockers.

The supplied OAuth JSON and generated local configuration are ignored; no credentials were committed. Real Google discovery/authorization construction passed, but interactive login and owner-verified staff subject binding remain undone. No recruiting website acquisition, real notice approval or source signing has been performed: collection/display/retention permissions remain unresolved. Real-source acceptance, arbitrary-layout extraction, gold-set adjudication and actual Uttirno-host integration remain unproven.

Current local verification passed: check/build, 138 unit + four prototype + 48 integration + 12 browser cases (**202 total**). The new local command also passed an actual browser draft-to-manual-approval-to-two-position portal rehearsal; cleanup was checked and a fresh synthetic rehearsal started for user testing. These results do not close M7-T03/M8/M9 live gates. Remote CI and deployment containers were not rerun for this change.

## Implementation

M0-M6 are complete. M7-T01/T02 passed development acceptance; implementation commit 1f9ac631027172663193077f793ae1d3db1c228e was pushed and its [Linux CI passed](https://github.com/rahhhmann/uttirno-notices/actions/runs/42011353683). [M7 evidence](milestones/M7.md).

M8 independent implementation includes hardened app/parser images and Compose, credential-free network-disabled native parsing, explicit schema 0004 and physical role grants, shared fail-closed Redis quotas, protected aggregate metrics/redacted request correlation, incident monitoring, encrypted isolated restore and measured synthetic HTTP load. [M8 evidence and exact acceptance limits](milestones/M8.md), [ADR0012](decisions/0012-m8-operations.md), [deployment runbook](../infra/deployment/README.md).

The historical M8 verification passed lint/boundaries/strict types, all builds, 137 unit + four prototype + 48 integration + 12 built browser cases (**201 total**), HTTP smoke and separate actual container/native isolation rehearsal. Remote CI must be checked for the exact pushed commit. Services were stopped after that historical verification with volumes retained; subsequent local handover checks restarted them.

## Acceptance and authorization boundary

**M7-T03 and M8-T01/T02/T03 remain unchecked.** M7 requires a legitimately approved real-source record and full required accessibility acceptance. M8 still needs actual staging host/domain/TLS/proxy/live provider, a retained schema-compatible previous release, actual alert owner/channel delivery, agreed production traffic/SLO/RPO/RTO and offsite key/backup/retention/takedown decisions (Q05/Q06/Q08/Q09/Q10/Q11). Controlled fixtures do not establish production readiness. M7's schema 0003 image cannot be rolled back directly against strict schema 0004 readiness. Group recreation proves restart recovery only.

The prior through-M8 authorization boundary was superseded by the 2026-11-10 request above. No recruiting source or live hosting/notification service is activated. [Tasks](TASKS.md), [open questions](OPEN_QUESTIONS.md), [release gates](RELEASE.md).

## Sources, host integration and local data

Original source drafts remain unsigned disabled candidates. The separate BPSC opt-in local assessment is signed only in ignored local files and has now collected/extracted real notice PDFs privately. No real staff account, applicant processing or model provider was introduced. Synthetic demo records/accounts remain distinct from these actual source artifacts; ordinary unit/integration/browser tests make no recruiting-site calls. Actual Uttirno repository/router/assets/canonical host remain Q08; public noindex and absent JobPosting remain deliberate. Consumer identity/entitlements/saved jobs/CV/notifications remain outside scope.

PostgreSQL is canonical. Schema 0004 migration is explicit and creates no accounts, approvals or seeds. Root .env remains private/ignored. Dedicated services use 55432/56379/54566 with retained volumes; native PostgreSQL 5432 remains untouched. The existing UI preview task and historical CHAT_HANDOFF.txt are preserved separately from implementation.
