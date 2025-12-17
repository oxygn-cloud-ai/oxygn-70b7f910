-- Drop existing overly permissive policies on cyg_settings
DROP POLICY IF EXISTS "Public read access for settings" ON cyg_settings;
DROP POLICY IF EXISTS "Public insert access for settings" ON cyg_settings;
DROP POLICY IF EXISTS "Public update access for settings" ON cyg_settings;
DROP POLICY IF EXISTS "Public delete access for settings" ON cyg_settings;

-- Create new domain-restricted policies for cyg_settings
CREATE POLICY "Allowed domain users can read settings"
ON cyg_settings FOR SELECT
TO authenticated
USING (public.current_user_has_allowed_domain());

CREATE POLICY "Allowed domain users can insert settings"
ON cyg_settings FOR INSERT
TO authenticated
WITH CHECK (public.current_user_has_allowed_domain());

CREATE POLICY "Allowed domain users can update settings"
ON cyg_settings FOR UPDATE
TO authenticated
USING (public.current_user_has_allowed_domain());

CREATE POLICY "Allowed domain users can delete settings"
ON cyg_settings FOR DELETE
TO authenticated
USING (public.current_user_has_allowed_domain());