# Verification — M3

The pure [domain verifier](../../../../packages/domain/src/extraction.ts) reproduces field meaning/value/quote/scope against the exact hashed text and reviewed plan. It rejects wrong siblings, unsupported normalizations, conflicts, incomplete inventory, missing scope/quality review and unapproved destinations.

The result is preflight eligibility only. publicationApproved is always false. Authenticated review, durable inventory, audit/revision checks and approved public projection remain M4/M5. [M3 report](../../../../docs/milestones/M3.md).
