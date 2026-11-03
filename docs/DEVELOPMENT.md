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

PostgreSQL uses 55432, Redis 56379 and LocalStack S3 54566, all loopback-bound. The bucket is uttirno-dev-artifacts, with explicitly synthetic credentials. Named volumes persist. Existing native PostgreSQL on 5432 is separate. Changing DATABASE_URL never creates/seeds/copies a database automatically. Schemas/migrations are M4.

npm run local:down stops containers without deleting volumes. No down -v unless deliberately discarding development data. Native PostgreSQL remains independent.

## Application and document tools

Build shared packages, then npm run dev:api, dev:portal or dev:admin. API has live/readiness health routes only; both web apps show foundation notices. Portal/admin never import DB/server environment/agent modules.

[Agent CLI](../apps/agent/README.md) provides source preview/discovery and one-document extraction. Sources remain disabled until legitimate ownership/collection/robots/retention approval. Capture/text files go to the operator-selected private archive root, conventionally data/artifacts (ignored), not db.json. No public file serving. DB metadata/S3 production wiring and purge are later work.

Server startup loads root .env with injected environment taking precedence. Errors expose variable names only. Optional AI variables do not automatically enable an extraction gateway or grant processing permission. No private keys, real credentials or raw production documents in Git.

## CI and milestone boundary

CI performs clean npm ci, native/browser setup, check/build, real isolated services, integrations and HTTP smoke, then shuts services down. Remote CI status is independent evidence checked per commit. Browser accessibility, authenticated E2E, production storage/OS controls, restore and gold-set accuracy remain release gates.

M3 is complete. Stop before M4 until the user's explicit authorization, even after model/session changes.
