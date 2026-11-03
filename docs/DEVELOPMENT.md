# Development setup plan

This is M0 documentation. The future applications do not have package manifests, app entrypoints or installed frameworks yet.

M1 will select currently supported compatible Node/TypeScript/framework/package versions, record exact versions, define npm workspaces for apps/* and packages/*, establish strict TS/config/lint/build tooling, test commands and dependency boundaries, and commit one lockfile. Do not assume the old root Node >=22 prototype minimum is the production runtime decision.

Expected future local dependencies: PostgreSQL, Redis and an S3-compatible object store, with isolated test databases/buckets. Add service definitions only when runnable, not placeholder YAML. Before running container CLI commands, use the environment's container configuration tool.

Environment contract: database URL; queue URL; private artifact bucket credentials; admin identity/session settings; source config directory; runtime user-agent/contact; optional OCR/LLM provider credentials/budgets. No checked-in working secret or default privileged account. Add a documented .env.example at M1 with placeholders only.

Future commands should cover dev per app, build, typecheck, unit/integration/E2E, migrations and bounded operator commands. Until implemented, only existing prototype npm test and node src/examples.mjs commands are available.

Begin implementation from M1 only after user requests coding. Follow AGENTS.md, milestone dependencies and executed acceptance checks; no bulk generated application code without verified behavior.
