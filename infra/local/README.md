# Local dependencies

Digest-pinned Compose provides isolated development PostgreSQL (55432), authenticated Redis (56379) and loopback-only LocalStack S3 emulation (54566). Named volumes retain state across ordinary restarts/down. No native PostgreSQL on 5432 is modified.

Follow [development setup](../../docs/DEVELOPMENT.md). Root .env is generated privately with random database/Redis credentials by local:init, refuses overwrite, and is ignored by Git. It is not a production secret provisioning process. The S3 bucket initializer is idempotent; its LF line endings/executable Git mode support Linux CI.

Do not expose this development Compose configuration publicly or use emulator credentials in production.
