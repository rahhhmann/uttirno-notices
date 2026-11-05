# Public portal

Small server-rendered Next.js public UI at /jobs and /jobs/<position-id>, using PublicApiClient only. Anonymous reads never forward staff/consumer cookies. Search/filter URLs retain Unicode, pagination and locale; detail exposes reviewed fields, explicit unknowns, permitted source links, scoped evidence, freshness and approved event history. API data and pages are no-store.

Export PORTAL_API_ORIGIN (exact HTTPS origin or explicit loopback HTTP), PORTAL_HOME_URL (approved HTTPS home), PORTAL_BRAND_NAME into the Next process. Root API .env is not automatically loaded by Next. Optional PORTAL_PREPARATION_LINKS is a JSON array of reviewed category/label/url mappings, bounded to 20 and the same home origin. Default is no mappings. Labels are literal text, recommendations are optional, and no eligibility is inferred.

System light/dark preference, Bangla/English UI (?lang=en), shared font tokens and skip navigation are supported. Original language is preserved. No consumer login, saved jobs, CVs or notifications.

Build before browser tests: npm run build --workspace @uttirno/portal. npm run test:admin now runs both public and staff browser cases against built apps. Synthetic fixtures are development evidence only. M7-T03 remains blocked on an approved real source and full required acceptance.

Actual Uttirno router/assets/canonical hosting are unconfirmed. Pages remain noindex; no JobPosting, sitemap or guessed canonical is emitted. Host indexing/SEO integration remains explicitly incomplete. See [decision](../../docs/decisions/0011-m7-public-portal.md) and [acceptance](../../docs/milestones/M7.md).
