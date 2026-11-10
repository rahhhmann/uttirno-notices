# Reviewed source configurations

Multi-source real tests: [registry](../live-sources.v1.json) and `npm run sources:live` explicitly run sequential local collection/extraction for the five configured scopes. Added Teletalk non-cadre, BCC own notice 153, two Bangladesh Bank own recruitment notices/TOR on its main authority board, and two BUET registrar announcements. Each has exact URLs, independent assessment/expiry and fixture metadata; no whole-site/other-employer/all-university approval is implied. Bangladesh Bank e-Recruitment rejection is a separate blocker. [Bangla local guide](../../docs/LOCAL_REAL_TEST.bn.md).

2026-11-10: [BPSC opt-in local assessment](bpsc-authority.public-local.json) follows [ADR0013](../../docs/decisions/0013-public-official-access.md). It is unsigned in Git, uses a seven-day local collection/retention decision, allows only the observed notice page and exact three attachment paths, and requires explicit local signing/run. A reviewed missing-robots policy permits actual 404/410 only. `display=link_only` does not approve public PDF republication or factual publication. Original drafts below remain historical disabled candidates.

Two M2 draft configurations exist: BPSC non-cadre Teletalk and the BPSC authority's current non-cadre static page. Their selectors come from observed minimal DOM fragments captured on 2026-11-03. They are unsigned candidates; collection/display remain unknown and no production trust key is provisioned.

The authority page's external Oracle object-storage links are observed but quarantined, not implicitly approved. Add an exact storage origin/path only after source relationship/access review. Alljobs remains permission-pending and is not enabled.

Do not turn candidate into active without ownership/access/display review, fixture verification, review dates, external trust provisioning and an authorized signature. See [research record](../../docs/research/M2-sources.md).
