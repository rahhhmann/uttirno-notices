# Pipeline handover and local verification

Requested 2026-11-10. M9 work is now authorized; authorization does not resolve the source-access or release evidence gates. M7-T03 and M8 acceptance remain open as recorded in [status](STATUS.md). This is a runnable development handover, not a real-source release certificate.

## Current public-source policy and automated command

For the current five-source sequential real-test command and where to enter source URLs, use the [Bangla local guide](LOCAL_REAL_TEST.bn.md). `npm run sources:live` builds server packages, local-signs only current reviewed registry configs and writes an aggregate private report plus individual PDF/text reports. It never approves facts or activates production scheduling. The main-bank notice-board success is separate from the rejected bank e-Recruitment endpoint.

The user's subsequent instruction explicitly changed the universal written-permission requirement. [ADR0013](decisions/0013-public-official-access.md) now permits a dated, accountable operator public-access assessment for verified official public sources. Published restrictions, robots, DNS/redirect, source signatures, expiry and separate collection/retention/display decisions still apply. Historical requests below for external permission evidence are superseded for the assessed local BPSC scope; do not claim government consent.

The explicit opt-in [BPSC local config](../config/sources/bpsc-authority.public-local.json) authorizes seven-day private collection/review of the observed non-cadre page and exact three attachments. No public PDF hosting or factual publication is enabled. Run from the repository root after building:

```powershell
npm run source:sign-local -- config/sources/bpsc-authority.public-local.json
node apps/agent/dist/main.js pipeline <printed-source-path> <printed-trust-path> .local/bpsc-archive
```

The signer creates local operator keys under ignored `.local/source-approvals`; restrict Windows ACLs to the owner. Never ship its private key with the handover. The pipeline uses the broker for discovery and every PDF, shares request budgets, captures immutable originals/text and writes a private `reviews/<run-id>/manifest.json` and inert `report.html`. Open the printed report locally to review page text and download originals for a trusted viewer. Reports contain real source text: keep them outside Git/public hosting and remove them according to the seven-day local policy. There is no claim of an automatic purge service.

The current site's observed base64 HTML attribute is decoded using versioned `embeddedHtml` config, bounded to one 1-MiB inert payload; no remote JS executes. Invalid text-layer geometry triggers bounded OCR of that page, with OCR/layout flags and strict provenance verification still enforced. Every extracted document remains unmapped/unpublished until position/field review; successful collection is not complete factual extraction. Existing DB-backed worker scheduling is separate and still needs legitimate staff/service identities and reviewed extraction plans.

## Local review and portal rehearsal

Prerequisites: Node/npm versions and native tools in [development](DEVELOPMENT.md), Docker Desktop running, dependencies installed with `npm ci`. Run commands from the repository root. Existing ignored development credentials are preserved; on a fresh checkout run `npm run local:init` once.

```powershell
npm run local:up
npm run build
npm run local:demo
```

Open <http://127.0.0.1:3001> and select **Continue with SSO**. The isolated signed local provider signs in as the fictional reviewer. Follow the review URL printed by the command. Compare the original and all position-scoped facts, check the confirmations, provide a decision reason and approve. Open <http://127.0.0.1:3000/jobs?lang=en>: two fictional positions should now appear. Before approval the portal must be empty. Example application URLs are fictional and must not be used.

`local:demo` stages a synthetic document and draft using existing guarded test infrastructure; it does not run acquisition, native extraction or real Google login. The separate integration tests exercise worker acquisition with injected synthetic transport and actual native parsing. The demo uses real PostgreSQL, HTTP/API, built staff/public applications, OIDC protocol and manual browser approval. All demo identities/keys/source records live in its random temporary test schema. It does not activate checked-in recruiting sources, modify the normal application schema or use the supplied Google secret. Use `npm run local:demo -- admin` to rehearse administrator screens in a new isolated run. Ports 3000/3001/4000 must be free.

Ctrl+C removes that run's temporary schema and archive. Restart creates a fresh empty portal and draft. A forced process kill can leave a temporary `m4_test_*` schema/archive; inspect and remove only the exact abandoned run under the guarded cleanup rules. `npm run local:down` stops dedicated dependencies and retains volumes; never use `down -v` casually.

## Supplied Google web client

The supplied credential JSON is ignored by Git. `npm run local:google -- <credential-json-path>` validates its Google endpoints and exact registered localhost callback, generates a random state key and creates ignored `.local/google-oidc.env` without overwriting files. It preserves root `.env`. Windows file access inherits local ACLs; restrict the credential files to the owner. Do not send these files with the handover or print their contents.

For the real provider path, stop the synthetic demo, explicitly migrate the dedicated development database (`npm run db:migrate`), then start the built API from the root:

```powershell
node --env-file=.env --env-file=.local/google-oidc.env apps/api/dist/main.js
```

In another PowerShell window:

```powershell
$env:ADMIN_API_ORIGIN='http://127.0.0.1:4000'
npm run dev:admin
```

Open <http://localhost:3001>. Use **localhost** consistently for the browser; the registered callback is <http://localhost:4000/v1/admin/auth/callback>, not the 127.0.0.1 alias. Google authentication requires the account owner to sign in and may require Google consent-screen test-user configuration. Successful Google authentication alone grants no staff access. Before staff access, the owner must verify the stable Google issuer/subject and run the explicit [identity bootstrap](DEVELOPMENT.md) with a private JSON file containing `actorId`, `issuer`, `subject`, `roles` and `reason`. Never infer the subject from email, invent an account or copy demo subjects. Existing administrators provision subsequent roles. No source permission follows from Google OAuth.

Observed on 2026-11-10: real Google discovery and signed-provider authorization URL construction succeeded with the supplied client; registered callback matched and PKCE was S256. Interactive login, token exchange and a real staff binding were not performed.

## First legitimate real-source run

Follow [adaptation](ADAPTATION.md), [source research](research/M2-sources.md), [agent CLI](../apps/agent/README.md), [worker](../apps/worker/README.md) and [extraction plan contract](../config/extraction/README.md). The source approver must establish ownership/designation, collection permission, robots handling, permitted retention and display separately, with current dated evidence and exact origins/paths. A public URL, robots allowance, OAuth credential or user request alone is not evidence of authority permission. Unknown permissions remain disabled.

Capture only permitted minimal samples; record URL/time/hash and enumerate every accepted notice's documents and positions. Verify selectors offline, then have the approver sign normalized versioned config with an externally provisioned trust key. Do not sign unresolved drafts. Runtime broker checks must still execute on every acquisition.

Run the bounded canary and inventory through the existing agent/administrative path. For each approved notice, archive/extract through the broker, compare original pages with text, and prepare a reviewed extraction plan pinned to exact URL/artifact hash. The current deterministic mapper handles literal labels and reviewed position ranges; arbitrary real circular/table layouts are not proven compatible. Unsupported layouts need fixture-backed adaptation. A newly discovered notice without a reviewed mapping pauses for review; unattended extraction of every new circular is not an established capability.

Register the approved source via administrative API, provision the operator identity, supply external public trust keys/private archive/plan registry and start the explicit worker command. Check discovery completeness, every attachment and position, evidence/quality/conflicts, then have a separate authorized reviewer approve. Verify anonymous API and portal, exact official application links, freshness, reprocessing, drift, scoped amendment and permission revocation. Save provenance and sanitized results in the milestone report. Do not put real documents, secrets or sensitive logs in Git.

M9-T03 requires the independently adjudicated gold set in [testing](TESTING.md); model-generated agreement is insufficient. Production also needs the unresolved hosts/TLS/proxy, provider identities, alerts, retention/backup custody, rollback and agreed load/restore targets in [open questions](OPEN_QUESTIONS.md). Accounts under an external organization's identity and authority permissions cannot be self-issued by this agent.

## Uttirno integration contract

The lead keeps worker/agent and persistence behind the API. The host consumes `/v1/jobs`, `/v1/jobs/:id`, `/v1/jobs/:id/events` and `/v1/authorities`; [API](API.md) and [typed clients](../packages/api-client/README.md) define validation, unknowns, cursors and error handling. Public reads require no consumer credential. Never expose the admin cookie, OIDC secret, database credentials or private archive in browser code.

Use [portal settings](../apps/portal/README.md) for approved branding/home/preparation links, [staff integration](ADMIN_HANDOFF.md) for exact browser/API origins and identity routing, and the [deployment runbook](../infra/deployment/README.md) for runtime isolation, migrations and grants. Recheck draft invisibility, approval propagation, suppression/revocation and caching through Uttirno's actual router. Actual host code/assets/domain were not provided, so embedded integration has not been executed. Keep noindex until release acceptance.
