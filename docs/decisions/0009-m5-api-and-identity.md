# ADR 0009: M5 API and identity

Status: accepted for M5, 2026-11-04. Implements R18/R19/R20/R23/R26; extends ADR 0008.

## Decision

Use Fastify with runtime Zod contracts and generated OpenAPI 3.1. Public queries read approved, unsuppressed revisions and recheck current signatures/display/retention and exact official URLs. Unicode NFC literal search uses parameterized SQL; versioned aliases/categories live in configuration. Original titles/unknowns remain intact. Derived categories are labelled. HMAC cursors bind filters/taxonomy, UUID order and a publication cutoff, expire after 15 minutes and never bypass revocation. Updating a publication can remove it from an in-progress cursor window; cursor pagination is not an archival snapshot.

Use generic standards-based confidential OIDC through openid-client, PKCE S256, nonce/state and mandatory RS256 signature/issuer/audience/expiry validation. Exact approved provider origins, bounded redirect-free requests and a fixed callback constrain the protocol. No provider was supplied; the generic choice avoids inventing customer accounts or imposing a vendor. Live issuer, client registration and staff subjects remain deployment prerequisites (Q05).

Identity is issuer plus stable subject, explicitly provisioned into PostgreSQL roles. Email, domain and provider role claims grant nothing. Owner-only CLI bootstrap creates the first administrator only when none exists; never automatic, never an HTTP endpoint. Login transactions are encrypted with AES-GCM and expire after five minutes. Cookies contain random opaque values; only hashes persist. Secure Host-prefixed cookies in HTTPS, fixed eight-hour absolute and fifteen-minute idle sessions, live role/disabled checks, exact Origin and session-bound CSRF protect browser mutations. Development HTTP is loopback only. Last-admin removal is denied.

API mutations derive actors from sessions. Repositories recheck session and role under transaction locks; logout/revocation fences writes. Idempotency keys bind actor, endpoint and body; result and domain writes commit together, retained for 24 hours. Review generation, independent reviewer, source policy and deterministic evidence gates remain mandatory. Per-process IP rate limiting and bounded bodies/pages apply. Production distributed rate limiting, physical DB grants, proxy/origin topology, cleanup scheduling and load testing remain M8.

## Consequences

Typed browser-safe API clients depend on contracts only. Portal/admin still require M6/M7 implementation. No source activation, public binary serving, default staff account or live IdP success is implied. Original bytes remain private; M6 review uses permitted immutable text and official document links. Source onboarding/configuration proposals remain untrusted until existing review gates pass.
