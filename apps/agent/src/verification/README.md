# Verification — M3

The pure [domain verifier](../../../../packages/domain/src/extraction.ts) reproduces field meaning/value/quote/scope against the exact hashed text and reviewed plan. It rejects wrong siblings, unsupported normalizations, conflicts, incomplete inventory, missing scope/quality review and unapproved destinations.

The result is preflight eligibility only. publicationApproved is always false here. M4 database transactions now persist inventory/audit/revision checks and an independently reviewed public projection. Authentication/API exposure remain M5. [M4 report](../../../../docs/milestones/M4.md).
