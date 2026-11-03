# Development setup

M1 provides executable workspace foundations. Use Node 24.19.0 (the declared supported range is >=24.19.0 <25) and npm 11.17.0. Exact direct dependency versions and transitive integrity hashes are in the single root lockfile. [ADR 0005](decisions/0005-m1-foundation.md) records the stack/tooling decisions.

## Install and verify
```powershell
npm ci
npm run check
npm run build
```

check runs Biome lint, dependency boundaries, strict types including tests, unit tests and historical research regressions. Build compiles shared packages before dependent applications. Web typecheck generates Next route types first, including on a fresh checkout. Research is never imported by application workspaces.

## Isolated local services
Docker Desktop/engine must be running. The checked-in Compose definitions are development-only and loopback-bound. Initialize a new ignored root environment file without overwriting an existing file:

```powershell
npm run local:init
npm run local:up
npm run check:services
npm run test:integration
npm run smoke:foundation
```

local:init generates random PostgreSQL/Redis development passwords, no production credentials and no default admin identity. PostgreSQL uses host port 55432, Redis 56379 and LocalStack S3 emulator 54566. PostgreSQL/Redis data use named volumes. The bucket is uttirno-dev-artifacts. LocalStack uses explicitly synthetic test credentials and is never a production S3 provider.

Existing PostgreSQL on port 5432 is not touched. To use a pre-provisioned dedicated native development DB, edit DATABASE_URL privately in the root .env, then start only Redis/storage with:
```powershell
docker compose --env-file .env -f infra/local/compose.yaml up -d --wait redis storage
```
No automatic schema creation, migration or seeding occurs when credentials change. Job schema/migrations belong to M4. The .env.example is a template; REPLACE values are not real credentials.

Stop local containers without deleting their volumes: npm run local:down. Do not use down -v unless deliberately discarding development data. Native PostgreSQL is independent.

## Run foundation applications
Build shared packages first (npm run build:packages), then use npm run dev:api, npm run dev:portal, or npm run dev:admin in separate terminals. API uses the root ignored environment file; portal is on 3000 and admin on 3001. Portal/admin expose a foundation notice only, no job data or administrative mutations. API exposes /health/live and /health/ready only. Readiness checks actual dependencies and returns 503 on failure.

Agent configuration check: npm run start --workspace @uttirno/agent -- check-config after a build. Worker offers the same check-config command. Neither executes sources/jobs in M1. No LLM key is required. Provider/key/model variables are preparatory validation only; AI extraction is M3.

## Environment boundaries
Server applications load root .env explicitly at startup (injected environment takes precedence); no import-time loading or browser export. Missing/invalid values report variable names without secret values. The root .env is ignored. Public web apps do not import server environment/database packages. Production identity, source policy/user-agent and model processing options are added in their own gated milestones.

## CI and limits
The pinned GitHub Actions workflow mirrors clean install/check/build/services/integration/HTTP smoke and shuts services down. Local execution is measured independently of any remote CI result. M1 smoke tests prove built HTTP responses and dependency connectivity; they do not replace browser accessibility/E2E or production security/restore acceptance.

Stop after the current milestone and report results. M2 requires the user's explicit permission.
