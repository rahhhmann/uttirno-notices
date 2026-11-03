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
