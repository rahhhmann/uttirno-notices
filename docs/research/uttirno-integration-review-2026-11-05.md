# Uttirno integration research and verdict

Date: 2026-11-05. Research only; no M6 implementation or production changes authorized by this report.

## Verdict

The M1-M5 backend is a suitable foundation for integrating official job information into Uttirno. Integration is not completed or proven by those milestones. Keep the agent, reviewed publication, API and database boundaries; define the host product integration contract before fixing the remaining UI/deployment design. No backend rewrite is justified by the public-site evidence reviewed here.

## Observed public product and comparable patterns

- [Uttirno](https://uttirno.org/) was inspected in the integrated browser. The public landing page presents personalized exam preparation, AI mentoring, progress, practice and revision; BCS/BJS/NTRCA/primary/bank tracks; early Android access; Bangla typography, warm background, navy/gold accents and a dark-mode control. No job entry appeared in the observed homepage navigation. This does not prove that private apps/routes are absent. No backend repository, live authentication, API or mobile deep-link integration was inspected.
- [Live MCQ blog](https://web.livemcq.com/blog/) and its [Job Circular category](https://web.livemcq.com/blog/category/job-circular) place job notices alongside preparation guides, with category/search filters and navigation back to the preparation product. Lesson: shared product navigation and context; an article listing alone is less structured than Uttirno's intended field-level job model.
- [Testbook government jobs](https://testbook.com/govt-jobs-in-india) was inspected in the browser after text fetches timed out. It keeps exam/test-series navigation around jobs, education/location-oriented discovery, notification links and application dates. Lesson: jobs should lead into exam resources within the same recognizable product. Public UI does not reveal its internal service/auth architecture or prove its listing accuracy.
- [Ogroshor JobStream BD](https://ogroshor.com/en/exams/jobstream-bd) visibly brings circular discovery, official application/notice links, preparation actions, freshness and admit/result information into one journey. It advertises saved jobs/reminders and eligibility filters; these were not authenticated or functionally audited. Lesson: connect discovery with preparation, while labelling unknowns and source freshness.

These competitors are UX references only. They are not approved ingestion sources, evidence for official job facts or permission to collect Teletalk data. Their government-source, synchronization and completeness claims were not independently audited. Uttirno must continue using verified recruiting authorities/designated application origins and existing collection/display gates only.

## Completed versus missing

| Criterion | Observed implementation/status | Required remaining work |
|---|---|---|
| Safe official-job backend | M2-M5 source gates, evidence/drafts, independent publication, API contracts and typed clients | M9 legitimate real-source acceptance; do not activate unsigned candidate configs |
| Existing Uttirno navigation and appearance | Separate portal/admin foundations; no implemented host-site connection | M7 approved brand tokens/assets, shared header/footer/theme/locale and accessible mobile layouts |
| Public job discovery and detail | M5 API implemented; browser screens remain foundations | M7 jobs/search/filter/detail, official application link, explicit unknowns/freshness/events |
| Jobs to preparation | No reviewed track mapping or verified host app destinations | Define versioned job/exam-track mapping and approved destination contract for M7; no invented links or AI eligibility claims |
| Authentication | M5 staff/admin OIDC implementation, not live host-product SSO | M6 admin session integration; real provider validation before live staff use. Public browsing remains anonymous. Consumer account/entitlement sharing is separate scope |
| Admin operations | Audited/generation-checked APIs exist | M6 real review, original document/evidence, duplicate/conflict and source/run/expiry/drift screens |
| Discovery/SEO | General page metadata exists; no job-specific sitemap/canonical/JobPosting implementation observed | M7 SEO and lifecycle rules; M8 hosted crawl/access checks |
| Deployment/security/performance | Local/CI checks; no production host integration or measured load | M8 domain/proxy/TLS, cookie/CORS topology, physical DB grants, quotas, monitoring, restore and staged rollback |
| Integrated acceptance | M5 API/DB contract tests, not a real host-product journey | M6/M7 UI/accessibility tests; M8 staging integration; M9 official-source-to-published-page acceptance |

The recorded M5 result is 172 tests plus builds/smoke, not a production-readiness or host-integration certification. Current code/status was inspected for this review; the full test suite was not rerun for this research-only task.

## Recommended integration shape (proposed, not deployed)

1. Prefer public jobs under the Uttirno domain at /jobs and /jobs/<stable-id> if the existing hosting/router permits. A separately deployed Next.js portal may still be routed through an approved host proxy. If that is impractical, use jobs.uttirno.org with the same branding/navigation. The domain route and deployment topology need confirmation from the actual host repository/hosting configuration; neither is decided by observing the homepage.
2. Keep admin access on a restricted staff surface. Portal/admin use the versioned API, never direct shared database access. Keep worker/acquisition independently operated and private. Avoid an iframe as the primary public integration because responsive navigation, accessibility and search indexing should belong to actual pages.
3. Job detail should clearly separate official application from optional related preparation. Versioned reviewed mapping connects job category/exam track to an existing Uttirno destination. If no mapping/destination exists, omit the preparation action rather than guessing. Never present a preparation recommendation as official qualification or application approval.
4. Match approved Uttirno visual tokens, locale, dark-mode behavior and mobile navigation; do not invent official assets from public screenshots. Reuse shared components where code ownership actually permits.
5. Staff OIDC does not automatically provide consumer app SSO. Do not share passwords, database tables or broad domain cookies as a shortcut. Anonymous job reads need no consumer SSO. Saved jobs, personalized recommendations, notification delivery and paid entitlement checks require explicit added requirements/privacy and interface decisions; currently saved searches/notifications are deferred in the product specification.
6. Use stable canonical detail URLs, sitemap and share metadata. Add JobPosting only to eligible individual approved postings with supported required facts; never invent schema fields or use list-page markup. Expired/withdrawn data must follow Google's lifecycle rules and current display permission. [Google's primary guidance](https://developers.google.com/search/docs/appearance/structured-data/job-posting) requires canonical handling, valid properties, public crawlability and expiration/removal management; it does not guarantee search appearance.

## Integration checkpoint before final UI decisions

Resolve Q08 earlier than final styling: obtain the actual Uttirno web/app architecture, hosting/router ownership, approved design assets/tokens, preparation track IDs/destinations and intended mobile linking behavior. For any shared authenticated feature, separately establish the identity-provider/session/entitlement contract. A public URL cannot supply that evidence. Existing Q05/Q08 correctly record external dependencies; they are not completed integration tasks.

Suggested milestone refinements, requiring incorporation when the next milestone is authorized:

- M6: staff-session/domain contract and brand-compatible admin review; preserve all source/evidence/publication gates.
- M7: implement the host navigation/visual contract, job-to-preparation mapping, real public UI, SEO and phone/keyboard/accessibility journeys.
- M8: validate the actual host routing, TLS, API/cookie/origin boundaries, monitoring, performance, rollback and live staff provider in staging.
- M9: onboard legitimate official sources and verify original notice -> reviewed job -> Uttirno page -> correct official destination; check amendment/suppression/freshness and real corpus accuracy.

Integration acceptance should include: main-site jobs navigation; deep-linked job refresh/share; working return to preparation; compatible mobile/theme/language state; login/logout/expiry/role behavior; no draft/private data leaks; revoked facts removed from views and indexable markup; worker/job-service failure not taking down the preparation product; measured performance and rollback.

No M6-M9 task is marked complete by this research. No source settings, accounts, production site or implementation code was changed.
