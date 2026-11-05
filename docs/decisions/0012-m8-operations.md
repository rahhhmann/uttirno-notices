# ADR 0012: Deployable runtimes and bounded operations rehearsal

Status: accepted, 2026-11-05. R03/R04/R18/R23/R24/R26/R29. M8 explicitly authorized; M9 remains unauthorized.

## Decision

Build the locked Node 24.19.0 application on a verified digest-pinned base, with separate app/native-parser image targets. No private environment, documents, key files, Git history or test data enter runtime images. The optional acquisition profile is explicit and still requires external signed sources, plans and a legitimately provisioned operator. Web startup never acquires, migrates or seeds.

Only the parser container installs Poppler/Tesseract. It has no network namespace connectivity, credentials or archive mount; non-root UID, no capabilities, read-only root, no-new-privileges, PID/CPU/memory limits and bounded writable temporary storage. API/worker transfer bounded PDF bytes and fixed high-level operations over a Unix socket. No caller commands/paths/URLs are accepted. Native response lineage and PNG bounds remain checked. Production PDF operations fail closed without the socket; local deterministic tests retain the bounded native path. Native package/model fingerprints remain recorded; Debian repository package rebuilds can change engines even with the Node base pinned, so release image digests are authoritative.

Provision separate pre-created migration-owner, API and worker DB credentials. No generated production accounts/passwords. Migration 0004 adds a fixed-search-path definer role-row-lock helper, explicitly excludes PUBLIC execution, and prevents needing worker UPDATE privileges on identity/role tables. Worker grants exclude staff credentials, identity changes, publication/reviews and history rewrites; only the API publishes. Owner-operated grant application is explicit after migrations; application startup never grants/migrates. API shared Redis quotas fail closed, and only an explicit list of proxy IPs can influence client identity. Existing shared-DB acquisition leases/host windows/signed budgets remain authoritative.

Expose protected, bounded-label metrics and redacted request correlation logs. Query strings, cookies, raw text, credentials and bodies are excluded. Monitor evaluation requires an owner and missing signals alert rather than succeeding. Development thresholds are examples, not agreed SLOs. Alert delivery defaults to operator output; no external person/channel is messaged without configuration and authorization.

Rehearse actual pg_dump/custom-format -> authenticated AES-GCM -> isolated database pg_restore, plus retained-original byte/hash recovery. Keys are external; the fixture key is ephemeral and never committed. The bounded 64-MiB helper and tiny synthetic corpus do not establish production backup capacity, offsite durability, key custody or RPO/RTO. A bounded synthetic load baseline reports measurements without inventing production targets.

## Host and rollback boundaries

Compose exposes only loopback preview ports. Portal/admin share the API network namespace to preserve the existing exact loopback internal-origin contract; replace the API/portal/admin namespace group together. This requires host-specific validation and is not an already integrated Uttirno main-site topology. The TLS proxy template is integrator input, not a tested/live certificate/domain setup. Exact browser Origin is preserved; /internal is never exposed publicly. Real trusted proxy IPs, SSO callback/cookies and consumer product isolation require actual host access.

Schema 0004 is additive but the old M7 image's strict schema readiness expects 0003. Do **not** blindly roll back to M7 against schema 0004. Retain a release built for 0004, or perform a planned write-frozen database/archive restore with explicit operator authorization. Container recreation is not proof of a previous-version-compatible rollback. No previous 0004-compatible deployed release exists yet.

Q05/Q06/Q08/Q09 and the M7 real-source gate remain unresolved. Thus M8's live staging, live staff provider, actual owner-channel alert, previous-release rollback, production-size restore/load and retention/takedown acceptance remain unchecked. Complete the independent code/rehearsal work, document observed evidence, then stop before M9. No production-ready claim.
