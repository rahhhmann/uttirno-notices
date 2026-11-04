# API clients

Browser-safe PublicApiClient and AdminApiClient use shared runtime contracts, bounded responses, timeouts and sanitized ApiClientError. Depend on contracts only; no database, server environment, credentials or agent imports.

Public methods cover jobs, detail, events and authorities. Admin methods cover session/CSRF, inventory, immutable review, approval/rejection, controls, schedule, identity resolution and suppression. Retain an explicit mutation idempotency UUID across retries. Admin cookies are HttpOnly and credentials are included; the CSRF token stays in client memory after session(). Browser requests need the configured exact admin origin. loginUrl() starts full-page OIDC redirection. No token is saved to localStorage.

These clients are ready for M6/M7 integration; no UI behavior is claimed here. [API](../../docs/API.md).
