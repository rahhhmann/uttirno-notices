# Shared packages

Executable workspaces enforce explicit dependency boundaries. Contracts/domain stay independent of UI, transport and persistence libraries. Database alone owns SQL/migrations. API clients depend only on runtime contracts and browser fetch. Server environment, source trust and agent code never enter portal/admin bundles.

See [structure](../docs/STRUCTURE.md), [API clients](api-client/README.md), [database](database/README.md) and [current status](../docs/STATUS.md). Unimplemented observability/UI feature directories still contain planning contracts; folders alone are not completion evidence.
