# ADR 0005 — Executable M1 foundation and local isolation

Status: implementation decision, 2026-11-03.

- Pin Node 24.19.0 (supported range 24.x from that patch) and npm 11.17.0; direct dependencies use exact registry-verified versions with a single lockfile. Next 16.4.4 / React 19.3.1, Fastify 5.12.8, TypeScript 7.0.2, Zod 4.6.7 and Vitest 5.1.0 are checked through real installation/type/build tests, not assumed compatible from version labels.
- Add narrow env and infrastructure packages because both CLI/server processes need safe server configuration and real dependency readiness. They do not own domain facts or migrate schemas.
- Use Babel parser 8.1.0 for static dependency-boundary analysis: the TypeScript 7 package no longer supplies the legacy compiler API used by the initial check. This keeps the actual TypeScript compiler current rather than disabling the check.
- The installed native PostgreSQL on 5432 remains untouched. Provide isolated Docker development PostgreSQL on 55432, Redis on 56379 and S3 emulation on 54566. A developer can change DATABASE_URL to an already provisioned dedicated native development database. Credentials alone never copy data, create schemas or seed production.
- LocalStack 4.10.0 is a digest-pinned, loopback-only S3 development emulator, not a production storage choice. No MinIO community production dependency is selected; its current release/distribution status requires separate consideration. Production object storage is decided in M8.
- Source operations remain disabled in M1. API offers truthful liveness/dependency readiness only; web apps show an explicit foundation notice; admin has no data/mutation routes. This is a buildable foundation, not implemented M2-M7 features.
- User requires a stop after each milestone with actual test results. M2 needs explicit permission after M1.

Version evidence: npm registry metadata checked during M1; [Next installation](https://nextjs.org/docs/app/getting-started/installation). Image tags/digests checked against the official Docker Hub repositories; locked image references are in the local Compose file. Local Windows execution is measured separately from the checked-in Linux CI definition; no claim of a remote CI run without evidence.
