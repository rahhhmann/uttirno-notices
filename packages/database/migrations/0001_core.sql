CREATE TABLE admin_identities (id text PRIMARY KEY, disabled boolean NOT NULL DEFAULT false);
CREATE TABLE admin_roles (actor_id text NOT NULL REFERENCES admin_identities(id), role text NOT NULL
  CHECK(role IN ('operator','reviewer','source_approver','administrator')), PRIMARY KEY(actor_id,role));
CREATE TABLE authorities (id text PRIMARY KEY, name text NOT NULL, evidence jsonb NOT NULL,
  created_by text NOT NULL REFERENCES admin_identities(id));
CREATE TABLE sources (id text PRIMARY KEY, authority_id text NOT NULL REFERENCES authorities(id),
  current_fingerprint text, collection_halted boolean NOT NULL DEFAULT true, display_halted boolean NOT NULL DEFAULT true,
  control_epoch integer NOT NULL DEFAULT 0, reason text, next_due timestamptz NOT NULL DEFAULT now(),
  not_before timestamptz NOT NULL DEFAULT '-infinity',
  interval_seconds integer NOT NULL DEFAULT 21600 CHECK(interval_seconds BETWEEN 3600 AND 604800),
  last_checked timestamptz, last_success timestamptz);
CREATE TABLE source_config_versions (source_id text NOT NULL REFERENCES sources(id), fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
  version integer NOT NULL CHECK(version>0), bundle jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_id,fingerprint), UNIQUE(source_id,version));
ALTER TABLE sources ADD CONSTRAINT source_current_config FOREIGN KEY(id,current_fingerprint)
  REFERENCES source_config_versions(source_id,fingerprint) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE source_policy_reviews (id uuid PRIMARY KEY, source_id text NOT NULL REFERENCES sources(id),
  fingerprint text NOT NULL, actor_id text NOT NULL REFERENCES admin_identities(id),
  decision jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(source_id,fingerprint) REFERENCES source_config_versions(source_id,fingerprint));
CREATE TABLE source_runs (id uuid PRIMARY KEY, source_id text NOT NULL, fingerprint text NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK(request_count>=0), total_bytes bigint NOT NULL DEFAULT 0 CHECK(total_bytes>=0),
  state text NOT NULL CHECK(state IN ('queued','running','complete','failed','blocked')),
  inventory jsonb, created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
  FOREIGN KEY(source_id,fingerprint) REFERENCES source_config_versions(source_id,fingerprint));
CREATE TABLE stage_runs (id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'), run_id uuid NOT NULL REFERENCES source_runs(id),
  payload jsonb NOT NULL, state text NOT NULL CHECK(state IN ('queued','running','retry','complete','dead','blocked')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), max_attempts integer NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 10),
  available_at timestamptz NOT NULL DEFAULT now(), lease_token uuid, lease_until timestamptz,
  checkpoint jsonb, error_code text, updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE stage_runs ADD COLUMN lease_actor text REFERENCES admin_identities(id);
CREATE TABLE artifacts (sha256 text PRIMARY KEY CHECK(sha256 ~ '^[a-f0-9]{64}$'),
  size integer NOT NULL CHECK(size BETWEEN 1 AND 10485760), media_type text NOT NULL,
  storage_key text NOT NULL CHECK(storage_key ~ '^[a-f0-9]{64}$'));
CREATE TABLE artifact_captures (id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
  sha256 text NOT NULL REFERENCES artifacts(sha256), source_id text NOT NULL, fingerprint text NOT NULL,
  url text NOT NULL, captured_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
  response jsonb NOT NULL, FOREIGN KEY(source_id,fingerprint) REFERENCES source_config_versions(source_id,fingerprint),
  CHECK(expires_at>captured_at));
CREATE TABLE artifact_text_versions (text_version text PRIMARY KEY CHECK(text_version ~ '^[a-f0-9]{64}$'),
  capture_id text NOT NULL REFERENCES artifact_captures(id), document jsonb NOT NULL, engine text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE circulars (id uuid PRIMARY KEY, authority_id text NOT NULL REFERENCES authorities(id), memo text NOT NULL,
  generation integer NOT NULL DEFAULT 0 CHECK(generation>=0), UNIQUE(authority_id,memo));
CREATE TABLE circular_revisions (id uuid PRIMARY KEY, circular_id uuid NOT NULL REFERENCES circulars(id),
  run_id uuid NOT NULL REFERENCES source_runs(id),
  content_digest text NOT NULL CHECK(content_digest ~ '^[a-f0-9]{64}$'),
  generation integer NOT NULL, source_id text NOT NULL, fingerprint text NOT NULL,
  inventory jsonb NOT NULL, bundle jsonb NOT NULL, created_by text NOT NULL REFERENCES admin_identities(id),
  parent_id uuid REFERENCES circular_revisions(id), created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(source_id,fingerprint) REFERENCES source_config_versions(source_id,fingerprint), UNIQUE(circular_id,generation), UNIQUE(circular_id,content_digest));
CREATE TABLE positions (id uuid PRIMARY KEY, circular_id uuid NOT NULL REFERENCES circulars(id), post_key text NOT NULL,
  recruitment_state text NOT NULL DEFAULT 'unknown' CHECK(recruitment_state IN ('unknown','upcoming','open','closed','cancelled')),
  UNIQUE(circular_id,post_key));
CREATE TABLE position_revisions (id uuid PRIMARY KEY, position_id uuid NOT NULL REFERENCES positions(id),
  circular_revision_id uuid NOT NULL REFERENCES circular_revisions(id), text_version text NOT NULL REFERENCES artifact_text_versions(text_version),
  value jsonb NOT NULL, UNIQUE(circular_revision_id,position_id), UNIQUE(id,position_id));
CREATE TABLE field_evidence (revision_id uuid NOT NULL REFERENCES position_revisions(id), field text NOT NULL,
  ordinal integer NOT NULL, evidence jsonb NOT NULL, PRIMARY KEY(revision_id,field,ordinal));
CREATE TABLE application_routes (revision_id uuid PRIMARY KEY REFERENCES position_revisions(id), destination text NOT NULL,
  instructions jsonb NOT NULL);
CREATE TABLE source_listings (source_id text NOT NULL REFERENCES sources(id), url text NOT NULL,
  sha256 text NOT NULL REFERENCES artifacts(sha256), circular_id uuid NOT NULL REFERENCES circulars(id),
  PRIMARY KEY(source_id,url,sha256,circular_id));
CREATE TABLE duplicate_candidates (id uuid PRIMARY KEY, source_id text NOT NULL REFERENCES sources(id),
  run_id uuid NOT NULL REFERENCES source_runs(id), payload jsonb NOT NULL,
  reason text NOT NULL, resolved_by text REFERENCES admin_identities(id), resolution jsonb,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE recruitment_events (id uuid PRIMARY KEY, circular_id uuid NOT NULL REFERENCES circulars(id),
  kind text NOT NULL CHECK(kind IN ('circular','amendment','extension','cancellation','exam','admit','result')),
  targets uuid[] NOT NULL CHECK(cardinality(targets)>0), evidence jsonb NOT NULL,
  text_version text NOT NULL REFERENCES artifact_text_versions(text_version),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')),
  created_by text NOT NULL REFERENCES admin_identities(id), resolved_by text REFERENCES admin_identities(id),
  resolved_revision uuid REFERENCES circular_revisions(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE review_actions (id uuid PRIMARY KEY, circular_revision_id uuid NOT NULL REFERENCES circular_revisions(id),
  attestation jsonb NOT NULL DEFAULT '{}',
  actor_id text NOT NULL REFERENCES admin_identities(id), action text NOT NULL CHECK(action IN ('approved','rejected','suppressed','restored')),
  reason text NOT NULL CHECK(length(trim(reason))>0), expected_generation integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,circular_revision_id));
CREATE TABLE published_positions (position_id uuid PRIMARY KEY REFERENCES positions(id),
  revision_id uuid NOT NULL, circular_revision_id uuid NOT NULL REFERENCES circular_revisions(id),
  review_action_id uuid NOT NULL, suppressed boolean NOT NULL DEFAULT false, reason text,
  published_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(revision_id,position_id) REFERENCES position_revisions(id,position_id),
  FOREIGN KEY(review_action_id,circular_revision_id) REFERENCES review_actions(id,circular_revision_id));
CREATE TABLE audit_events (id uuid PRIMARY KEY, actor_id text NOT NULL REFERENCES admin_identities(id),
  action text NOT NULL, entity_id text NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE outbox_events (id uuid PRIMARY KEY, dedupe_key text UNIQUE NOT NULL,
  topic text NOT NULL CHECK(topic IN ('stage','publication','suppression')), payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz, lease_token uuid, lease_until timestamptz);
CREATE TABLE resource_leases (resource_key text PRIMARY KEY, token uuid NOT NULL,
  fence bigint NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL);
CREATE TABLE host_windows (host text PRIMARY KEY, last_start timestamptz NOT NULL,
  reserved_until timestamptz NOT NULL, interval_ms integer NOT NULL CHECK(interval_ms BETWEEN 4000 AND 60000));
