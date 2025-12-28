-- Add is_deleted column to q_export_templates for soft delete support
ALTER TABLE public.q_export_templates 
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_q_export_templates_is_deleted 
ON public.q_export_templates(is_deleted) 
WHERE is_deleted = true;