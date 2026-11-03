# Repository structure

TypeScript monorepo with separately deployable applications and shared domain/contracts. M1 migrates the original collector into a clearly isolated research workspace without losing evidence or tests.

```text
/
  AGENTS.md
  README.md
  apps/
    portal/           # public Next.js web application
      src/{app,features,components,lib}/
      public/
    admin/            # internal Next.js web application
      src/{app,features,components,lib}/
    api/              # Fastify HTTP service
      src/{modules,plugins}/
    agent/            # collection/extraction/onboarding runtime + CLI
      src/{onboarding,discovery,fetch,adapters,documents,extraction,verification,reconciliation}/
    worker/           # scheduled/queued execution
      src/{jobs,scheduling}/
  packages/
    domain/           # entities, lifecycle and publication rules
    contracts/        # runtime schemas, API schemas, queue payloads
    env/              # server-only runtime configuration and safe validation
    infrastructure/   # reusable dependency readiness clients
    database/         # schema, repositories, migrations, synthetic seeds
    source-config/    # registry/config validation and versioned loading
    llm/              # provider interface, prompts and constrained output
    observability/    # logging, metrics and tracing
    ui/               # shared accessible UI primitives
  config/
    sources/          # reviewed per-source configuration, default disabled
    taxonomy/         # optional categories/title aliases
  tests/
    fixtures/{synthetic,real}/
    integration/
    e2e/
    evaluation/
  infra/
    local/            # local service definitions
    deployment/       # staging/production templates, no credentials
    monitoring/
  scripts/            # maintenance and future developer tooling
  .github/workflows/  # future CI/release definitions
  docs/
    decisions/        # architecture decision records
    research/         # research index and source evidence references
  research/prototype/ # isolated historical collector, tests, configs and evidence
```

M1 adds executable foundations only. Unimplemented feature directories retain their README contracts. Do not add fake endpoints, empty exports, generated migrations or placeholder passing checks to make the repository appear complete.

## Placement
Feature code stays in its application module. Unit tests live next to their future implementation as *.test.ts. Cross-service integration, browser journeys and labelled extraction evaluation live under tests. Only the database package owns DB schema/repositories/migrations. Browser apps depend on contracts/domain-safe utilities and API clients, never database/agent code.

New source configuration lives under config/sources, not in a core switch statement. Generic adapter types are table/list/card/detail/PDF/public-JSON. Do not create packages named after individual employers.

## Explicit migration
The original src/test/evidence/examples and source registry are now under research/prototype with working relative imports. Current research documents remain linked. Prototype tests remain research regressions, not production extraction acceptance.
