# ADR 0013 — Public official-source assessment and automated collection

Status: accepted by explicit user instruction on 2026-11-10. Supersedes the interpretation of ADR0002/0006 requiring external written permission for every public official source. Official-only eligibility, source signatures, runtime access checks and independent publication remain in force.

## Decision

A source operator may authorize bounded GET-only acquisition of verified official public recruitment pages and documents on an accountable public-access assessment. A written permission letter is not a universal prerequisite. Record the exact public pages inspected, observed terms/restrictions, assessment time/operator, precise origins/paths, local retention scope and expiry. Absence of observed restrictions is an operator decision, not an assertion of authority consent or a legal conclusion. `publicAccessReview` records that distinction in versioned signed source configuration. Restricted or unavailable assessments cannot activate a source through this basis.

Respect explicit prohibitions, robots disallow, 401/403, login/CAPTCHA, DNS/redirect protections, quotas and revocation. For a signed reviewed missing-robots policy, only an actual 404/410 may proceed as absence of robots instructions; malformed content, 401/403/5xx and inaccessible robots remain failures. No challenge/anti-bot bypass, proxy evasion or blind retries. Alljobs' observed written-consent restriction is unchanged.

Collection, private retention, extracted-fact publication and full-document republication remain separate decisions. Initial BPSC acceptance scope is private local acquisition/text extraction for user review, seven-day retention and source links only; no external permission claim or blanket public PDF hosting. The user volunteered as factual reviewer. Cryptographic signing records the user's delegated local operator decision, not a fictional government approver or independent gold-set reviewer.

Automate discovery and extraction of all documents within the approved configured slice, record per-document failures/checkpoints, and produce a private review report. Unmapped/unsupported facts stay unknown; drafts are never automatically approved. Existing worker scheduling remains available after legitimate staff/service identity provisioning. Public source selection does not create a production identity or complete release gates.

## Consequences

Old research reports remain historical observations under the earlier policy. Current status/handover must point to this superseding decision instead of repeatedly requesting a permission letter. Source-specific settings stay in configuration; core code does not branch on authority names. Exact policies and extraction accuracy still need runtime evidence. M9 completeness and production acceptance cannot be inferred from successful PDF downloads alone.
