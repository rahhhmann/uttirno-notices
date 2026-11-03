# Uttirno — Official Job Intelligence & Portal

Agent + public job portal + admin review system, planned around official Bangladesh recruitment sources only.

**বর্তমান অবস্থা:** production implementation শুরু হয়নি। এই repository-তে planning scaffold এবং আগের research prototype আছে। কোনো portal/API/database service এখন চালু নেই।

## Start here
1. [Project and scope](docs/PROJECT.md)
2. [Folder structure](docs/STRUCTURE.md)
3. [Architecture and stack](docs/ARCHITECTURE.md)
4. [Requirements](docs/REQUIREMENTS.md)
5. [Step-by-step tasks](docs/TASKS.md)
6. [Current status](docs/STATUS.md)
7. [Agent working rules](AGENTS.md)

## Planned components
- [Public portal](apps/portal/README.md): searchable jobs, evidence-aware details, official application links.
- [Admin](apps/admin/README.md): source onboarding, review, revision approval, audit.
- [API](apps/api/README.md): public read models and authenticated administration.
- [Agent](apps/agent/README.md): source discovery, acquisition, documents, extraction and verification.
- [Worker](apps/worker/README.md): schedules, queues, leases, retries and pipeline execution.
- [Shared packages](packages/README.md): domain, contracts, persistence and narrow infrastructure clients.
- [Deployment plan](infra/README.md), [tests](tests/README.md), [operations](docs/OPERATIONS.md).

## Research prototype
Existing [collector](src/collect.mjs), [normalizer](src/normalize.mjs), [tests](test/normalize.test.mjs), [evidence](evidence/) and [samples](examples/) are research assets, not the production architecture. They stay in place until the explicit M1 migration task. Sources are disabled in the [legacy registry](config/sources.json); do not use this collector for production acquisition.

Existing offline regression tests: `npm test`. Research sample regeneration: `node src/examples.mjs`. These commands do not build or verify the future applications.

No production stack versions or workspaces are installed by this planning step. See [stack decision](docs/decisions/0001-stack-and-boundaries.md) and [development setup](docs/DEVELOPMENT.md).
