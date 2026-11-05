# Browser acceptance

admin.test.ts runs built staff Next.js with real API/PostgreSQL and signed ephemeral OIDC. portal.test.ts runs built public Next.js with real API/PostgreSQL for draft/publication/revocation and explicitly synthetic HTTP fixtures for display edge states. No recruiting-site requests, seeded production accounts or real-source permissions are involved.

Build both apps before npm run test:admin. Tests are sequential. Selected automated axe light/dark, keyboard and phone-size checks are bounded evidence, not complete WCAG certification. Approved real-source M7-T03 acceptance remains unchecked; see [M7](../../docs/milestones/M7.md).
