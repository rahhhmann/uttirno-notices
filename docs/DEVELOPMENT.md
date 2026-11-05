# Development setup

Use Node 24.19.0 (supported >=24.19.0 <25) and npm 11.17.0. Exact JS dependency versions/integrities are in the root lockfile. [M1 stack decision](decisions/0005-m1-foundation.md), [M3 engine decision](decisions/0007-m3-document-extraction.md).

## Install and verify

Run npm ci, npm run check and npm run build. Checks cover Biome, dependency boundaries, strict types including tests, unit cases and original prototype regressions. Packages build before applications. No production module imports research code.

For browser integration: npm exec --workspace @uttirno/agent -- playwright install chromium. Linux CI uses --with-deps plus scoped sandbox support.

## PDF/OCR prerequisites

Install trusted maintained Poppler tools (pdfinfo, pdftotext, pdftoppm) and Tesseract with ben and eng traineddata on PATH. Windows development currently has Poppler 25.07.0 / Tesseract 5.5.3.20260724. Do not download binaries from job notices. Linux CI explicitly installs poppler-utils, tesseract-ocr, tesseract-ocr-eng and tesseract-ocr-ben. Engine/model fingerprints are stored in each text version, so different native packages/models can legitimately create a different text version.

Native tools get local temporary PDFs/image stdin, bounded arguments, no shell, scrubbed environment and sanitized output/errors. This is not production OS isolation; see M3 limits. No Python or AI key is needed.

npm run benchmark:documents writes ignored data/m3-benchmark.json; an explicit output argument can record a report. Fixtures are synthetic and checksummed. Fixture regeneration with node scripts/generate-document-fixtures.mjs is a deliberate maintainer action and can change PDF hashes/fonts; ordinary tests never regenerate them.

## Isolated local services

Docker Desktop/engine must be running. npm run local:init creates an ignored random development .env and refuses overwriting it. Then npm run local:up, npm run check:services, npm run test:integration and npm run smoke:foundation.

PostgreSQL uses 55432, Redis 56379 and LocalStack S3 54566, all loopback-bound. The bucket is uttirno-dev-artifacts, with explicitly synthetic credentials. Named volumes persist. Existing native PostgreSQL on 5432 is separate. Changing DATABASE_URL never creates/seeds/copies a database automatically. M4 implements explicit schema migrations; connecting still performs no schema writes.

npm run local:down stops containers without deleting volumes. No down -v unless deliberately discarding development data. Native PostgreSQL remains independent.

## Application and document tools

Build shared packages, then npm run dev:api, dev:portal or dev:admin. API implements public/admin routes and the staff console has M6 workflows; the public portal remains a foundation until M7. Portal/admin never import DB/server environment/agent modules.

[Agent CLI](../apps/agent/README.md) provides source preview/discovery and one-document extraction. Sources remain disabled until legitimate ownership/collection/robots/retention approval. Capture/text files go to the operator-selected private archive root, conventionally data/artifacts (ignored), not db.json. M4 stores immutable metadata/text/revisions in PostgreSQL. No public file serving; production S3 deployment and purge remain later gates.

Server startup loads root .env with injected environment taking precedence. Errors expose variable names only. Optional AI variables do not automatically enable an extraction gateway or grant processing permission. No private keys, real credentials or raw production documents in Git.

## CI and milestone boundary

CI performs clean npm ci, native/browser setup, check/build, real isolated services, integrations and HTTP smoke, then shuts services down. Remote CI status is independent evidence checked per commit. Browser accessibility, authenticated E2E, production storage/OS controls, restore and gold-set accuracy remain release gates.

M6 is authorized. Stop before M7 until the user's explicit authorization, even after model/session changes.

## M4 schema and worker

Run npm run local:up and then npm run db:migrate deliberately against the intended DATABASE_URL. The command applies checked SQL history in the uttirno schema and seeds no accounts, source approvals or jobs. Empty/previous-schema upgrades and checksum drift are integration-tested. Never edit applied migration SQL; add a new numbered migration. Keep native PostgreSQL on 5432 separate from these loopback development services.

[Worker command and plan registry](../apps/worker/README.md) describe explicit runtime startup. The actor must be a legitimately provisioned service operator; M4 has no default account or public actor-selection endpoint. M5 will bind actors to authenticated identities. External trust keys and plan files are bounded reads; a key or .env entry alone cannot enable a source. Missing plans/artifact drift pauses for review.

Build ordering now includes the exported server agent interface before worker typechecking; build:packages builds packages plus exported server libraries. Database repositories own SQL; worker/agent use their interfaces. Tests use temporary guarded schemas/queues and synthetic source transport, never actual job portals. Multi-process acquisition uses the shared-DB worker; standalone agent CLI keeps its single-broker constraint.

## M5 local API and identity

Existing local environments: npm run local:upgrade-api appends missing random independent API cursor/session secrets and loopback origins, never overwriting credentials. New local:init environments include them. Run npm run db:migrate explicitly for schema 0003. Never print or commit root .env. PostgreSQL stays on 55432.

Public API uses configured external source public trust keys; missing dev keys return no untrusted jobs. SOURCE_TRUST_KEYS_FILE is a bounded JSON map from key ID to PEM public key; signatures/permissions still govern every source. No private signing keys belong in API configuration.

For real OIDC, set AUTH_ISSUER, AUTH_CLIENT_ID, AUTH_CLIENT_SECRET, AUTH_REDIRECT_URI (API_PUBLIC_ORIGIN plus /v1/admin/auth/callback), AUTH_ALLOWED_ORIGINS (exact issuer/token/JWKS origins) and random 32-byte hex AUTH_STATE_KEY. Register the fixed callback with a confidential RS256 provider. Production requires HTTPS origins and complete OIDC/trust configuration. Loopback test providers alone may use AUTH_ALLOW_HTTP_LOOPBACK=true outside production. Never paste credentials into chat.

The owner-operated npm run identity:bootstrap -- <private-json-path> explicitly binds actorId, issuer, subject, roles (including administrator) and reason when no administrator exists. Use a protected file outside Git, verify subject with the real provider and remove it under the owner's retention policy. The command does not invent identities; do not run against production accidentally. Subsequent bindings/role updates require administrator API authorization. No live provider or accounts were configured during M5.

## M6 staff console

Build the admin app before npm run test:admin; isolated services/native tools/Chromium must be available. CI now runs this real browser suite after integration tests. Export ADMIN_API_ORIGIN into the Next server (default http://127.0.0.1:4000); optional ADMIN_HOME_URL/ADMIN_BRAND_NAME customize the host identity. The Next application does not auto-load the root API .env. Configure API ADMIN_ORIGIN/OIDC callback for the intended external browser URL. Set PRIVATE_ARCHIVE_ROOT in API runtime to the worker archive root for retained original views/downloads; mount it read-only in deployment. Never point it at an arbitrary shared user folder. No credentials or source activation are seeded. [Admin runbook](../apps/admin/README.md), [lead handoff](ADMIN_HANDOFF.md). M6 is authorized; stop before M7.
