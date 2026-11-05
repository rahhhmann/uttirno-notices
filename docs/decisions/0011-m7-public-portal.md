# ADR 0011: Small API-backed public portal

Status: accepted, 2026-11-05. R11/R17/R19/R20/R26/R28/R29. M7 explicitly authorized in this chat; M8 remains unauthorized.

## Decision

Implement a responsive server-rendered Next portal using the existing PublicApiClient and runtime contracts. Anonymous reads carry no staff or consumer credentials. Search/filter URLs preserve Unicode and cursors; new filters reset pagination. Detail renders all 17 field states, original raw values, scoped evidence, permitted official document links, freshness and approved event history. An absent detail is never inferred to be a cancellation; independently available approved events can still be displayed. External content is literal escaped text and HTTP(S) links, never embedded active documents. Application CTA requires stated destination, open status and fresh verification; the raw destination remains visible as a field when publication permits it.

Use dynamic rendering, explicit no-store API fetches and no-store response headers. No static public factual projection, new persistence, acquisition, identity or consumer-account subsystem. Shared font tokens and SkipLink have actual portal/admin consumers. Use system dark-mode preference and explicit Bangla/English UI selection; original source language is preserved.

PORTAL_API_ORIGIN is a fixed server setting validated by the existing client, never a user-supplied URL. PORTAL_HOME_URL and PORTAL_BRAND_NAME adapt the shell. Optional PORTAL_PREPARATION_LINKS contains reviewed category/label/URL mappings; destinations must share the configured HTTPS home origin. No mappings are shipped or guessed; recommendations never imply eligibility.

## Limits and acceptance boundary

The host repository/router/assets and approved canonical public origin are unavailable (Q08). Keep pages noindex and emit no JobPosting, sitemap or guessed canonical destinations. Host-approved canonical/sitemap/indexing and eligible JobPosting lifecycle must be validated before indexing in the actual deployment; omission is not SEO completion. Do not enable sources or invent permissions to satisfy UI tests.

Synthetic API/DB and explicit synthetic HTTP display fixtures exercise development journeys. M7-T03 remains unchecked until an approved real-source record and the required real journey are available (Q01/Q03), plus complete accessibility acceptance. Selected automated axe/keyboard/mobile checks are not full WCAG certification. M8/M9 deployment, real-source activation and evaluation remain separately authorized work.
