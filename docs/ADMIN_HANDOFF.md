# Staff console integration handoff

For the 2026-11-10 local rehearsal, supplied Google-client setup and complete pipeline checklist, start with [pipeline handover](PIPELINE_HANDOFF.md).

M6 delivers a separately runnable staff console and API-mediated review pipeline. The Uttirno lead can synchronize approved branding/navigation/hosting without moving database or acquisition code into the UI. [Research verdict](research/uttirno-integration-review-2026-11-05.md), [ADR0010](decisions/0010-m6-admin-and-handoff.md).

| Setting / interface                   | Owner and contract                                                                                                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADMIN_API_ORIGIN                      | Next server-only exact HTTPS origin, or explicit loopback HTTP for local services. No path, credentials or caller-selected destination.                                                               |
| ADMIN_HOME_URL / ADMIN_BRAND_NAME     | Approved HTTPS product home and wordmark. CSS tokens in the admin styles provide theme adaptation. No consumer login integration is assumed.                                                          |
| ADMIN_ORIGIN                          | API's exact external browser origin for credentialed CORS and mutations. The gateway retains Origin; it does not substitute a trusted one for an attacker.                                            |
| API_PUBLIC_ORIGIN / AUTH_REDIRECT_URI | API public identity callback; register the fixed /v1/admin/auth/callback with the actual provider. For same-origin staff proxy deployment, make that callback resolve through the staff origin.       |
| Staff identity                        | Generic OIDC is implemented; provision exact issuer/subject roles explicitly. A consumer session/email/domain alone grants no staff role. No shared-password or broad domain-cookie shortcut.         |
| PRIVATE_ARCHIVE_ROOT                  | API's read-only mount of the worker's existing private archive root (bytes subdirectory). No arbitrary file/URL selector is exposed. Retention, hashes and current permissions are checked for reads. |
| Public jobs and preparation           | M7 provides /jobs and detail through the existing API, configurable public branding/home and optional reviewed preparation mappings. Actual host routing, assets and indexing remain unconfirmed; see [portal](../apps/portal/README.md). |

## Lead acceptance before live use

Verify exact DNS/proxy/TLS and callback routing, secure Host cookie set/clear behavior, login/logout/expiry/roles/CSRF, private cache behavior and staff-cookie isolation. Verify native tool/runtime isolation and the private read-only archive mount using a permitted original. Confirm that API/worker failure does not take down the preparation product. Exercise a scoped amendment and display revocation through all relevant caches, pages and later indexable metadata. Agree and measure load/freshness targets, monitoring ownership, rollback and backup/restore. These are M8/M9 operating gates, not completed host integration claims.

## What is intentionally separate

No consumer CV/applicant records, autonomous application/payment, shared learning database, paid entitlement enforcement, saved-job account or notification service was added. Those features require explicit requirements/interfaces/privacy decisions. Only verified recruiting authorities and designated application platforms can become sources; competitor UX research never authorizes ingesting competitor job content.
