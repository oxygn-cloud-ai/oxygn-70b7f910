-- Update the default value for code_interpreter_enabled to false
UPDATE public.cyg_assistant_tool_defaults 
SET code_interpreter_enabled = false 
WHERE code_interpreter_enabled = true;

-- Also update any existing assistants that inherited the old default
UPDATE public.cyg_assistants 
SET code_interpreter_enabled = false 
WHERE code_interpreter_enabled IS NULL OR use_global_tool_defaults = true;