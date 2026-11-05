-- Preserve role-row locking without granting the worker identity/role mutation privileges.
CREATE FUNCTION lock_actor_role(actor text, allowed_roles text[]) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path FROM CURRENT AS $$
BEGIN
  PERFORM 1 FROM admin_roles r JOIN admin_identities i ON i.id=r.actor_id
    WHERE i.id=actor AND NOT i.disabled AND r.role=ANY(allowed_roles)
    LIMIT 1 FOR SHARE OF i,r;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION lock_actor_role(text,text[]) FROM PUBLIC;
