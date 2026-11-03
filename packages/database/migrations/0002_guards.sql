CREATE FUNCTION reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IMMUTABLE_HISTORY'; END $$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['authorities','source_config_versions','source_policy_reviews','artifacts',
    'artifact_captures','artifact_text_versions','circular_revisions','position_revisions','field_evidence',
    'application_routes','source_listings','review_actions','audit_events'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_history_change()',table_name);
  END LOOP;
END $$;
CREATE TRIGGER immutable_source_identity BEFORE UPDATE OF id,authority_id ON sources FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER immutable_circular_identity BEFORE UPDATE OF id,authority_id,memo ON circulars FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER immutable_position_identity BEFORE UPDATE OF id,circular_id,post_key ON positions FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER immutable_stage_payload BEFORE UPDATE OF id,run_id,payload ON stage_runs FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE FUNCTION check_run_inventory() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.source_id<>NEW.source_id OR OLD.fingerprint<>NEW.fingerprint OR
    (OLD.inventory IS NOT NULL AND OLD.inventory IS DISTINCT FROM NEW.inventory)
  THEN RAISE EXCEPTION 'IMMUTABLE_RUN_INVENTORY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_run_inventory BEFORE UPDATE ON source_runs FOR EACH ROW EXECUTE FUNCTION check_run_inventory();
CREATE FUNCTION check_published_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.revision_id=OLD.revision_id AND NEW.review_action_id=OLD.review_action_id AND NEW.suppressed
  THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.suppressed AND NOT NEW.suppressed AND NEW.review_action_id=OLD.review_action_id
  THEN RAISE EXCEPTION 'NEW_REVIEW_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM review_actions a JOIN circular_revisions c ON c.id=a.circular_revision_id
    JOIN position_revisions p ON p.circular_revision_id=c.id JOIN positions i ON i.id=p.position_id
    JOIN circulars canonical ON canonical.id=c.circular_id
    JOIN admin_roles r ON r.actor_id=a.actor_id AND r.role IN ('reviewer','administrator')
    JOIN admin_identities u ON u.id=a.actor_id AND NOT u.disabled
    WHERE a.id=NEW.review_action_id AND a.action IN ('approved','restored')
      AND p.id=NEW.revision_id AND p.position_id=NEW.position_id AND c.id=NEW.circular_revision_id
      AND i.circular_id=c.circular_id AND a.actor_id<>c.created_by
      AND a.expected_generation=c.generation AND canonical.generation=c.generation
      AND i.recruitment_state<>'cancelled'
      AND NOT EXISTS(SELECT 1 FROM recruitment_events e WHERE NEW.position_id=ANY(e.targets)
        AND e.state='pending' AND e.kind IN('amendment','extension','cancellation')))
  THEN RAISE EXCEPTION 'APPROVED_REVISION_REQUIRED'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER publication_gate BEFORE INSERT OR UPDATE ON published_positions FOR EACH ROW EXECUTE FUNCTION check_published_revision();
CREATE UNIQUE INDEX one_unfinished_source_run ON source_runs(source_id) WHERE state IN ('queued','running');
CREATE INDEX stage_recovery ON stage_runs(state,available_at,lease_until);
CREATE INDEX outbox_pending ON outbox_events(created_at) WHERE delivered_at IS NULL;
CREATE INDEX revision_lineage ON circular_revisions(circular_id,created_at);
CREATE UNIQUE INDEX one_review_decision ON review_actions(circular_revision_id) WHERE action IN('approved','rejected');
CREATE INDEX event_pending ON recruitment_events(circular_id,state);
CREATE VIEW public_positions AS
SELECT p.position_id,p.revision_id,p.circular_revision_id,p.published_at,v.value,s.id AS source_id,
  s.current_fingerprint, c.generation
FROM published_positions p JOIN position_revisions v ON v.id=p.revision_id
JOIN circular_revisions r ON r.id=p.circular_revision_id JOIN circulars c ON c.id=r.circular_id
JOIN sources s ON s.id=r.source_id JOIN source_config_versions f ON f.source_id=s.id AND f.fingerprint=s.current_fingerprint
WHERE NOT p.suppressed AND NOT s.display_halted
  AND f.bundle->'config'->>'state'='active' AND f.bundle->'config'->>'display'='permitted'
  AND (f.bundle->'config'->>'expiresAt')::timestamptz>now()
  AND NOT EXISTS (SELECT 1 FROM artifact_text_versions t WHERE
    (t.text_version IN (SELECT entry->>'textVersion' FROM jsonb_array_elements(r.bundle->'entries') entry)
      OR t.text_version IN (SELECT jsonb_array_elements_text(r.bundle->'supportingDocuments')))
    AND NOT EXISTS (SELECT 1 FROM artifact_captures a
      WHERE a.sha256=t.document->>'artifactSha256' AND a.source_id=t.document->>'sourceId'
      AND a.fingerprint=t.document->>'configFingerprint' AND a.expires_at>now()));
