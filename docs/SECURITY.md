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
