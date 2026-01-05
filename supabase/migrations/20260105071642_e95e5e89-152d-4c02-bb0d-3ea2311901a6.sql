-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move the vector extension from public to extensions schema
-- Note: This requires dropping and recreating the extension
-- which will drop any dependent objects (like columns using vector type)
-- First, let's just set search_path to include extensions for future use

-- Grant usage on extensions schema to public roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Set the schema for the vector extension
-- For existing databases, we'll alter the extension's schema
ALTER EXTENSION vector SET SCHEMA extensions;