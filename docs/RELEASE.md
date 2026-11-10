# Production release gates

Production-grade is a verified operating state, not a template label.

Source access may use the documented operator public-access basis in [ADR0013](decisions/0013-public-official-access.md); do not demand a permission letter for every public official source or claim public availability establishes unrestricted republication. Source-specific restrictions, retention, runtime checks and independent factual approval remain release gates.

All must pass before first release:
- R01-R29 linked to implementation and executed checks.
- Enabled sources have official provenance, current collection/display policy and real config samples.
- Complete accepted position/attachment inventory; no unknowns hidden behind completeness claims.
- Reviewed gold-set metrics pass; zero critical release-set errors and no unsupported published facts.
- Public/admin authorization and publication isolation tests pass.
- Egress/redirect/DNS/PDF/LLM abuse tests pass.
- DB migrations pass on empty and previous schemas; idempotent queue replay proven.
- Public/admin browser journeys and accessibility audit pass.
- Load/freshness target agreed and measured at realistic data size; no invented scale claim.
- Staging production-like deployment, rollback and restore drill completed.
- Secrets, retention/takedown, monitoring/alert owners and incident runbooks ready.
- Open questions that affect correctness/access/security resolved; unresolved optional features explicitly deferred.

Record release commit/image, config versions, test results, evaluation report, approver and known limits. A release can launch with a small proven source set; do not enable unverified sources to increase counts.
