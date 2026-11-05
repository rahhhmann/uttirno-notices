# Current state

Updated: 2026-11-05, after authorized M7 development acceptance.

## Completed

M0-M6 are complete; historical implementation/results are recorded in the milestone reports. Latest prior committed implementation is M6 f61bbc65994073ec94f2384f8a69071f0003937d. M7 local acceptance is recorded below; remote CI is separate evidence and must be checked for the exact pushed implementation commit.

M7-T01 and M7-T02 are complete: responsive Bangla/English public shell, /jobs URL search/filter/cursor states, full reviewed detail/evidence/original/application destination/freshness/events, explicit unknown/conflicting/closed/revoked states, shared font/skip-navigation and configurable host home/brand/optional reviewed preparation mappings. Anonymous dynamic API reads forward no credentials and are no-store. [M7 acceptance](milestones/M7.md), [ADR0011](decisions/0011-m7-public-portal.md), [portal integration](../apps/portal/README.md).

132 unit cases (21 files), four prototype regressions, 43 integration cases (10 files) and 12 built public/admin browser cases (two files) passed: **191 total**. Lint/boundaries/strict application/test types, all package/app builds and built API/portal/admin HTTP smoke passed. One non-blocking lint style suggestion remains. Heavy checks ran sequentially. Selected light/dark axe, keyboard/mobile/Unicode and inspected mobile screenshot are bounded evidence, not full accessibility certification.

## Remaining and approval boundary

**M7-T03 remains unchecked.** There is no legitimately approved real-source record for its real source -> reviewed portal journey (Q01/Q03), and selected development accessibility checks do not establish full required acceptance. All independent authorized M7 work is complete. **STOP before M8**; do not start M8/M9 or activate sources to make this gate pass without explicit authorization and legitimate evidence.

Actual Uttirno repository/router/assets/approved preparation URLs and canonical hosting remain Q08. No main-site integration or deployment occurred. Host settings and optional empty preparation mapping are implemented; pages remain noindex with no JobPosting, sitemap or guessed canonical. Host indexing/SEO lifecycle remains unverified. Consumer identity/entitlements/saved jobs/CV/notifications remain outside scope.

## Sources and local data

Real sources remain unsigned disabled candidates with unresolved collection/display/retention evidence. No real staff account, live provider, source activation, applicant processing or model provider was introduced. Tests use guarded temporary synthetic schemas/queues/keys/accounts; separate synthetic HTTP fixtures cover display edge cases, never real-source acceptance. No recruiting-site calls occurred in ordinary tests.

PostgreSQL remains canonical. No M7 migration or seed; schema stays 0003. Private originals remain protected by existing gates. Root .env is ignored and was not changed. Dedicated services use 55432/56379/54566 with retained volumes; native PostgreSQL 5432 is untouched. Services were stopped after acceptance with local:down, retaining volumes. The pre-existing requested CHAT_HANDOFF.txt is preserved and contains historical M6 handoff context; this status is current.

M8 deployment/live provider/physical DB grants/native isolation/quotas/operations/restore and M9 legitimate source/gold-set/release acceptance remain outstanding. No production-readiness claim. [Open questions](OPEN_QUESTIONS.md), [release gates](RELEASE.md).
