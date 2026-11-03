# ADR 0006 — Signed source policy and brokered adaptation

Status: accepted and implemented for M2.

## Decision
Version source configs with strict schemas and canonical SHA-256 fingerprints. Active collection needs verified official authority class, scoped ownership/policy evidence, adapter sample evidence, valid review dates and an Ed25519 signature from an externally trusted key. No production signer/private key or real approval is created by M2. The loader re-reads source and trust data at request gates, so changes/revocation fail closed.

Collection/display are separate. A display link_only decision is not a license to copy full content. Actual publication projection checks remain M4/M5.

Use a Node broker with public DNS validation and pinned lookup addresses. Redirects and conditional/cache/retry paths pass the same gates. Robots absence is conservative by default and cannot be equated to collection permission. Generic standards/security constants belong in code; site URLs/selectors/pagination/mappings belong in config.

Use an offline Chromium context and fulfill all HTTP through the broker rather than allowing browser sockets. Block service workers/WebSockets/POST/popups/downloads, bound time/request/DOM/output/JS heap, and keep sandboxing enabled. A URL-changing browser redirect is conservatively rejected rather than fulfilled under the wrong origin.

HTML/JSON adapters provide scoped candidate data and bounded traversal. Onboarding only proposes and validates observed selectors; it never signs/activates. Draft real configs remain disabled pending external policy review.

## Consequences / operating constraints
Source ownership/rights still depend on accountable human review; signatures protect integrity, not truth. One broker process is supported until distributed host leases in M4. M8 must provide production OS egress/resource controls. Unsupported robots redirects, inaccessible policy, novel page technologies and CAPTCHA remain blocked instead of bypassed. No third-party portal is introduced.

Known third-party marketplace exclusions live in the versioned source-scope JSON policy, evaluated generically; a source proposal cannot override them. No employer-name branching is added to adapters. Offline config/snapshot reads are capped at 1 MiB and reject non-regular files.
