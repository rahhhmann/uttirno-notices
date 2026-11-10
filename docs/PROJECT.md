# Project charter

## Objective
Build two connected systems: (A) a verifiable official-job information agent and (B) the Uttirno job portal, supported by an internal admin application. Adaptation to new official sources must be easy without promising universal zero-code crawling.

## First-release audience and boundaries
Bangladesh job seekers, including CSE/ICT candidates; internal researchers/reviewers/operators. Public browsing does not require an account. Portal links to each verified official application destination.

Included: official source registry, public notices/documents, position-level eligibility and application guidance, amendments, search/filter, evidence, source health, admin review, publication control, operations and deployment.

Excluded: Bdjobs/private marketplaces/third-party job aggregators; employer posting marketplace, CV collection, ATS, applicant ranking, autonomous applications/payments, login scraping and guaranteed nationwide completeness.

Government employer sites, public universities and authority-designated application platforms are candidates. Official employer-owned private company careers are outside the first release; adding them requires an explicit scope decision, not an onboarding shortcut.

## Source policy
2026-11-10 update: [ADR0013](decisions/0013-public-official-access.md) permits accountable public-access assessment for official public sources without a universal written-permission requirement. Respect restrictions and broker gates; collection/private retention/public display remain separate decisions.

BPSC authority notices plus verified BPSC Teletalk application pages form the first end-to-end slice. BCC, Bangladesh Bank and selected government/university notice boards can be researched from the start and enabled individually after their acceptance gates. Alljobs is permission-pending for collection/republication following observed terms. Official origin, technical extraction, collection permission and display permission are independent checks.

## Delivery principle
Complete a narrow real pipeline from source to published portal before adding breadth. A source is not complete until every attachment and relevant position in the accepted sample is accounted for. Missing data is explicit. Raw archive retention/display must respect source permissions.

## Boundaries of this scaffold
Directory structure is organizational preparation, not proof of implementation, security, accuracy, uptime or scale. No package installation, schema migration, UI build, cloud deployment or production crawl is part of M0.
