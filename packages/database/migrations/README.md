# Migrations — M4

0001_core.sql creates the actual data model; 0002_guards.sql adds append-only history/identity/inventory guards, publication checks, indexes and approved-only view.

migrate validates schema identifiers, serializes via PostgreSQL advisory lock, checks ordered SHA-256 history and applies each migration atomically. Re-running identical migrations is safe; changed applied checksums/unknown histories fail. No destructive rollback or auto-seed. SQL files retain LF so checksums remain portable, and are included with package deployment files.

Tests migrate an empty schema and the previous authored schema with preserved data, exercise concurrent migration and tampered history. Further changes after application need a new numbered migration; never edit applied SQL to hide drift. [Report](../../../docs/milestones/M4.md).

0003 adds staff identity/session/idempotency; 0004 adds a fixed-search-path role-lock helper for physical least-privilege runtimes. PUBLIC cannot execute it. Owner-operated grants target pre-existing distinct API/worker roles; no users/passwords/sources are seeded. Keep migration-owner credentials out of app containers. Schema 0004 is not app-only rollback compatible with the old M7 image's strict 0003 readiness; see [M8 deployment](../../../infra/deployment/README.md).
