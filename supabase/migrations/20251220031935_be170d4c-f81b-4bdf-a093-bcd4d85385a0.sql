-- Update function_calling_enabled default to true
ALTER TABLE public.cyg_assistant_tool_defaults 
ALTER COLUMN function_calling_enabled SET DEFAULT true;

-- Update existing records to have function_calling_enabled = true
UPDATE public.cyg_assistant_tool_defaults 
SET function_calling_enabled = true 
WHERE function_calling_enabled = false OR function_calling_enabled IS NULL;