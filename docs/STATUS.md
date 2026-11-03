# Current state

Updated: 2026-11-03.

## Completed
- Research snapshots and four passing prototype regression tests exist.
- M0 planning scaffold: component boundaries, requirements, architecture decisions, source policy, adaptation, data/evidence contracts, task sequence, testing and release gates.
- Legacy collection defaults disabled during planning.

## Not implemented
Production workspace/toolchain, generic adaptation engine, full PDF/OCR extraction, DB/migrations, production queue/scheduler, authenticated admin/API, public portal, deployment, restore and release evaluation.

Existing source-specific prototype logic is intentionally not represented as satisfying the future no-core-hardcoding requirement. M1 migrates it into a clearly labelled research area. Current source configs are not approved production configs.

## Next step
On implementation authorization: M1-T01, then M1-T02 and M1-T03. Read [tasks](TASKS.md). Do not start with portal mockups or broad crawling ahead of the pipeline gates.

## Executed M0 checks
- Existing `npm test`: 4/4 prototype regressions passed; no live source calls.
- Local Markdown link check: 79 Markdown files scanned, 0 broken relative links.
- Requirements trace check: all R01-R29 present in requirements and task plan.
- Task state: 3 completed planning tasks; 31 implementation tasks remain unchecked.
- Source registry parses as JSON; both prototype sources disabled; editor diagnostics report no JSON errors.
- No production code, framework installation, database, deployment or real-world extraction acceptance was performed in M0.
