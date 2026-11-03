# Database foundation

Owns PostgreSQL pool/Drizzle construction and explicit connection cleanup. Connecting does not migrate, seed or alter tables. Integration tests use only temporary tables and rollback.

Job schema/repositories/migrations arrive in M4. Existing native PostgreSQL is not altered by the M1 isolated setup. See [data model](../../docs/DATA_MODEL.md) and [plan](../../docs/TASKS.md).
