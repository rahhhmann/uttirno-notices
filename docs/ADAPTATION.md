# Easy adaptation and onboarding

## Aim
Most new table/card/list/detail sites should need configuration, not changes to the collector. New formats may need a small adapter implementing the same contract. New job titles never require source code edits.

## Planned configuration
Versioned JSON validated against runtime schemas. Fields: source_id, authority, authority_class, ownership_evidence[], exact_origins[], attachment_origins[], source_status, collection_access, display_access, robots_review, reviewed_by/at, permission_expiry, adapter_type, seed_urls, ready_condition, list_items, detail_link, pagination strategy, sibling-role navigation, field_mappings, document_links, language, timezone, rate/size/page limits, revisit schedule and drift expectations.

Mapping primitives: CSS selector + text/attribute, scoped label/value, table column, PDF references, JSON path for observed approved public endpoints. Date/number transformations use an allowlisted transform catalogue. No eval, arbitrary JavaScript, shell, unreviewed regex execution or arbitrary remote imports.

This is a design contract, not a validated config schema yet. M2 implements schemas and bad-config tests.

## Process
1. Register URL as candidate and document official ownership; reject ineligible source classes.
2. Check collection/display permissions and public access. Bounded research needs a permitted research policy; it does not inherit production enablement.
3. Inspect listing/detail/attachment and pagination with request/resource limits. Observe actual endpoint calls only; no guessed APIs or ID enumeration.
4. Suggest config using generic primitives, optionally with an LLM. Proposals have no authority to enable network or publish.
5. Validate on saved real fixtures: selector cardinality, sibling/row scoping, pagination termination, link validity, all positions and documents accounted for.
6. Compare extracted samples against a reviewer-labelled sample. Approve signed/versioned config with required role.
7. Run bounded staging canary; enable production source separately.
8. Monitor drift; pause/quarantine when the structure or meaning changes. Re-approve new config version; do not auto-repair directly in production.

## Example acceptance exercise
A synthetic table site and synthetic card site use different configs with the same engine. Add a previously unseen job title to each: it must survive ingestion unchanged without code edits. Separately validate each actual BPSC/Teletalk config with current official fixtures; synthetic success does not authorize the real source.

## Exceptions
HTTP-only legacy official links require a reviewed origin-specific exception, no credentials and no silent downgrade. IP-only links and new storage hosts remain quarantined until provenance/network controls pass. An official page linking a site is evidence for review, not automatic unlimited host approval.
