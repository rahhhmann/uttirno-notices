# Restricted acquisition boundary

SourceClient is the public acquisition boundary. Each request/hop/retry rechecks signed source/permission/trust policy, exact origin/path/query scope, DNS/public-address checks and source fingerprint. The internal HTTP transport pins validated DNS answers, keeps the original hostname for Host/TLS, rejects partial/oversized/decompression-bomb bodies and enforces deadlines. Never import pinnedRequest directly in a feature adapter; integration tests deliberately exercise it below the public policy boundary using loopback fixtures.

Robots metadata is a narrow bootstrap exception after ownership/collection approval, never an access bypass. Missing robots defaults to deny; only a signed reviewed 404/410 exception permits absence. Invalid/HTML/401/403/5xx robots fail closed. Redirected robots must still be /robots.txt on an approved origin. Longer crawl delays require reviewed configuration.

The browser is offline with service workers/WebSockets blocked. Every HTTP response is fulfilled by SourceClient, no request headers/cookies from the page are forwarded. GET only; output/DOM/request/time/JS-heap bounds; redirects that change browser origin/URL fail closed. Browser sandboxing is enabled.

Host serialization is shared inside a single acquisition broker process. M4 must add distributed leases before multiple broker processes are allowed. Production OS/container egress and resource hardening remains part of M8; these application controls are not a replacement for it.
