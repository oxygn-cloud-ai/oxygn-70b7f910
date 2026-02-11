
-- Create system_credentials table for admin-managed system-wide API keys
CREATE TABLE public.system_credentials (
  row_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL,
  credential_key text NOT NULL,
  credential_value bytea NOT NULL,
  set_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (service_type, credential_key)
);

ALTER TABLE public.system_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select system credentials"
  ON public.system_credentials FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert system credentials"
  ON public.system_credentials FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update system credentials"
  ON public.system_credentials FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete system credentials"
  ON public.system_credentials FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Encrypt system credential (admin-only)
CREATE OR REPLACE FUNCTION public.encrypt_system_credential(
  p_service text,
  p_key text,
  p_value text,
  p_encryption_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.system_credentials (
    row_id, service_type, credential_key,
    credential_value, set_by, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), p_service, p_key,
    extensions.pgp_sym_encrypt(p_value, p_encryption_key),
    auth.uid(), now(), now()
  )
  ON CONFLICT (service_type, credential_key)
  DO UPDATE SET
    credential_value = extensions.pgp_sym_encrypt(p_value, p_encryption_key),
    set_by = auth.uid(),
    updated_at = now();
END;
$$;

-- Decrypt credential with system-first fallback
CREATE OR REPLACE FUNCTION public.decrypt_credential_with_fallback(
  p_user_id uuid,
  p_service text,
  p_key text,
  p_encryption_key text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_encrypted bytea;
BEGIN
  -- Priority 1: Check system_credentials
  SELECT credential_value::bytea INTO v_encrypted
  FROM public.system_credentials
  WHERE service_type = p_service
    AND credential_key = p_key;

  IF v_encrypted IS NOT NULL THEN
    RETURN extensions.pgp_sym_decrypt(v_encrypted, p_encryption_key);
  END IF;

  -- Priority 2: Fall back to user_credentials
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
