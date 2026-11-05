# Uttirno staff administration - M6

Next.js staff console for source policy/sample review, independent evidence/publication, duplicates/events, source pauses, run recovery and audit. All data/actions use [typed API clients](../../packages/api-client/README.md); no DB/acquisition client exists in this app. Public job features remain M7.

## Run

Build packages and this app, start the real API, then npm run dev:admin or npm run start --workspace @uttirno/admin. Ports default to admin 3001 and API 4000. Use 127.0.0.1 consistently. Configure/export ADMIN_API_ORIGIN into the Next server process (default loopback 4000), ADMIN_HOME_URL and ADMIN_BRAND_NAME if overriding the current Uttirno identity. Next does not automatically load the root API .env from its application directory. No secret is sent in public settings.

The /v1/admin gateway forwards to the configured origin only, preserves the API session/CSRF/Origin rules and forwards only staff cookies. Live SSO must be configured in the API with explicitly provisioned roles. When absent, the UI explains that sign-in is unavailable; there is no demo account or bypass. Set the API's PRIVATE_ARCHIVE_ROOT to the same private root used by the worker, read-only in deployment, for original page/text views and downloads. Missing storage/tooling shows an error; it never fabricates an original. Poppler is required for PDF page images. [Setup and identity](../../docs/DEVELOPMENT.md).

## Workflows

- Sources: register authority evidence; paste versioned config and legitimately obtained sample; compare exact inventory, origins, policy and fingerprints. Preview does not activate. Import a signature from the external signer, then apply collection/display controls independently with reason/current epoch. Canary requires the signed narrow budget; review actual run results before using a wider config.
- Review queue: inspect raw/normalized fields and unknown/conflicting states, click scoped evidence, compare retained original text/PNG pages, acknowledge flagged pages/supporting docs and all-position inventory. Independent approve/reject preserves generation and idempotency gates.
- Duplicates/events: explicit original memo/post mapping creates a draft; notice evidence and affected positions are reviewed independently. Replacement revisions can resolve pending critical amendments. Rejected critical events require explicit restore; terminal cancellation cannot reopen.
- Operations/audit: real dependency readiness, runs/stage errors/checkpoints, pauses/reruns and administrator-only append-only audit reads. Refresh after a mutation; a stale state is not silently overwritten.

For browser acceptance, build the app and start isolated local services, then npm run test:admin. The fixture uses actual Next/HTTP/PostgreSQL and signed ephemeral OIDC, not login mocks or real job-site calls. Axe/keyboard/mobile checks are representative. [M6 report](../../docs/milestones/M6.md), [host handoff](../../docs/ADMIN_HANDOFF.md).
