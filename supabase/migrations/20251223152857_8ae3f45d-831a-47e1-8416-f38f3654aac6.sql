-- Add default values for created_at and updated_at columns
ALTER TABLE public.q_templates 
ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.q_templates 
ALTER COLUMN updated_at SET DEFAULT now();

-- Also set is_deleted default to false
ALTER TABLE public.q_templates 
ALTER COLUMN is_deleted SET DEFAULT false;

-- Update existing NULL created_at values to now()
UPDATE public.q_templates 
SET created_at = now() 
WHERE created_at IS NULL;

UPDATE public.q_templates 
SET updated_at = now() 
WHERE updated_at IS NULL;

UPDATE public.q_templates 
SET is_deleted = false 
WHERE is_deleted IS NULL;