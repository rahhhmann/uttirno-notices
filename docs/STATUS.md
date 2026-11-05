# Current state

Updated: 2026-11-05, after authorized M8 independent development verification.

## Implementation

M0-M6 are complete. M7-T01/T02 passed development acceptance; implementation commit 1f9ac631027172663193077f793ae1d3db1c228e was pushed and its [Linux CI passed](https://github.com/rahhhmann/uttirno-notices/actions/runs/42011353683). [M7 evidence](milestones/M7.md).

M8 independent implementation includes hardened app/parser images and Compose, credential-free network-disabled native parsing, explicit schema 0004 and physical role grants, shared fail-closed Redis quotas, protected aggregate metrics/redacted request correlation, incident monitoring, encrypted isolated restore and measured synthetic HTTP load. [M8 evidence and exact acceptance limits](milestones/M8.md), [ADR0012](decisions/0012-m8-operations.md), [deployment runbook](../infra/deployment/README.md).

Local lint/boundaries/strict types, all builds, 137 unit + four prototype + 48 integration + 12 built browser cases (**201 total**), HTTP smoke and separate actual container/native isolation rehearsal passed. Remote CI must be checked for the exact pushed commit. Services are stopped after verification with volumes retained.

## Acceptance and authorization boundary

**M7-T03 and M8-T01/T02/T03 remain unchecked.** M7 requires a legitimately approved real-source record and full required accessibility acceptance. M8 still needs actual staging host/domain/TLS/proxy/live provider, a retained schema-compatible previous release, actual alert owner/channel delivery, agreed production traffic/SLO/RPO/RTO and offsite key/backup/retention/takedown decisions (Q05/Q06/Q08/Q09/Q10/Q11). Controlled fixtures do not establish production readiness. M7's schema 0003 image cannot be rolled back directly against strict schema 0004 readiness. Group recreation proves restart recovery only.

Implementation is authorized through M8; **STOP before M9**. No recruiting source or live hosting/identity/notification service is activated. [Tasks](TASKS.md), [open questions](OPEN_QUESTIONS.md), [release gates](RELEASE.md).

## Sources, host integration and local data

Real sources remain unsigned disabled candidates with unresolved collection/display/retention evidence. No real staff account, applicant processing or model provider was introduced. Development records/accounts/keys are clearly synthetic and temporary; ordinary checks make no recruiting-site calls. Actual Uttirno repository/router/assets/canonical host remain Q08; public noindex and absent JobPosting remain deliberate. Consumer identity/entitlements/saved jobs/CV/notifications remain outside scope.

PostgreSQL is canonical. Schema 0004 migration is explicit and creates no accounts, approvals or seeds. Root .env remains private/ignored. Dedicated services use 55432/56379/54566 with retained volumes; native PostgreSQL 5432 remains untouched. The existing UI preview task and historical CHAT_HANDOFF.txt are preserved separately from implementation.
