-- Drop existing overly permissive policies and create domain-restricted ones for all remaining tables

-- cyg_models
DROP POLICY IF EXISTS "Public read access for models" ON cyg_models;
DROP POLICY IF EXISTS "Public insert access for models" ON cyg_models;
DROP POLICY IF EXISTS "Public update access for models" ON cyg_models;
DROP POLICY IF EXISTS "Public delete access for models" ON cyg_models;

CREATE POLICY "Allowed domain users can read models" ON cyg_models FOR SELECT TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can insert models" ON cyg_models FOR INSERT TO authenticated WITH CHECK (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can update models" ON cyg_models FOR UPDATE TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can delete models" ON cyg_models FOR DELETE TO authenticated USING (public.current_user_has_allowed_domain());

-- cyg_assistants
DROP POLICY IF EXISTS "Public read access for assistants" ON cyg_assistants;
DROP POLICY IF EXISTS "Public insert access for assistants" ON cyg_assistants;
DROP POLICY IF EXISTS "Public update access for assistants" ON cyg_assistants;
DROP POLICY IF EXISTS "Public delete access for assistants" ON cyg_assistants;

CREATE POLICY "Allowed domain users can read assistants" ON cyg_assistants FOR SELECT TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can insert assistants" ON cyg_assistants FOR INSERT TO authenticated WITH CHECK (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can update assistants" ON cyg_assistants FOR UPDATE TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can delete assistants" ON cyg_assistants FOR DELETE TO authenticated USING (public.current_user_has_allowed_domain());

-- cyg_threads
DROP POLICY IF EXISTS "Public read access for threads" ON cyg_threads;
DROP POLICY IF EXISTS "Public insert access for threads" ON cyg_threads;
DROP POLICY IF EXISTS "Public update access for threads" ON cyg_threads;
DROP POLICY IF EXISTS "Public delete access for threads" ON cyg_threads;

CREATE POLICY "Allowed domain users can read threads" ON cyg_threads FOR SELECT TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can insert threads" ON cyg_threads FOR INSERT TO authenticated WITH CHECK (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can update threads" ON cyg_threads FOR UPDATE TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can delete threads" ON cyg_threads FOR DELETE TO authenticated USING (public.current_user_has_allowed_domain());

-- cyg_vector_stores
DROP POLICY IF EXISTS "Public read access for vector stores" ON cyg_vector_stores;
DROP POLICY IF EXISTS "Public insert access for vector stores" ON cyg_vector_stores;
DROP POLICY IF EXISTS "Public update access for vector stores" ON cyg_vector_stores;
DROP POLICY IF EXISTS "Public delete access for vector stores" ON cyg_vector_stores;

CREATE POLICY "Allowed domain users can read vector stores" ON cyg_vector_stores FOR SELECT TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can insert vector stores" ON cyg_vector_stores FOR INSERT TO authenticated WITH CHECK (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can update vector stores" ON cyg_vector_stores FOR UPDATE TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can delete vector stores" ON cyg_vector_stores FOR DELETE TO authenticated USING (public.current_user_has_allowed_domain());

-- cyg_assistant_tool_defaults
DROP POLICY IF EXISTS "Public read access for assistant tool defaults" ON cyg_assistant_tool_defaults;
DROP POLICY IF EXISTS "Public insert access for assistant tool defaults" ON cyg_assistant_tool_defaults;
DROP POLICY IF EXISTS "Public update access for assistant tool defaults" ON cyg_assistant_tool_defaults;
DROP POLICY IF EXISTS "Public delete access for assistant tool defaults" ON cyg_assistant_tool_defaults;

CREATE POLICY "Allowed domain users can read assistant tool defaults" ON cyg_assistant_tool_defaults FOR SELECT TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can insert assistant tool defaults" ON cyg_assistant_tool_defaults FOR INSERT TO authenticated WITH CHECK (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can update assistant tool defaults" ON cyg_assistant_tool_defaults FOR UPDATE TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can delete assistant tool defaults" ON cyg_assistant_tool_defaults FOR DELETE TO authenticated USING (public.current_user_has_allowed_domain());

-- cyg_model_defaults
DROP POLICY IF EXISTS "Public read access for model defaults" ON cyg_model_defaults;
DROP POLICY IF EXISTS "Public insert access for model defaults" ON cyg_model_defaults;
DROP POLICY IF EXISTS "Public update access for model defaults" ON cyg_model_defaults;
DROP POLICY IF EXISTS "Public delete access for model defaults" ON cyg_model_defaults;

CREATE POLICY "Allowed domain users can read model defaults" ON cyg_model_defaults FOR SELECT TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can insert model defaults" ON cyg_model_defaults FOR INSERT TO authenticated WITH CHECK (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can update model defaults" ON cyg_model_defaults FOR UPDATE TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can delete model defaults" ON cyg_model_defaults FOR DELETE TO authenticated USING (public.current_user_has_allowed_domain());

-- cyg_assistant_files
DROP POLICY IF EXISTS "Public read access for assistant files" ON cyg_assistant_files;
DROP POLICY IF EXISTS "Public insert access for assistant files" ON cyg_assistant_files;
DROP POLICY IF EXISTS "Public update access for assistant files" ON cyg_assistant_files;
DROP POLICY IF EXISTS "Public delete access for assistant files" ON cyg_assistant_files;

CREATE POLICY "Allowed domain users can read assistant files" ON cyg_assistant_files FOR SELECT TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can insert assistant files" ON cyg_assistant_files FOR INSERT TO authenticated WITH CHECK (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can update assistant files" ON cyg_assistant_files FOR UPDATE TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can delete assistant files" ON cyg_assistant_files FOR DELETE TO authenticated USING (public.current_user_has_allowed_domain());

-- projects
DROP POLICY IF EXISTS "Public read access for projects" ON projects;
DROP POLICY IF EXISTS "Public insert access for projects" ON projects;
DROP POLICY IF EXISTS "Public update access for projects" ON projects;
DROP POLICY IF EXISTS "Public delete access for projects" ON projects;

CREATE POLICY "Allowed domain users can read projects" ON projects FOR SELECT TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can insert projects" ON projects FOR INSERT TO authenticated WITH CHECK (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can update projects" ON projects FOR UPDATE TO authenticated USING (public.current_user_has_allowed_domain());
CREATE POLICY "Allowed domain users can delete projects" ON projects FOR DELETE TO authenticated USING (public.current_user_has_allowed_domain());