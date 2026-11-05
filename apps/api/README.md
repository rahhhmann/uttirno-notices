# API ? M5

Fastify public/admin API with generated [OpenAPI](http://127.0.0.1:4000/v1/openapi.json). See [API contract](../../docs/API.md) and [identity decision](../../docs/decisions/0009-m5-api-and-identity.md).

Build shared packages, explicitly migrate the intended database, then run npm run dev:api at the root. Startup never migrates, seeds accounts or crawls. Readiness checks dependencies plus schema version. Missing OIDC disables login; public approved-only reads can run locally with no staff account. Production rejects incomplete identity/trust settings.

Factory tests use injection; integration tests use actual PostgreSQL and signed loopback OIDC protocol. No live provider or recruiting source is contacted. M8 adds shared fail-closed Redis quotas, exact trusted proxy IPs, protected aggregate metrics and redacted request correlation. Production requires OPERATIONS_TOKEN and PARSER_SOCKET; see the [deployment runbook](../../infra/deployment/README.md). Live deployment acceptance remains outstanding.
