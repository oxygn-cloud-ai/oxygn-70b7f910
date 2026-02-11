
-- ============================================================
-- IAM Framework Phase A1: Foundation Tables & Functions
-- Single transaction to prevent partial state / user lockout
-- ============================================================

-- 1. Create tenant_role enum
CREATE TYPE public.tenant_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- 2. Create tenants table
CREATE TABLE public.tenants (
  tenant_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  domain TEXT,
  domain_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'suspended')),
  plan TEXT DEFAULT 'free',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Tenants RLS: all authenticated can read active tenants (needed for onboarding domain check)
CREATE POLICY "Authenticated users can read active tenants"
  ON public.tenants FOR SELECT
  USING (auth.uid() IS NOT NULL AND (status = 'active' OR created_by = auth.uid()));

-- Any authenticated user can create a tenant (self-service, defaults to pending_approval)
CREATE POLICY "Authenticated users can create tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Platform admins or tenant creator can update
CREATE POLICY "Admins and creators can update tenants"
  ON public.tenants FOR UPDATE
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- Only platform admins can delete
CREATE POLICY "Admins can delete tenants"
  ON public.tenants FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 3. Create tenant_memberships table
CREATE TABLE public.tenant_memberships (
  membership_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.tenant_role NOT NULL DEFAULT 'editor',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_tenant_memberships_user_id ON public.tenant_memberships(user_id);
CREATE INDEX idx_tenant_memberships_tenant_id ON public.tenant_memberships(tenant_id);

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

-- 4. Helper functions (SECURITY DEFINER, created BEFORE RLS policies that use them)

-- role_level: converts tenant_role to integer for hierarchy comparison
CREATE OR REPLACE FUNCTION public.role_level(_role public.tenant_role)
RETURNS integer
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE _role
    WHEN 'owner' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'editor' THEN 3
    WHEN 'viewer' THEN 4
  END;
$$;

-- get_user_tenant_id: returns current user's active tenant_id with session caching
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cached text;
  v_tid uuid;
BEGIN
  -- Check session cache first
  v_cached := current_setting('app.current_tenant_id', true);
  IF v_cached IS NOT NULL AND v_cached <> '' THEN
    RETURN v_cached::uuid;
  END IF;
  
  SELECT tenant_id INTO v_tid
  FROM public.tenant_memberships
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
  
  -- Cache for remainder of transaction
  IF v_tid IS NOT NULL THEN
    PERFORM set_config('app.current_tenant_id', v_tid::text, true);
  END IF;
  
  RETURN v_tid;
END;
$$;

-- user_belongs_to_tenant: checks if user has active membership in given tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- has_tenant_role: checks if user has at least the given role in the tenant
CREATE OR REPLACE FUNCTION public.has_tenant_role(_tenant_id uuid, _role public.tenant_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = _tenant_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND public.role_level(role) <= public.role_level(_role)
  );
$$;

-- is_tenant_admin: checks if user is owner or admin of the given tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin(auth.uid()) OR public.has_tenant_role(_tenant_id, 'admin');
$$;

-- 5. Tenant memberships RLS (uses SECURITY DEFINER functions, no circular dependency)
CREATE POLICY "Members can read tenant memberships"
  ON public.tenant_memberships FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins can insert memberships"
  ON public.tenant_memberships FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins can update memberships"
  ON public.tenant_memberships FOR UPDATE
  USING (public.is_tenant_admin(tenant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins or self can delete memberships"
  ON public.tenant_memberships FOR DELETE
  USING (public.is_tenant_admin(tenant_id) OR user_id = auth.uid() OR public.is_admin(auth.uid()));

-- 6. Create tenant_permissions table
CREATE TABLE public.tenant_permissions (
  permission_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  permission_value JSONB NOT NULL DEFAULT 'true'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, permission_key)
);

CREATE INDEX idx_tenant_permissions_tenant_id ON public.tenant_permissions(tenant_id);

ALTER TABLE public.tenant_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read tenant permissions"
  ON public.tenant_permissions FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage permissions"
  ON public.tenant_permissions FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins can update permissions"
  ON public.tenant_permissions FOR UPDATE
  USING (public.is_tenant_admin(tenant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins can delete permissions"
  ON public.tenant_permissions FOR DELETE
  USING (public.is_tenant_admin(tenant_id) OR public.is_admin(auth.uid()));

-- 7. Create tenant_credentials table
CREATE TABLE public.tenant_credentials (
  row_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  credential_key TEXT NOT NULL,
  credential_value BYTEA NOT NULL,
  set_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, service_type, credential_key)
);

CREATE INDEX idx_tenant_credentials_tenant_id ON public.tenant_credentials(tenant_id);

ALTER TABLE public.tenant_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read tenant credentials metadata"
  ON public.tenant_credentials FOR SELECT
  USING (public.user_belongs_to_tenant(tenant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins can insert credentials"
  ON public.tenant_credentials FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins can update credentials"
  ON public.tenant_credentials FOR UPDATE
  USING (public.is_tenant_admin(tenant_id) OR public.is_admin(auth.uid()));

CREATE POLICY "Tenant admins can delete credentials"
  ON public.tenant_credentials FOR DELETE
  USING (public.is_tenant_admin(tenant_id) OR public.is_admin(auth.uid()));

-- 8. encrypt_tenant_credential function
CREATE OR REPLACE FUNCTION public.encrypt_tenant_credential(
  p_tenant_id uuid, p_service text, p_key text,
  p_value text, p_encryption_key text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.is_tenant_admin(p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant admin access required';
  END IF;

  INSERT INTO public.tenant_credentials (
    row_id, tenant_id, service_type, credential_key,
    credential_value, set_by, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), p_tenant_id, p_service, p_key,
    extensions.pgp_sym_encrypt(p_value, p_encryption_key),
    auth.uid(), now(), now()
  )
  ON CONFLICT (tenant_id, service_type, credential_key)
  DO UPDATE SET
    credential_value = extensions.pgp_sym_encrypt(p_value, p_encryption_key),
    set_by = auth.uid(),
    updated_at = now();
END;
$$;

-- 9. decrypt_credential_with_tenant_fallback: system -> tenant -> user
CREATE OR REPLACE FUNCTION public.decrypt_credential_with_tenant_fallback(
  p_user_id uuid, p_service text, p_key text, p_encryption_key text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_encrypted bytea;
  v_tenant_id uuid;
BEGIN
  -- Priority 1: Check system_credentials
  SELECT credential_value::bytea INTO v_encrypted
  FROM public.system_credentials
  WHERE service_type = p_service
    AND credential_key = p_key;

  IF v_encrypted IS NOT NULL THEN
    RETURN extensions.pgp_sym_decrypt(v_encrypted, p_encryption_key);
  END IF;

  -- Priority 2: Check tenant_credentials
  SELECT tm.tenant_id INTO v_tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = p_user_id AND tm.status = 'active'
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    SELECT credential_value::bytea INTO v_encrypted
    FROM public.tenant_credentials
    WHERE tenant_id = v_tenant_id
      AND service_type = p_service
      AND credential_key = p_key;

    IF v_encrypted IS NOT NULL THEN
      RETURN extensions.pgp_sym_decrypt(v_encrypted, p_encryption_key);
    END IF;
  END IF;

  -- Priority 3: Fall back to user_credentials
  SELECT credential_value::bytea INTO v_encrypted
  FROM public.user_credentials
  WHERE user_id = p_user_id
    AND service_type = p_service
    AND credential_key = p_key;

  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN extensions.pgp_sym_decrypt(v_encrypted, p_encryption_key);
END;
$$;

-- 10. Create shared_library table
CREATE TABLE public.shared_library (
  item_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('template', 'knowledge', 'prompt')),
  source_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  published_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read shared library"
  ON public.shared_library FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Platform admins can insert shared library"
  ON public.shared_library FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Platform admins can update shared library"
  ON public.shared_library FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Platform admins can delete shared library"
  ON public.shared_library FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 11. Seed tenants for existing domains
INSERT INTO public.tenants (tenant_name, slug, domain, domain_verified, status, plan)
VALUES 
  ('Chocolate Finance', 'chocfin', 'chocfin.com', true, 'active', 'enterprise'),
  ('Oxygn', 'oxygn', 'oxygn.cloud', true, 'active', 'enterprise');

-- 12. Seed memberships for ALL existing users based on email domain
-- james@chocfin.com becomes owner, all others become editors
INSERT INTO tenant_memberships (tenant_id, user_id, role, status)
SELECT 
  t.tenant_id,
  u.id,
  CASE 
    WHEN lower(u.email) = 'james@chocfin.com' THEN 'owner'::public.tenant_role
    ELSE 'editor'::public.tenant_role
  END,
  'active'
FROM auth.users u
CROSS JOIN public.tenants t
WHERE split_part(lower(u.email), '@', 2) = t.domain
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- 13. Validation: ensure no allowed-domain user lacks a membership
DO $$
DECLARE
  v_orphan_count integer;
BEGIN
  SELECT count(*) INTO v_orphan_count
  FROM auth.users u
  WHERE split_part(lower(u.email), '@', 2) IN ('chocfin.com', 'oxygn.cloud')
    AND NOT EXISTS (
      SELECT 1 FROM public.tenant_memberships tm WHERE tm.user_id = u.id AND tm.status = 'active'
    );
  
  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORT: % users with allowed domains have no tenant membership', v_orphan_count;
  END IF;
END $$;

-- 14. Replace current_user_has_allowed_domain() with tenant-aware version
-- Backward-compatible: returns true if user has ANY active tenant membership
-- (also preserves original domain check as fallback during transition)
CREATE OR REPLACE FUNCTION public.current_user_has_allowed_domain()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN auth.uid() IS NULL THEN false
    WHEN auth.email() IS NULL THEN false
    ELSE (
      -- Primary: check tenant membership
      EXISTS (
        SELECT 1 FROM public.tenant_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
      OR
      -- Fallback during transition: legacy domain check
      split_part(lower(auth.email()), '@', 2) IN ('chocfin.com', 'oxygn.cloud')
    )
  END;
$$;

-- 15. Add updated_at triggers for new tables
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_memberships_updated_at
  BEFORE UPDATE ON public.tenant_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_permissions_updated_at
  BEFORE UPDATE ON public.tenant_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_credentials_updated_at
  BEFORE UPDATE ON public.tenant_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shared_library_updated_at
  BEFORE UPDATE ON public.shared_library
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
