# Security, source policy and privacy

## Trust and permissions
Official ownership, technical accessibility, collection rights and display/republication rights are distinct recorded decisions. No guessed permission from public access or a permissive robots file. Inaccessible policy remains unresolved, not automatically allowed. Permission revocation/expiry stops collection and applies a reviewed display/retention/takedown policy.

Alljobs remains disabled/permission_pending based on its observed terms. No messages requesting permissions are sent automatically. Record a genuine approval document when provided.

## Acquisition threat controls
Restrict methods and origins; verify redirect hops and DNS answers; block private/link-local/loopback/metadata addresses including IPv6/mapped forms; protect against DNS rebinding using suitable network controls. Block browser subresource/WebSocket/service-worker egress outside approved policy. Apply the same controls to PDF downloads, public JSON, OCR input URLs and retry paths.

Bound request count/time/depth, response/decompression sizes, redirects, pagination and parsing resources. Quarantine oversized/corrupt files; MIME/header checks; isolated parsers and malicious-content tests. No executable source config, unsafe transforms or remote code loading. Per-source kill switch and host-wide limits.

## Application controls
Established authentication, role checks, short-lived/secure sessions, CSRF/XSS defenses, secret management, parameterized DB access, sanitized rendering, CSP policy, secure headers and dependency review. API and agent credentials have different scopes. Public API cannot access private artifacts or draft tables by accidental generic serialization.

## Privacy
Do not scrape applicant profiles, user IDs, payment status or authenticated admit cards. Result PDFs may contain personal information: collect only necessary notice-level metadata and official link unless separately justified. Model requests contain only permitted public job information. Record processor/location/retention decisions before enabling a provider.

## Audit and retention
Audit source activation, policy decisions, approvals, overrides, suppression and merges. App roles cannot rewrite historical audit records. Hashing alone is not tamper-proof; enforce append permissions and immutable backup policy. Raw content may be retained only when allowed. Never expose unrestricted object-store keys. Establish takedown/correction ownership before launch.

## M8 implementation and remaining assurance

Native PDF/OCR runs in a separate non-root/no-capability/read-only/network-none container with CPU/PID/memory/tmpfs limits, without archive or credential mounts. Its bounded Unix API accepts bytes and fixed operations, never commands/paths/URLs. Production PDF processing refuses local fallback. This is a tested container boundary, not proof against every kernel/native exploit or a substitute for M9 corpus verification.

Explicit physical API/worker grants reconcile both table and column ACLs and reject dangerous role memberships/ownership. A fixed-search-path definer helper locks authorization rows without granting worker identity mutation; PUBLIC execution is denied. Worker cannot publish, alter staff credentials/roles or rewrite audit history. Production migration ownership remains separate and is never injected into web/parser containers. Config preflight requires fixed image digests and encrypted PostgreSQL/Redis settings; actual server credentials/grants/TLS must be validated on the chosen host.

API quotas use shared Redis with no error bypass. Exact trusted proxy IP configuration is separate from the gateway; forwarded spoofing does not change an untrusted peer's identity. Protected metrics are not a public endpoint. Request logs exclude raw URLs/queries, bodies, cookies and credentials; use generated IDs to correlate incidents. AES-GCM backup authentication rejects tampering, but actual offsite storage/key custody/rotation/production-size restore and reviewed deletion policy remain gates. [M8 evidence](milestones/M8.md).
