# ADR 0002 — Official origin does not imply collection/display permission
Status: accepted.

Decision: Only government recruiting authorities, public institutions and designated official application platforms in first release. Exclude Bdjobs/private marketplaces/third-party aggregators. Validate exact origins and authority evidence; no suffix wildcard trust.

All sources default disabled until ownership, collection, technical and display gates pass. BPSC/Teletalk are the first end-to-end pair; BCC/BB/university sources follow individual acceptance, with research allowed early under a bounded permitted policy. Alljobs remains permission-pending based on observed written-consent terms.

Evidence: [Alljobs terms](https://alljobs.teletalk.com.bd/terms-and-conditions), observed 2026-11-03, section 6.2; [BPSC current non-cadre page](https://bpsc.gov.bd/pages/static-pages/6ad5e44f3c97e6c4ab675017); [BCC official system description](https://nda.bcc.gov.bd/page/service-detail.jsp?name=e-recruitment). Recheck policy before activation; these references are not blanket scraping licenses.

Consequence: no production collector runs from a default source switch. Current research registry disabled during planning. No outbound permission requests sent.
