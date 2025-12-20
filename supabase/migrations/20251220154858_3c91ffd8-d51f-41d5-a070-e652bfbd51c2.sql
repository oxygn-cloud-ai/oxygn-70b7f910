-- Create q_ tables using CREATE TABLE AS to ensure exact column matching
-- Then add constraints and RLS policies

-- ==================================================
-- Table: q_prompts
-- ==================================================
CREATE TABLE public.q_prompts AS SELECT * FROM public.cyg_prompts WHERE 1=0;
ALTER TABLE public.q_prompts ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_prompts ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_prompts ADD CONSTRAINT q_prompts_parent_row_id_fkey FOREIGN KEY (parent_row_id) REFERENCES public.q_prompts(row_id);
ALTER TABLE public.q_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Domain users can insert prompts" ON public.q_prompts FOR INSERT WITH CHECK (current_user_has_allowed_domain());
CREATE POLICY "q Owners and admins can delete prompts" ON public.q_prompts FOR DELETE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid())));
CREATE POLICY "q Owners and admins can update prompts" ON public.q_prompts FOR UPDATE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid()) OR (is_legacy = true) OR (EXISTS (SELECT 1 FROM resource_shares WHERE resource_shares.resource_type = 'prompt' AND resource_shares.resource_id = q_prompts.row_id AND resource_shares.shared_with_user_id = auth.uid() AND resource_shares.permission = 'edit'))));
CREATE POLICY "q Users can read accessible prompts" ON public.q_prompts FOR SELECT USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid()) OR (is_legacy = true) OR ((is_private = false) OR (is_private IS NULL)) OR (EXISTS (SELECT 1 FROM resource_shares WHERE resource_shares.resource_type = 'prompt' AND resource_shares.resource_id = q_prompts.row_id AND resource_shares.shared_with_user_id = auth.uid()))));

-- ==================================================
-- Table: q_settings
-- ==================================================
CREATE TABLE public.q_settings AS SELECT * FROM public.cyg_settings WHERE 1=0;
ALTER TABLE public.q_settings ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_settings ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Admins can delete settings" ON public.q_settings FOR DELETE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can insert settings" ON public.q_settings FOR INSERT WITH CHECK (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can update settings" ON public.q_settings FOR UPDATE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Domain users can read settings" ON public.q_settings FOR SELECT USING (current_user_has_allowed_domain());

-- ==================================================
-- Table: q_models
-- ==================================================
CREATE TABLE public.q_models AS SELECT * FROM public.cyg_models WHERE 1=0;
ALTER TABLE public.q_models ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_models ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Admins can delete models" ON public.q_models FOR DELETE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can insert models" ON public.q_models FOR INSERT WITH CHECK (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can update models" ON public.q_models FOR UPDATE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Domain users can read models" ON public.q_models FOR SELECT USING (current_user_has_allowed_domain());

-- ==================================================
-- Table: q_vector_stores (create first - referenced by q_assistants)
-- ==================================================
CREATE TABLE public.q_vector_stores AS SELECT * FROM public.cyg_vector_stores WHERE 1=0;
ALTER TABLE public.q_vector_stores ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_vector_stores ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_vector_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Admins can delete vector stores" ON public.q_vector_stores FOR DELETE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can insert vector stores" ON public.q_vector_stores FOR INSERT WITH CHECK (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can update vector stores" ON public.q_vector_stores FOR UPDATE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Domain users can read vector stores" ON public.q_vector_stores FOR SELECT USING (current_user_has_allowed_domain());

-- ==================================================
-- Table: q_assistants
-- ==================================================
CREATE TABLE public.q_assistants AS SELECT * FROM public.cyg_assistants WHERE 1=0;
ALTER TABLE public.q_assistants ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_assistants ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_assistants ADD CONSTRAINT q_assistants_prompt_row_id_fkey FOREIGN KEY (prompt_row_id) REFERENCES public.q_prompts(row_id);
ALTER TABLE public.q_assistants ADD CONSTRAINT q_assistants_shared_vector_store_row_id_fkey FOREIGN KEY (shared_vector_store_row_id) REFERENCES public.q_vector_stores(row_id);
ALTER TABLE public.q_assistants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Domain users can insert assistants" ON public.q_assistants FOR INSERT WITH CHECK (current_user_has_allowed_domain());
CREATE POLICY "q Owners and admins can delete assistants" ON public.q_assistants FOR DELETE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid())));
CREATE POLICY "q Owners and admins can update assistants" ON public.q_assistants FOR UPDATE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid()) OR ((prompt_row_id IS NOT NULL) AND can_edit_resource('prompt', prompt_row_id))));
CREATE POLICY "q Users can read accessible assistants" ON public.q_assistants FOR SELECT USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid()) OR ((prompt_row_id IS NOT NULL) AND can_read_resource('prompt', prompt_row_id))));

-- ==================================================
-- Table: q_threads
-- ==================================================
CREATE TABLE public.q_threads AS SELECT * FROM public.cyg_threads WHERE 1=0;
ALTER TABLE public.q_threads ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_threads ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_threads ADD CONSTRAINT q_threads_assistant_row_id_fkey FOREIGN KEY (assistant_row_id) REFERENCES public.q_assistants(row_id);
ALTER TABLE public.q_threads ADD CONSTRAINT q_threads_child_prompt_row_id_fkey FOREIGN KEY (child_prompt_row_id) REFERENCES public.q_prompts(row_id);
ALTER TABLE public.q_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Domain users can insert threads" ON public.q_threads FOR INSERT WITH CHECK (current_user_has_allowed_domain());
CREATE POLICY "q Owners and admins can delete threads" ON public.q_threads FOR DELETE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid())));
CREATE POLICY "q Owners and admins can update threads" ON public.q_threads FOR UPDATE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid()) OR ((assistant_row_id IS NOT NULL) AND (EXISTS (SELECT 1 FROM q_assistants a WHERE a.row_id = q_threads.assistant_row_id AND (a.owner_id = auth.uid() OR can_edit_resource('prompt', a.prompt_row_id)))))));
CREATE POLICY "q Users can read accessible threads" ON public.q_threads FOR SELECT USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid()) OR ((assistant_row_id IS NOT NULL) AND (EXISTS (SELECT 1 FROM q_assistants a WHERE a.row_id = q_threads.assistant_row_id AND (a.owner_id = auth.uid() OR can_read_resource('prompt', a.prompt_row_id)))))));

-- ==================================================
-- Table: q_templates
-- ==================================================
CREATE TABLE public.q_templates AS SELECT * FROM public.cyg_templates WHERE 1=0;
ALTER TABLE public.q_templates ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_templates ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Domain users can insert templates" ON public.q_templates FOR INSERT WITH CHECK (current_user_has_allowed_domain());
CREATE POLICY "q Owners and admins can delete templates" ON public.q_templates FOR DELETE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid())));
CREATE POLICY "q Owners and admins can update templates" ON public.q_templates FOR UPDATE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid())));
CREATE POLICY "q Users can read accessible templates" ON public.q_templates FOR SELECT USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (owner_id = auth.uid()) OR ((is_private = false) OR (is_private IS NULL))));

-- ==================================================
-- Table: q_prompt_variables
-- ==================================================
CREATE TABLE public.q_prompt_variables AS SELECT * FROM public.cyg_prompt_variables WHERE 1=0;
ALTER TABLE public.q_prompt_variables ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_prompt_variables ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_prompt_variables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Domain users can insert prompt variables" ON public.q_prompt_variables FOR INSERT WITH CHECK (current_user_has_allowed_domain());
CREATE POLICY "q Owners and admins can delete prompt variables" ON public.q_prompt_variables FOR DELETE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR can_edit_resource('prompt', prompt_row_id)));
CREATE POLICY "q Owners and admins can update prompt variables" ON public.q_prompt_variables FOR UPDATE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR can_edit_resource('prompt', prompt_row_id)));
CREATE POLICY "q Users can read accessible prompt variables" ON public.q_prompt_variables FOR SELECT USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR can_read_resource('prompt', prompt_row_id)));

-- ==================================================
-- Table: q_ai_costs
-- ==================================================
CREATE TABLE public.q_ai_costs AS SELECT * FROM public.cyg_ai_costs WHERE 1=0;
ALTER TABLE public.q_ai_costs ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_ai_costs ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_ai_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Domain users can insert cost records" ON public.q_ai_costs FOR INSERT WITH CHECK (current_user_has_allowed_domain());
CREATE POLICY "q Users can read own cost records admins all" ON public.q_ai_costs FOR SELECT USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR (user_id = auth.uid())));

-- ==================================================
-- Table: q_model_pricing
-- ==================================================
CREATE TABLE public.q_model_pricing AS SELECT * FROM public.cyg_model_pricing WHERE 1=0;
ALTER TABLE public.q_model_pricing ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_model_pricing ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_model_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Admins can delete model pricing" ON public.q_model_pricing FOR DELETE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can insert model pricing" ON public.q_model_pricing FOR INSERT WITH CHECK (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can update model pricing" ON public.q_model_pricing FOR UPDATE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Domain users can read model pricing" ON public.q_model_pricing FOR SELECT USING (current_user_has_allowed_domain());

-- ==================================================
-- Table: q_model_defaults
-- ==================================================
CREATE TABLE public.q_model_defaults AS SELECT * FROM public.cyg_model_defaults WHERE 1=0;
ALTER TABLE public.q_model_defaults ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_model_defaults ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_model_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Admins can delete model defaults" ON public.q_model_defaults FOR DELETE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can insert model defaults" ON public.q_model_defaults FOR INSERT WITH CHECK (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can update model defaults" ON public.q_model_defaults FOR UPDATE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Domain users can read model defaults" ON public.q_model_defaults FOR SELECT USING (current_user_has_allowed_domain());

-- ==================================================
-- Table: q_assistant_files
-- ==================================================
CREATE TABLE public.q_assistant_files AS SELECT * FROM public.cyg_assistant_files WHERE 1=0;
ALTER TABLE public.q_assistant_files ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_assistant_files ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_assistant_files ADD CONSTRAINT q_assistant_files_assistant_row_id_fkey FOREIGN KEY (assistant_row_id) REFERENCES public.q_assistants(row_id);
ALTER TABLE public.q_assistant_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Domain users can insert assistant files" ON public.q_assistant_files FOR INSERT WITH CHECK (current_user_has_allowed_domain());
CREATE POLICY "q Owners and admins can delete assistant files" ON public.q_assistant_files FOR DELETE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR ((assistant_row_id IS NOT NULL) AND (EXISTS (SELECT 1 FROM q_assistants a WHERE a.row_id = q_assistant_files.assistant_row_id AND (a.owner_id = auth.uid() OR can_edit_resource('prompt', a.prompt_row_id)))))));
CREATE POLICY "q Owners and admins can update assistant files" ON public.q_assistant_files FOR UPDATE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR ((assistant_row_id IS NOT NULL) AND (EXISTS (SELECT 1 FROM q_assistants a WHERE a.row_id = q_assistant_files.assistant_row_id AND (a.owner_id = auth.uid() OR can_edit_resource('prompt', a.prompt_row_id)))))));
CREATE POLICY "q Users can read accessible assistant files" ON public.q_assistant_files FOR SELECT USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR ((assistant_row_id IS NOT NULL) AND (EXISTS (SELECT 1 FROM q_assistants a WHERE a.row_id = q_assistant_files.assistant_row_id AND (a.owner_id = auth.uid() OR can_read_resource('prompt', a.prompt_row_id)))))));

-- ==================================================
-- Table: q_assistant_tool_defaults
-- ==================================================
CREATE TABLE public.q_assistant_tool_defaults AS SELECT * FROM public.cyg_assistant_tool_defaults WHERE 1=0;
ALTER TABLE public.q_assistant_tool_defaults ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_assistant_tool_defaults ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_assistant_tool_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Admins can delete assistant tool defaults" ON public.q_assistant_tool_defaults FOR DELETE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can insert assistant tool defaults" ON public.q_assistant_tool_defaults FOR INSERT WITH CHECK (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Admins can update assistant tool defaults" ON public.q_assistant_tool_defaults FOR UPDATE USING (current_user_has_allowed_domain() AND is_admin(auth.uid()));
CREATE POLICY "q Domain users can read assistant tool defaults" ON public.q_assistant_tool_defaults FOR SELECT USING (current_user_has_allowed_domain());

-- ==================================================
-- Table: q_confluence_pages
-- ==================================================
CREATE TABLE public.q_confluence_pages AS SELECT * FROM public.cyg_confluence_pages WHERE 1=0;
ALTER TABLE public.q_confluence_pages ALTER COLUMN row_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.q_confluence_pages ADD PRIMARY KEY (row_id);
ALTER TABLE public.q_confluence_pages ADD CONSTRAINT q_confluence_pages_assistant_row_id_fkey FOREIGN KEY (assistant_row_id) REFERENCES public.q_assistants(row_id);
ALTER TABLE public.q_confluence_pages ADD CONSTRAINT q_confluence_pages_prompt_row_id_fkey FOREIGN KEY (prompt_row_id) REFERENCES public.q_prompts(row_id);
ALTER TABLE public.q_confluence_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q Domain users can insert confluence pages" ON public.q_confluence_pages FOR INSERT WITH CHECK (current_user_has_allowed_domain());
CREATE POLICY "q Owners and admins can delete confluence pages" ON public.q_confluence_pages FOR DELETE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR ((prompt_row_id IS NOT NULL) AND can_edit_resource('prompt', prompt_row_id))));
CREATE POLICY "q Owners and admins can update confluence pages" ON public.q_confluence_pages FOR UPDATE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR ((prompt_row_id IS NOT NULL) AND can_edit_resource('prompt', prompt_row_id))));
CREATE POLICY "q Users can read accessible confluence pages" ON public.q_confluence_pages FOR SELECT USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR ((prompt_row_id IS NOT NULL) AND can_read_resource('prompt', prompt_row_id))));

-- ==================================================
-- Copy data from cyg_ tables to q_ tables
-- ==================================================
INSERT INTO public.q_prompts SELECT * FROM public.cyg_prompts;
INSERT INTO public.q_settings SELECT * FROM public.cyg_settings;
INSERT INTO public.q_models SELECT * FROM public.cyg_models;
INSERT INTO public.q_vector_stores SELECT * FROM public.cyg_vector_stores;
INSERT INTO public.q_assistants SELECT * FROM public.cyg_assistants;
INSERT INTO public.q_threads SELECT * FROM public.cyg_threads;
INSERT INTO public.q_templates SELECT * FROM public.cyg_templates;
INSERT INTO public.q_prompt_variables SELECT * FROM public.cyg_prompt_variables;
INSERT INTO public.q_ai_costs SELECT * FROM public.cyg_ai_costs;
INSERT INTO public.q_model_pricing SELECT * FROM public.cyg_model_pricing;
INSERT INTO public.q_model_defaults SELECT * FROM public.cyg_model_defaults;
INSERT INTO public.q_assistant_files SELECT * FROM public.cyg_assistant_files;
INSERT INTO public.q_assistant_tool_defaults SELECT * FROM public.cyg_assistant_tool_defaults;
INSERT INTO public.q_confluence_pages SELECT * FROM public.cyg_confluence_pages;