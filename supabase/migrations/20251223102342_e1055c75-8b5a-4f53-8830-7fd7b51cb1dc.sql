-- Drop all legacy cyg_ tables (no longer used)
DROP TABLE IF EXISTS public.cyg_confluence_pages CASCADE;
DROP TABLE IF EXISTS public.cyg_assistant_files CASCADE;
DROP TABLE IF EXISTS public.cyg_assistant_tool_defaults CASCADE;
DROP TABLE IF EXISTS public.cyg_threads CASCADE;
DROP TABLE IF EXISTS public.cyg_assistants CASCADE;
DROP TABLE IF EXISTS public.cyg_prompt_variables CASCADE;
DROP TABLE IF EXISTS public.cyg_ai_costs CASCADE;
DROP TABLE IF EXISTS public.cyg_templates CASCADE;
DROP TABLE IF EXISTS public.cyg_model_pricing CASCADE;
DROP TABLE IF EXISTS public.cyg_model_defaults CASCADE;
DROP TABLE IF EXISTS public.cyg_vector_stores CASCADE;
DROP TABLE IF EXISTS public.cyg_prompts CASCADE;
DROP TABLE IF EXISTS public.cyg_settings CASCADE;
DROP TABLE IF EXISTS public.cyg_models CASCADE;