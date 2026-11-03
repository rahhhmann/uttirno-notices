# Agent — M2

Implemented: strict source validation, signed policy gates, pinned-address HTTP transport, conservative robots enforcement, bounded retries/rate/size limits, conditional requests, restricted offline browser rendering, config-driven HTML/JSON parsing, bounded discovery and offline onboarding proposals.

## Commands from repository root
Build first with npm run build.
- node apps/agent/dist/main.js check-config
- node apps/agent/dist/main.js validate-source config/sources/bpsc-noncadre.draft.json
- node apps/agent/dist/main.js preview config/sources/bpsc-noncadre.draft.json tests/fixtures/real/bpsc-noncadre.fragment.html
- node apps/agent/dist/main.js collect SIGNED_SOURCE_JSON EXTERNAL_TRUST_KEYS_JSON

preview is offline and never enables a source. collect fails before DNS/HTTP unless current policy/signature/gates pass. It reports bounded discovery candidates, document URLs and acquisition metadata; it is not M3 PDF/OCR extraction, persistent archival or job publication. No AI key is needed for M2.

Real checked-in sources remain unsigned candidates with unresolved permissions. Do not sign/activate them just to obtain a successful run. See [source research](../../docs/research/M2-sources.md) and [adaptation](../../docs/ADAPTATION.md).
