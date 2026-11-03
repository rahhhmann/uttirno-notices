# Current state

Updated: 2026-11-03.

## Completed
- M0 specification, architecture, source policy, adaptation plan and release gates.
- M1-T01/T02/T03 executable foundation; see [verification results](milestones/M1.md).
- Root workspace/toolchain/lockfile; all five application foundations and six shared packages build.
- Typed facts/evidence/unknowns, environment validation, layer boundary checks, development services and CI definition.
- Prototype moved to [research workspace](../research/prototype/README.md); four original regressions preserved and both sources remain disabled.
- 18 unit + 4 prototype + 3 real integration tests passed; built API/Portal/Admin HTTP smoke and two configuration CLIs passed.
- Root ignored .env exists locally with isolated development credentials. No credentials in Git.

## Runtime and data
Native PostgreSQL on port 5432 is untouched. Separate container services use 55432/56379/54566 and retained volumes. No application schema migrations or production seeds exist. Changing DATABASE_URL never copies data or creates tables. Follow [development setup](DEVELOPMENT.md) to start/check/stop services.

## Not implemented
M2-M9: production source trust/adaptation/fetch boundaries, PDF/OCR and job extraction, job schema/revisions/publication, queues/schedules, authenticated admin APIs/workflows, public job features and production deployment/release evaluation.

Portal/Admin currently show honest foundation notices. API has health routes only. Agent/worker support configuration checks only. No public job listing or admin mutation exists.

## Approval boundary / next step
M1 is complete. STOP. Wait for explicit user permission for M2.
After that permission, begin M2-T01, then dependency-ready tasks in [task plan](TASKS.md). Do not resume M1 or infer M2 approval merely from a model/session switch.

## Verification provenance
[Detailed M1 report](milestones/M1.md) distinguishes local checks from remote CI and production acceptance. Source evidence/gold labels and external permission requirements remain in [open questions](OPEN_QUESTIONS.md).
