# Agent — M2/M3

M2 provides signed official-source gates, restricted broker/rendering, generic discovery/adapters and offline onboarding proposals. M3 adds private immutable archive, native PDF/OCR, field extraction and evidence preflight. All checked-in real sources remain unsigned candidates with unresolved permissions.

## Commands

Automated bounded private collection: `node apps/agent/dist/main.js pipeline SIGNED_SOURCE EXTERNAL_TRUST_KEYS PRIVATE_ARCHIVE_ROOT`. It discovers the configured slice, automatically attempts all accepted documents with one shared broker budget, captures/extracts PDFs and checkpoints a private `reviews/<run-id>/manifest.json` plus escaped offline `report.html`. Failure/incomplete inventory remains incomplete; successful text extraction remains `needs_review`, without invented field/position mapping or public approval. Reports contain actual source text and must stay outside Git/public hosting.

For official public sources, [ADR0013](../../docs/decisions/0013-public-official-access.md) permits a documented operator assessment instead of a mandatory permission letter. `npm run source:sign-local -- config/sources/bpsc-authority.public-local.json` explicitly creates ignored local keys/source/trust files for the expiring local-only example. No automatic startup activation; read the command's output paths and pass them to `pipeline`. Signing identifies a local operator decision, not government consent or production approval. Windows files inherit local ACLs: keep the generated directory owner-only.

Build with npm run build first.

- node apps/agent/dist/main.js check-config
- node apps/agent/dist/main.js validate-source config/sources/bpsc-noncadre.draft.json
- node apps/agent/dist/main.js preview config/sources/bpsc-noncadre.draft.json tests/fixtures/real/bpsc-noncadre.fragment.html
- node apps/agent/dist/main.js collect SIGNED_SOURCE EXTERNAL_TRUST_KEYS
- node apps/agent/dist/main.js extract-document SIGNED_SOURCE EXTERNAL_TRUST_KEYS OFFICIAL_PDF_URL PRIVATE_ARCHIVE_ROOT [REVIEWED_PLAN_JSON]

preview is offline. collect inventories discovery candidates/attachments, not full job facts. extract-document processes one operator-selected public job notice; it requires current signed collection and explicit retention grants before network access, then uses all broker protections, records original bytes/response/config metadata and hashes, extracts pages and optional mapped position candidates. It always returns needs_review and publicationApproved=false. Result PDFs/applicant records are outside this command's scope. There is no public archive endpoint.

Plans contain versioned literal field labels and whole-line position ranges; [format and limitations](../../config/extraction/README.md). No employer branches or title enums. Unsupported layouts require reviewed adaptation. Text/scan/table/quality caveats and measured results: [M3 report](../../docs/milestones/M3.md).

No AI key is required. The optional JSON gateway package is not enabled by a CLI flag or .env alone; no real provider is configured. M4 adds [durable worker](../worker/README.md), DB metadata/revisions and independent review/publication transactions; API/auth and admin UI remain later milestones. Agent extraction itself never publishes. Do not sign/activate real sources to make a demo pass.
