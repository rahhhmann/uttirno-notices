# Schema — M4

Typed core Drizzle definitions are in [src/schema.ts](../src/schema.ts). [Authored SQL migrations](../migrations) are authoritative for all tables, checks, foreign keys, triggers, indexes and view. Repositories keep all SQL/persistence inside this package.

Migration tests exercise the Drizzle mappings against the migrated DB. Do not run a second schema generator/push flow that bypasses reviewed migration history. [Data model](../../../docs/DATA_MODEL.md).
