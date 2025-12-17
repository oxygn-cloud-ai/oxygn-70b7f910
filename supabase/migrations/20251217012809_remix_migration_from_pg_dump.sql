CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: cyg_model_defaults; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cyg_model_defaults (
    row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id text NOT NULL,
    temperature text,
    temperature_on boolean DEFAULT false,
    max_tokens text,
    max_tokens_on boolean DEFAULT false,
    top_p text,
    top_p_on boolean DEFAULT false,
    frequency_penalty text,
    frequency_penalty_on boolean DEFAULT false,
    presence_penalty text,
    presence_penalty_on boolean DEFAULT false,
    stop text,
    stop_on boolean DEFAULT false,
    n text,
    n_on boolean DEFAULT false,
    stream boolean DEFAULT false,
    stream_on boolean DEFAULT false,
    response_format text,
    response_format_on boolean DEFAULT false,
    logit_bias text,
    logit_bias_on boolean DEFAULT false,
    o_user text,
    o_user_on boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cyg_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cyg_models (
    row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_name text NOT NULL,
    model_id text NOT NULL,
    provider text DEFAULT 'openai'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cyg_prompts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cyg_prompts (
    row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_row_id uuid,
    prompt_name text DEFAULT 'New Prompt'::text NOT NULL,
    input_admin_prompt text,
    input_user_prompt text,
    output_response text,
    "position" integer DEFAULT 0,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    model text,
    model_on boolean DEFAULT false,
    temperature text,
    temperature_on boolean DEFAULT false,
    max_tokens text,
    max_tokens_on boolean DEFAULT false,
    top_p text,
    top_p_on boolean DEFAULT false,
    frequency_penalty text,
    frequency_penalty_on boolean DEFAULT false,
    presence_penalty text,
    presence_penalty_on boolean DEFAULT false,
    stop text,
    stop_on boolean DEFAULT false,
    n text,
    n_on boolean DEFAULT false,
    logit_bias text,
    logit_bias_on boolean DEFAULT false,
    o_user text,
    o_user_on boolean DEFAULT false,
    stream boolean DEFAULT false,
    stream_on boolean DEFAULT false,
    best_of text,
    best_of_on boolean DEFAULT false,
    logprobs text,
    logprobs_on boolean DEFAULT false,
    echo boolean DEFAULT false,
    echo_on boolean DEFAULT false,
    suffix text,
    suffix_on boolean DEFAULT false,
    response_format text,
    response_format_on boolean DEFAULT false,
    context_length text,
    context_length_on boolean DEFAULT false,
    settings_expanded boolean DEFAULT false,
    user_prompt_result text,
    admin_prompt_result text,
    note text,
    web_search_on boolean DEFAULT false
);


--
-- Name: cyg_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cyg_settings (
    row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    setting_value text,
    setting_description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    project_row_id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id text,
    project_name text DEFAULT 'New Project'::text NOT NULL,
    project_description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cyg_model_defaults cyg_model_defaults_model_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cyg_model_defaults
    ADD CONSTRAINT cyg_model_defaults_model_id_key UNIQUE (model_id);


--
-- Name: cyg_model_defaults cyg_model_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cyg_model_defaults
    ADD CONSTRAINT cyg_model_defaults_pkey PRIMARY KEY (row_id);


--
-- Name: cyg_models cyg_models_model_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cyg_models
    ADD CONSTRAINT cyg_models_model_id_key UNIQUE (model_id);


--
-- Name: cyg_models cyg_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cyg_models
    ADD CONSTRAINT cyg_models_pkey PRIMARY KEY (row_id);


--
-- Name: cyg_prompts cyg_prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cyg_prompts
    ADD CONSTRAINT cyg_prompts_pkey PRIMARY KEY (row_id);


--
-- Name: cyg_settings cyg_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cyg_settings
    ADD CONSTRAINT cyg_settings_pkey PRIMARY KEY (row_id);


--
-- Name: cyg_settings cyg_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cyg_settings
    ADD CONSTRAINT cyg_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (project_row_id);


--
-- Name: projects projects_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_project_id_key UNIQUE (project_id);


--
-- Name: idx_cyg_prompts_is_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cyg_prompts_is_deleted ON public.cyg_prompts USING btree (is_deleted);


--
-- Name: idx_cyg_prompts_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cyg_prompts_parent ON public.cyg_prompts USING btree (parent_row_id);


--
-- Name: idx_cyg_prompts_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cyg_prompts_position ON public.cyg_prompts USING btree ("position");


--
-- Name: cyg_models update_cyg_models_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cyg_models_updated_at BEFORE UPDATE ON public.cyg_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cyg_prompts update_cyg_prompts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cyg_prompts_updated_at BEFORE UPDATE ON public.cyg_prompts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cyg_settings update_cyg_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cyg_settings_updated_at BEFORE UPDATE ON public.cyg_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cyg_prompts cyg_prompts_parent_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cyg_prompts
    ADD CONSTRAINT cyg_prompts_parent_row_id_fkey FOREIGN KEY (parent_row_id) REFERENCES public.cyg_prompts(row_id) ON DELETE SET NULL;


--
-- Name: cyg_model_defaults Public delete access for model defaults; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public delete access for model defaults" ON public.cyg_model_defaults FOR DELETE USING (true);


--
-- Name: cyg_models Public delete access for models; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public delete access for models" ON public.cyg_models FOR DELETE USING (true);


--
-- Name: projects Public delete access for projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public delete access for projects" ON public.projects FOR DELETE USING (true);


--
-- Name: cyg_prompts Public delete access for prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public delete access for prompts" ON public.cyg_prompts FOR DELETE USING (true);


--
-- Name: cyg_settings Public delete access for settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public delete access for settings" ON public.cyg_settings FOR DELETE USING (true);


--
-- Name: cyg_model_defaults Public insert access for model defaults; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert access for model defaults" ON public.cyg_model_defaults FOR INSERT WITH CHECK (true);


--
-- Name: cyg_models Public insert access for models; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert access for models" ON public.cyg_models FOR INSERT WITH CHECK (true);


--
-- Name: projects Public insert access for projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert access for projects" ON public.projects FOR INSERT WITH CHECK (true);


--
-- Name: cyg_prompts Public insert access for prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert access for prompts" ON public.cyg_prompts FOR INSERT WITH CHECK (true);


--
-- Name: cyg_settings Public insert access for settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public insert access for settings" ON public.cyg_settings FOR INSERT WITH CHECK (true);


--
-- Name: cyg_model_defaults Public read access for model defaults; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access for model defaults" ON public.cyg_model_defaults FOR SELECT USING (true);


--
-- Name: cyg_models Public read access for models; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access for models" ON public.cyg_models FOR SELECT USING (true);


--
-- Name: projects Public read access for projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access for projects" ON public.projects FOR SELECT USING (true);


--
-- Name: cyg_prompts Public read access for prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access for prompts" ON public.cyg_prompts FOR SELECT USING (true);


--
-- Name: cyg_settings Public read access for settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access for settings" ON public.cyg_settings FOR SELECT USING (true);


--
-- Name: cyg_model_defaults Public update access for model defaults; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public update access for model defaults" ON public.cyg_model_defaults FOR UPDATE USING (true);


--
-- Name: cyg_models Public update access for models; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public update access for models" ON public.cyg_models FOR UPDATE USING (true);


--
-- Name: projects Public update access for projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public update access for projects" ON public.projects FOR UPDATE USING (true);


--
-- Name: cyg_prompts Public update access for prompts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public update access for prompts" ON public.cyg_prompts FOR UPDATE USING (true);


--
-- Name: cyg_settings Public update access for settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public update access for settings" ON public.cyg_settings FOR UPDATE USING (true);


--
-- Name: cyg_model_defaults; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cyg_model_defaults ENABLE ROW LEVEL SECURITY;

--
-- Name: cyg_models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cyg_models ENABLE ROW LEVEL SECURITY;

--
-- Name: cyg_prompts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cyg_prompts ENABLE ROW LEVEL SECURITY;

--
-- Name: cyg_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cyg_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


