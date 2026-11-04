CREATE TABLE identity_bindings (
  issuer text NOT NULL, subject text NOT NULL, actor_id text NOT NULL REFERENCES admin_identities(id),
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(issuer,subject));
CREATE TABLE login_transactions (
  state_hash text PRIMARY KEY CHECK(state_hash ~ '^[a-f0-9]{64}$'), browser_hash text NOT NULL CHECK(browser_hash ~ '^[a-f0-9]{64}$'),
  encrypted_payload text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE admin_sessions (
  token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'), actor_id text NOT NULL REFERENCES admin_identities(id),
  issuer text NOT NULL, subject text NOT NULL, expires_at timestamptz NOT NULL,
  idle_expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(issuer,subject) REFERENCES identity_bindings(issuer,subject));
CREATE INDEX session_expiry ON admin_sessions(expires_at,idle_expires_at) WHERE revoked_at IS NULL;
CREATE INDEX public_job_cursor ON published_positions(position_id) WHERE NOT suppressed;
CREATE INDEX public_event_targets ON recruitment_events USING gin(targets) WHERE state='approved';
CREATE TABLE api_idempotency (
  actor_id text NOT NULL REFERENCES admin_identities(id), request_key uuid NOT NULL, request_hash text NOT NULL,
  result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  PRIMARY KEY(actor_id,request_key));
