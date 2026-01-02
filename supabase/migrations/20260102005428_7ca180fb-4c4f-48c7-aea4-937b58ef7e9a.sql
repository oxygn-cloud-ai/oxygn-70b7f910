-- Enable pgcrypto extension (already installed, ensure enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create user_credentials table for storing encrypted per-user integration credentials
CREATE TABLE public.user_credentials (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  credential_key TEXT NOT NULL,
  credential_value BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, service_type, credential_key)
);

COMMENT ON TABLE public.user_credentials IS 'Per-user integration credentials with pgcrypto encryption';
COMMENT ON COLUMN public.user_credentials.credential_value IS 'Encrypted using pgp_sym_encrypt with CREDENTIALS_ENCRYPTION_KEY';

-- Enable RLS with strict policies
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credentials"
ON public.user_credentials FOR SELECT
USING (auth.uid() = user_id AND current_user_has_allowed_domain());

CREATE POLICY "Users can insert own credentials"
ON public.user_credentials FOR INSERT
WITH CHECK (auth.uid() = user_id AND current_user_has_allowed_domain());

CREATE POLICY "Users can update own credentials"
ON public.user_credentials FOR UPDATE
USING (auth.uid() = user_id AND current_user_has_allowed_domain())
WITH CHECK (auth.uid() = user_id AND current_user_has_allowed_domain());

CREATE POLICY "Users can delete own credentials"
ON public.user_credentials FOR DELETE
USING (auth.uid() = user_id AND current_user_has_allowed_domain());

-- Create updated_at trigger (reuses existing function)
CREATE TRIGGER update_user_credentials_updated_at
  BEFORE UPDATE ON public.user_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to encrypt and store a credential (service role only)
CREATE OR REPLACE FUNCTION encrypt_credential(
  p_user_id UUID,
  p_service TEXT,
  p_key TEXT,
  p_value TEXT,
  p_encryption_key TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_credentials (user_id, service_type, credential_key, credential_value)
  VALUES (p_user_id, p_service, p_key, pgp_sym_encrypt(p_value, p_encryption_key))
  ON CONFLICT (user_id, service_type, credential_key)
  DO UPDATE SET 
    credential_value = pgp_sym_encrypt(p_value, p_encryption_key),
    updated_at = now();
END;
$$;

-- Function to decrypt a credential (service role only)
CREATE OR REPLACE FUNCTION decrypt_credential(
  p_user_id UUID,
  p_service TEXT,
  p_key TEXT,
  p_encryption_key TEXT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT pgp_sym_decrypt(credential_value, p_encryption_key)
  INTO result
  FROM user_credentials
  WHERE user_id = p_user_id 
    AND service_type = p_service 
    AND credential_key = p_key;
  RETURN result;
END;
$$;

-- Restrict crypto functions to service role only
REVOKE ALL ON FUNCTION encrypt_credential FROM PUBLIC;
REVOKE ALL ON FUNCTION decrypt_credential FROM PUBLIC;
GRANT EXECUTE ON FUNCTION encrypt_credential TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_credential TO service_role;