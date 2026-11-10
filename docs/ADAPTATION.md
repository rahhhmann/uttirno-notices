# Easy adaptation and onboarding — M2 implementation

## What is configurable now
Source class/identity, version, review evidence/dates, collection/display status, exact origins, path prefixes, allowed query keys, HTTP exceptions, seeds, HTML or JSON adapter, optional detail adapter, optional browser ready selector, robots policy and request/time/byte/page/redirect/retry limits.

HTML mapping uses scoped CSS selectors, allowed attributes, required/cardinality checks and trim/whitespace/Bangla-digit transforms. JSON mapping uses bounded JSON pointers. New titles are not enums. No eval, remote code, guessed APIs or arbitrary regex transforms.

The authoritative runtime schema is in the source-config package. Defaults are applied before canonicalization/signing. Active sources require recorded adapter sample hashes/counts/reviewer, current policy evidence and a signature from a separately provisioned trusted Ed25519 public key. No production private key is stored here.

## Workflow
Current public-source basis: [ADR0013](decisions/0013-public-official-access.md) allows recorded public-access assessment without a mandatory permission letter. Use `publicAccessReview` to identify the operator decision and observed restrictions honestly. Signed scope/expiry/robots/retention checks still apply. Public availability alone never auto-activates an arbitrary source.

1. Register an unsigned candidate with observed official provenance. Domain suffix is never certification.
2. Record collection/display/robots assessment independently. Unknown or blocked stays disabled.
3. Capture minimal permitted listing/detail/attachment samples and inventory expected candidates/documents.
4. Preview a generic config offline. For the observed BPSC table fixture:
```powershell
node apps/agent/dist/main.js validate-source config/sources/bpsc-noncadre.draft.json
node apps/agent/dist/main.js preview config/sources/bpsc-noncadre.draft.json tests/fixtures/real/bpsc-noncadre.fragment.html
```
5. Validate cardinality, sibling field scope, attachment origins, all pages and new titles against fixtures. Proposals always remain needs_review.
6. An authorized reviewer approves ownership/collection/display and adapter samples. Provision the public trust key outside the proposed source; sign canonical normalized config outside the heuristic. Admin signing UX is M5/M6.
7. A bounded canary uses the signed config and external trust store through the single broker. Source collection remains separate from M3 document extraction and M4 publication approval.
8. Changed config requires a new signature/version; failed policy/layout checks stop or return incomplete. Review changes before re-enabling.

## Supported adaptation / limits
Tables/cards/list/detail HTML, next-link pagination, sibling links, public JSON and document URL inventories are supported. JS pages can use a declared ready selector with offline brokered rendering. New behavior may need a small adapter implementing the same boundary, not a rewrite of the core.

An unapproved storage host is quarantined. A missing/invalid robots result fails closed unless the limited signed 404/410 exception exists. IP-only links and login/CAPTCHA are not supported automatically. One broker process is required until M4 distributed leases. No claim that every site works without code.

Current real drafts are based on observed patterns, not authorized live sources. [Research and access findings](research/M2-sources.md).
