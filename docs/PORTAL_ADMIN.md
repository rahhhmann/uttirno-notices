# Portal and admin product specification

## Portal routes and journeys

Jobs list/search/filter -> job detail -> official application destination. Authority overview and accessible error/empty/stale states. Mobile-first Bangla/English typography and original text. Date/fee display never substitutes unsupported defaults.

Detail shows authority, title/post code, vacancies, qualifications/exceptions, age/reference date, salary, fee/payment distinction, documents, application steps, deadlines, original notice, amendments and last verification. Missing facts explicitly labelled. Only permitted attachments or official links displayed. Link-out clearly identifies the external authority; no promise of application completion.

First release has no CV upload/account/employer dashboard. Saved searches/notifications may be added after release through an explicit task and delivery policy.

## Admin journeys

Source candidate -> ownership/access/display review -> config proposal -> real sample comparison -> canary -> enable.
Run monitor -> failure/drift -> pause -> config fix -> replay -> approval.
Draft position -> original PDF/page side-by-side -> per-field evidence/conflict review -> approve/reject.
Amendment -> affected scope -> suppress stale critical facts -> review -> publish new version.
Duplicate review and source-policy expiry/revocation workflows.

Actions show current state, rationale and audit history. Activation controls cannot override gates merely because a switch is on. No generic button named verified that collapses ownership, extraction and publication into one flag.

## Quality acceptance

Keyboard navigation, focus visibility/order, labelled fields/errors, screen-reader names, touch layouts, contrast, Bangla wrapping and timezone clarity. Target WCAG 2.2 AA; no accessibility claim without audit. Test loading, empty, error, stale, conflicting, revoked and unapproved cases with API fixtures, then one real approved end-to-end record.

Design tokens/components are shared; feature-specific business behavior stays in its application. Branding decisions follow existing Uttirno identity once approved assets are available; placeholder assets are never called official.

## M6 implemented staff boundary

Source/review/duplicate/event/operations/audit screens are implemented through typed API clients. Retained PDFs render as bounded PNG pages; HTML/text is literal and full originals download as attachments. External signing and all API permission/evidence/revision gates remain mandatory. [M6 report](milestones/M6.md) records executed results/limits; [host handoff](ADMIN_HANDOFF.md) defines the lead integration contract. Public portal features remain M7.

## M7 public implementation boundary

Public /jobs and position details use existing approved-only API contracts. URL filters/cursors/locale, mobile layouts, system dark preference, shared font/skip navigation, all fact states, permitted original links, scoped evidence and event history are implemented. Dynamic no-store reads never forward staff/consumer credentials. Optional reviewed preparation mappings are empty by default. Actual host assets/routing/indexing are unconfirmed: noindex remains, with no JobPosting/sitemap or guessed canonical. [M7 report](milestones/M7.md) separates executed development checks from the still-unmet real-source/full acceptance gate.
