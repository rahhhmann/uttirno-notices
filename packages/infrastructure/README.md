# Dependency health

Reusable bounded PostgreSQL/Redis/S3 readiness probes for API and operator checks. Reports booleans rather than connection strings or remote errors. Opens bounded connections and closes them after each check. No source crawling, schema migration or automatic job insertion. Domain persistence remains owned by the database package.
