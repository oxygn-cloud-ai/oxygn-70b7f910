-- Add unique constraint for upsert support (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_credentials_unique_key'
  ) THEN
    ALTER TABLE user_credentials
    ADD CONSTRAINT user_credentials_unique_key
    UNIQUE (user_id, service_type, credential_key);
  END IF;
END $$;

-- Create encrypt_credential function
CREATE OR REPLACE FUNCTION public.encrypt_credential(
  p_user_id UUID,
  p_service TEXT,
  p_key TEXT,
  p_value TEXT,
  p_encryption_key TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_credentials (row_id, user_id, service_type, credential_key, credential_value, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    p_user_id,
    p_service,
    p_key,
    pgp_sym_encrypt(p_value, p_encryption_key),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, service_type, credential_key)
  DO UPDATE SET
    credential_value = pgp_sym_encrypt(p_value, p_encryption_key),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create decrypt_credential function
CREATE OR REPLACE FUNCTION public.decrypt_credential(
  p_user_id UUID,
  p_service TEXT,
  p_key TEXT,
  p_encryption_key TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_encrypted BYTEA;
BEGIN
  SELECT credential_value::bytea INTO v_encrypted
  FROM public.user_credentials
  WHERE user_id = p_user_id
    AND service_type = p_service
    AND credential_key = p_key;
  
  IF v_encrypted IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN pgp_sym_decrypt(v_encrypted, p_encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;