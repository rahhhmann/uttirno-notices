# Uttirno — Official Job Intelligence & Portal

Agent + public job portal + admin review system, planned around official Bangladesh recruitment sources only.

**বর্তমান অবস্থা:** M1 foundation ও M2 source trust/adaptation সম্পন্ন। Planning, isolated research prototype এবং executable workspace foundations আছে। পূর্ণ PDF/OCR job extraction, চাকরির portal features ও admin review এখনো বাস্তবায়িত নয়।

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
The original [collector](research/prototype/src/collect.mjs), [normalizer](research/prototype/src/normalize.mjs), [tests](research/prototype/test/normalize.test.mjs), [evidence](research/prototype/evidence) and [samples](research/prototype/examples) are isolated research assets. Sources remain disabled in the [legacy registry](research/prototype/config/sources.json); do not use this collector for production acquisition.

Offline prototype regressions: `npm run test:prototype`. Sample regeneration: `npm run examples --workspace @uttirno/research-prototype`.

## Foundation commands

Run `npm ci`, then `npm run check` and `npm run build`. See [development setup](docs/DEVELOPMENT.md) for local services, environment setup and service readiness checks. M1 is not a production release; see [release gates](docs/RELEASE.md).
