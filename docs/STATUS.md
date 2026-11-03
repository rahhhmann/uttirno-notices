# Current state

Updated: 2026-11-03.

## Completed
- M0 planning and M1 executable foundations. [M1 report](milestones/M1.md).
- M2-T01–T04 source trust, secure acquisition, configurable adaptation and observed source drafts. [M2 report](milestones/M2.md).
- Signed official-source configs with external trust keys, expiry/revocation/sample gates; independent collection/display policy; separately configured global marketplace exclusions.
- Pinned-DNS broker, robots, redirects, budgets/backoff/conditional requests, shared per-process host limiter and offline brokered Chromium.
- Config-driven HTML/JSON parsing, scoped fields, pagination/details/siblings, attachment inventory and always-reviewable onboarding proposals.
- 96 unit + 4 prototype + 6 real integration cases passed; builds, lint/types, HTTP smoke and CLI preview/input bounds passed.
- M1 remote CI was independently checked and succeeded. M2 remote CI must be checked against its own commit/run.

## Sources and data
Both real M2 configs are unsigned candidates, not enabled sources. Collection/display remain unresolved. External storage references are quarantined. Alljobs remains permission-pending. Prototype sources remain disabled.

No production source crawl was enabled. Manual public research and minimal offline DOM fragments are recorded separately. No PDF/OCR/full job facts or published vacancies are claimed.

Native PostgreSQL on 5432 remains separate. Development containers use 55432/56379/54566 and retained volumes. Root .env is local/ignored; no credentials or signing private keys in Git. See [development setup](DEVELOPMENT.md).

## Remaining
M3-M9: PDF/OCR and structured evidence-verified extraction, persistent document/job schema/revisions/publication, queues/distributed leases, authentication/admin workflows, public job features and deployment/release evaluation. Portal/Admin still show foundation notices; API has health routes only.

## Approval boundary
M2 is complete. STOP. M3 requires explicit user authorization.
Once authorized, begin M3-T01 in the [task plan](TASKS.md). Model/session changes do not grant permission for later milestones.

## Conditions to preserve
One acquisition broker process until distributed host leases are implemented. No source activation just to make a demo pass. A source approval signature is never a substitute for actual ownership/permission/fixture review. Read [M2 limits](milestones/M2.md) and [open questions](OPEN_QUESTIONS.md).
