-- =============================================
-- OWNERSHIP MODEL MIGRATION
-- =============================================

-- 1. Create app_role enum type
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create resource_shares table for explicit sharing
CREATE TABLE public.resource_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type TEXT NOT NULL CHECK (resource_type IN ('prompt', 'project')),
    resource_id UUID NOT NULL,
    shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    permission TEXT NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'edit')),
    shared_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (resource_type, resource_id, shared_with_user_id)
);

ALTER TABLE public.resource_shares ENABLE ROW LEVEL SECURITY;

-- 4. Add ownership columns to content tables
-- cyg_prompts
ALTER TABLE public.cyg_prompts 
ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN is_private BOOLEAN DEFAULT false,
ADD COLUMN is_legacy BOOLEAN DEFAULT false;

-- projects
ALTER TABLE public.projects 
ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN is_private BOOLEAN DEFAULT false;

-- cyg_assistants
ALTER TABLE public.cyg_assistants 
ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- cyg_threads
ALTER TABLE public.cyg_threads 
ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. Create security definer functions

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- Check if user owns a prompt (with recursive ancestor check)
CREATE OR REPLACE FUNCTION public.owns_prompt(_user_id UUID, _prompt_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE prompt_chain AS (
    SELECT row_id, parent_row_id, owner_id
    FROM public.cyg_prompts
    WHERE row_id = _prompt_id
    
    UNION ALL
    
    SELECT p.row_id, p.parent_row_id, p.owner_id
    FROM public.cyg_prompts p
    INNER JOIN prompt_chain pc ON p.row_id = pc.parent_row_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM prompt_chain
    WHERE owner_id = _user_id
  )
$$;

-- Check if user can read a resource
CREATE OR REPLACE FUNCTION public.can_read_resource(_resource_type TEXT, _resource_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admin can read everything
    public.is_admin(auth.uid())
    OR
    -- Check based on resource type
    CASE 
      WHEN _resource_type = 'prompt' THEN (
        SELECT 
          -- Owner can read
          (owner_id = auth.uid())
          -- Legacy or non-private prompts are readable by all domain users
          OR (is_legacy = true)
          OR (is_private = false OR is_private IS NULL)
          -- Explicit share
          OR EXISTS (
            SELECT 1 FROM public.resource_shares
            WHERE resource_type = 'prompt'
              AND resource_id = _resource_id
              AND shared_with_user_id = auth.uid()
          )
        FROM public.cyg_prompts
        WHERE row_id = _resource_id
      )
      WHEN _resource_type = 'project' THEN (
        SELECT 
          (owner_id = auth.uid())
          OR (is_private = false OR is_private IS NULL)
          OR EXISTS (
            SELECT 1 FROM public.resource_shares
            WHERE resource_type = 'project'
              AND resource_id = _resource_id
              AND shared_with_user_id = auth.uid()
          )
        FROM public.projects
        WHERE project_row_id = _resource_id
      )
      ELSE false
    END
$$;

-- Check if user can edit a resource
CREATE OR REPLACE FUNCTION public.can_edit_resource(_resource_type TEXT, _resource_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admin can edit everything
    public.is_admin(auth.uid())
    OR
    -- Check based on resource type
    CASE 
      WHEN _resource_type = 'prompt' THEN (
        SELECT 
          -- Owner can edit
          (owner_id = auth.uid())
          -- Legacy prompts are editable by all domain users
          OR (is_legacy = true)
          -- Explicit edit share
          OR EXISTS (
            SELECT 1 FROM public.resource_shares
            WHERE resource_type = 'prompt'
              AND resource_id = _resource_id
              AND shared_with_user_id = auth.uid()
              AND permission = 'edit'
          )
        FROM public.cyg_prompts
        WHERE row_id = _resource_id
      )
      WHEN _resource_type = 'project' THEN (
        SELECT 
          (owner_id = auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.resource_shares
            WHERE resource_type = 'project'
              AND resource_id = _resource_id
              AND shared_with_user_id = auth.uid()
              AND permission = 'edit'
          )
        FROM public.projects
        WHERE project_row_id = _resource_id
      )
      ELSE false
    END
$$;

-- 6. Create ownership inheritance triggers

-- Trigger function for cyg_assistants to inherit owner from parent prompt
CREATE OR REPLACE FUNCTION public.set_assistant_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.prompt_row_id IS NOT NULL AND NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id
    FROM public.cyg_prompts
    WHERE row_id = NEW.prompt_row_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_assistant_owner
BEFORE INSERT ON public.cyg_assistants
FOR EACH ROW
EXECUTE FUNCTION public.set_assistant_owner();

-- Trigger function for cyg_threads to inherit owner from parent assistant
CREATE OR REPLACE FUNCTION public.set_thread_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assistant_row_id IS NOT NULL AND NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id
    FROM public.cyg_assistants
    WHERE row_id = NEW.assistant_row_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_thread_owner
BEFORE INSERT ON public.cyg_threads
FOR EACH ROW
EXECUTE FUNCTION public.set_thread_owner();

-- 7. Set james@chocfin.com as admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('832f0635-fa47-47be-919e-cc3a4e263cd9', 'admin');

-- 8. Migrate existing data - set james as owner of all existing records
-- Update cyg_prompts
UPDATE public.cyg_prompts
SET owner_id = '832f0635-fa47-47be-919e-cc3a4e263cd9',
    is_legacy = true,
    is_private = false;

-- Update projects
UPDATE public.projects
SET owner_id = '832f0635-fa47-47be-919e-cc3a4e263cd9',
    is_private = false;

-- Update cyg_assistants
UPDATE public.cyg_assistants
SET owner_id = '832f0635-fa47-47be-919e-cc3a4e263cd9';

-- Update cyg_threads
UPDATE public.cyg_threads
SET owner_id = '832f0635-fa47-47be-919e-cc3a4e263cd9';

-- 9. Drop existing RLS policies and create new ones

-- user_roles policies
CREATE POLICY "Domain users can read user_roles"
ON public.user_roles FOR SELECT
USING (current_user_has_allowed_domain());

CREATE POLICY "Admins can manage user_roles"
ON public.user_roles FOR ALL
USING (public.is_admin(auth.uid()));

-- resource_shares policies
CREATE POLICY "Domain users can read their shares"
ON public.resource_shares FOR SELECT
USING (current_user_has_allowed_domain() AND (shared_with_user_id = auth.uid() OR shared_by_user_id = auth.uid() OR public.is_admin(auth.uid())));

CREATE POLICY "Resource owners and admins can manage shares"
ON public.resource_shares FOR INSERT
WITH CHECK (
  current_user_has_allowed_domain() 
  AND (
    public.is_admin(auth.uid())
    OR public.can_edit_resource(resource_type, resource_id)
  )
);

CREATE POLICY "Resource owners and admins can update shares"
ON public.resource_shares FOR UPDATE
USING (
  current_user_has_allowed_domain() 
  AND (
    public.is_admin(auth.uid())
    OR shared_by_user_id = auth.uid()
  )
);

CREATE POLICY "Resource owners and admins can delete shares"
ON public.resource_shares FOR DELETE
USING (
  current_user_has_allowed_domain() 
  AND (
    public.is_admin(auth.uid())
    OR shared_by_user_id = auth.uid()
  )
);

-- Drop and recreate cyg_prompts policies
DROP POLICY IF EXISTS "Allowed domain users can read prompts" ON public.cyg_prompts;
DROP POLICY IF EXISTS "Allowed domain users can insert prompts" ON public.cyg_prompts;
DROP POLICY IF EXISTS "Allowed domain users can update prompts" ON public.cyg_prompts;
DROP POLICY IF EXISTS "Allowed domain users can delete prompts" ON public.cyg_prompts;

CREATE POLICY "Users can read accessible prompts"
ON public.cyg_prompts FOR SELECT
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
    OR is_legacy = true
    OR (is_private = false OR is_private IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.resource_shares
      WHERE resource_type = 'prompt'
        AND resource_id = cyg_prompts.row_id
        AND shared_with_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Domain users can insert prompts"
ON public.cyg_prompts FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Owners and admins can update prompts"
ON public.cyg_prompts FOR UPDATE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
    OR is_legacy = true
    OR EXISTS (
      SELECT 1 FROM public.resource_shares
      WHERE resource_type = 'prompt'
        AND resource_id = cyg_prompts.row_id
        AND shared_with_user_id = auth.uid()
        AND permission = 'edit'
    )
  )
);

CREATE POLICY "Owners and admins can delete prompts"
ON public.cyg_prompts FOR DELETE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
  )
);

-- Drop and recreate projects policies
DROP POLICY IF EXISTS "Allowed domain users can read projects" ON public.projects;
DROP POLICY IF EXISTS "Allowed domain users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Allowed domain users can update projects" ON public.projects;
DROP POLICY IF EXISTS "Allowed domain users can delete projects" ON public.projects;

CREATE POLICY "Users can read accessible projects"
ON public.projects FOR SELECT
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
    OR (is_private = false OR is_private IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.resource_shares
      WHERE resource_type = 'project'
        AND resource_id = projects.project_row_id
        AND shared_with_user_id = auth.uid()
    )
  )
);

CREATE POLICY "Domain users can insert projects"
ON public.projects FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Owners and admins can update projects"
ON public.projects FOR UPDATE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.resource_shares
      WHERE resource_type = 'project'
        AND resource_id = projects.project_row_id
        AND shared_with_user_id = auth.uid()
        AND permission = 'edit'
    )
  )
);

CREATE POLICY "Owners and admins can delete projects"
ON public.projects FOR DELETE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
  )
);

-- Drop and recreate cyg_assistants policies
DROP POLICY IF EXISTS "Allowed domain users can read assistants" ON public.cyg_assistants;
DROP POLICY IF EXISTS "Allowed domain users can insert assistants" ON public.cyg_assistants;
DROP POLICY IF EXISTS "Allowed domain users can update assistants" ON public.cyg_assistants;
DROP POLICY IF EXISTS "Allowed domain users can delete assistants" ON public.cyg_assistants;

CREATE POLICY "Users can read accessible assistants"
ON public.cyg_assistants FOR SELECT
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
    OR (prompt_row_id IS NOT NULL AND public.can_read_resource('prompt', prompt_row_id))
  )
);

CREATE POLICY "Domain users can insert assistants"
ON public.cyg_assistants FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Owners and admins can update assistants"
ON public.cyg_assistants FOR UPDATE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
    OR (prompt_row_id IS NOT NULL AND public.can_edit_resource('prompt', prompt_row_id))
  )
);

CREATE POLICY "Owners and admins can delete assistants"
ON public.cyg_assistants FOR DELETE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
  )
);

-- Drop and recreate cyg_threads policies
DROP POLICY IF EXISTS "Allowed domain users can read threads" ON public.cyg_threads;
DROP POLICY IF EXISTS "Allowed domain users can insert threads" ON public.cyg_threads;
DROP POLICY IF EXISTS "Allowed domain users can update threads" ON public.cyg_threads;
DROP POLICY IF EXISTS "Allowed domain users can delete threads" ON public.cyg_threads;

CREATE POLICY "Users can read accessible threads"
ON public.cyg_threads FOR SELECT
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
    OR (assistant_row_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.cyg_assistants a
      WHERE a.row_id = cyg_threads.assistant_row_id
        AND (a.owner_id = auth.uid() OR public.can_read_resource('prompt', a.prompt_row_id))
    ))
  )
);

CREATE POLICY "Domain users can insert threads"
ON public.cyg_threads FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Owners and admins can update threads"
ON public.cyg_threads FOR UPDATE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
    OR (assistant_row_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.cyg_assistants a
      WHERE a.row_id = cyg_threads.assistant_row_id
        AND (a.owner_id = auth.uid() OR public.can_edit_resource('prompt', a.prompt_row_id))
    ))
  )
);

CREATE POLICY "Owners and admins can delete threads"
ON public.cyg_threads FOR DELETE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR owner_id = auth.uid()
  )
);

-- Config tables: Domain users read, admins write
-- cyg_settings
DROP POLICY IF EXISTS "Allowed domain users can read settings" ON public.cyg_settings;
DROP POLICY IF EXISTS "Allowed domain users can insert settings" ON public.cyg_settings;
DROP POLICY IF EXISTS "Allowed domain users can update settings" ON public.cyg_settings;
DROP POLICY IF EXISTS "Allowed domain users can delete settings" ON public.cyg_settings;

CREATE POLICY "Domain users can read settings"
ON public.cyg_settings FOR SELECT
USING (current_user_has_allowed_domain());

CREATE POLICY "Admins can insert settings"
ON public.cyg_settings FOR INSERT
WITH CHECK (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update settings"
ON public.cyg_settings FOR UPDATE
USING (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete settings"
ON public.cyg_settings FOR DELETE
USING (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

-- cyg_models
DROP POLICY IF EXISTS "Allowed domain users can read models" ON public.cyg_models;
DROP POLICY IF EXISTS "Allowed domain users can insert models" ON public.cyg_models;
DROP POLICY IF EXISTS "Allowed domain users can update models" ON public.cyg_models;
DROP POLICY IF EXISTS "Allowed domain users can delete models" ON public.cyg_models;

CREATE POLICY "Domain users can read models"
ON public.cyg_models FOR SELECT
USING (current_user_has_allowed_domain());

CREATE POLICY "Admins can insert models"
ON public.cyg_models FOR INSERT
WITH CHECK (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update models"
ON public.cyg_models FOR UPDATE
USING (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete models"
ON public.cyg_models FOR DELETE
USING (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

-- cyg_model_defaults
DROP POLICY IF EXISTS "Allowed domain users can read model defaults" ON public.cyg_model_defaults;
DROP POLICY IF EXISTS "Allowed domain users can insert model defaults" ON public.cyg_model_defaults;
DROP POLICY IF EXISTS "Allowed domain users can update model defaults" ON public.cyg_model_defaults;
DROP POLICY IF EXISTS "Allowed domain users can delete model defaults" ON public.cyg_model_defaults;

CREATE POLICY "Domain users can read model defaults"
ON public.cyg_model_defaults FOR SELECT
USING (current_user_has_allowed_domain());

CREATE POLICY "Admins can insert model defaults"
ON public.cyg_model_defaults FOR INSERT
WITH CHECK (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update model defaults"
ON public.cyg_model_defaults FOR UPDATE
USING (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete model defaults"
ON public.cyg_model_defaults FOR DELETE
USING (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

-- cyg_assistant_tool_defaults
DROP POLICY IF EXISTS "Allowed domain users can read assistant tool defaults" ON public.cyg_assistant_tool_defaults;
DROP POLICY IF EXISTS "Allowed domain users can insert assistant tool defaults" ON public.cyg_assistant_tool_defaults;
DROP POLICY IF EXISTS "Allowed domain users can update assistant tool defaults" ON public.cyg_assistant_tool_defaults;
DROP POLICY IF EXISTS "Allowed domain users can delete assistant tool defaults" ON public.cyg_assistant_tool_defaults;

CREATE POLICY "Domain users can read assistant tool defaults"
ON public.cyg_assistant_tool_defaults FOR SELECT
USING (current_user_has_allowed_domain());

CREATE POLICY "Admins can insert assistant tool defaults"
ON public.cyg_assistant_tool_defaults FOR INSERT
WITH CHECK (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update assistant tool defaults"
ON public.cyg_assistant_tool_defaults FOR UPDATE
USING (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete assistant tool defaults"
ON public.cyg_assistant_tool_defaults FOR DELETE
USING (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

-- cyg_vector_stores
DROP POLICY IF EXISTS "Allowed domain users can read vector stores" ON public.cyg_vector_stores;
DROP POLICY IF EXISTS "Allowed domain users can insert vector stores" ON public.cyg_vector_stores;
DROP POLICY IF EXISTS "Allowed domain users can update vector stores" ON public.cyg_vector_stores;
DROP POLICY IF EXISTS "Allowed domain users can delete vector stores" ON public.cyg_vector_stores;

CREATE POLICY "Domain users can read vector stores"
ON public.cyg_vector_stores FOR SELECT
USING (current_user_has_allowed_domain());

CREATE POLICY "Admins can insert vector stores"
ON public.cyg_vector_stores FOR INSERT
WITH CHECK (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update vector stores"
ON public.cyg_vector_stores FOR UPDATE
USING (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete vector stores"
ON public.cyg_vector_stores FOR DELETE
USING (current_user_has_allowed_domain() AND public.is_admin(auth.uid()));

-- cyg_confluence_pages
DROP POLICY IF EXISTS "Allowed domain users can read confluence pages" ON public.cyg_confluence_pages;
DROP POLICY IF EXISTS "Allowed domain users can insert confluence pages" ON public.cyg_confluence_pages;
DROP POLICY IF EXISTS "Allowed domain users can update confluence pages" ON public.cyg_confluence_pages;
DROP POLICY IF EXISTS "Allowed domain users can delete confluence pages" ON public.cyg_confluence_pages;

CREATE POLICY "Users can read accessible confluence pages"
ON public.cyg_confluence_pages FOR SELECT
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR (prompt_row_id IS NOT NULL AND public.can_read_resource('prompt', prompt_row_id))
  )
);

CREATE POLICY "Domain users can insert confluence pages"
ON public.cyg_confluence_pages FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Owners and admins can update confluence pages"
ON public.cyg_confluence_pages FOR UPDATE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR (prompt_row_id IS NOT NULL AND public.can_edit_resource('prompt', prompt_row_id))
  )
);

CREATE POLICY "Owners and admins can delete confluence pages"
ON public.cyg_confluence_pages FOR DELETE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR (prompt_row_id IS NOT NULL AND public.can_edit_resource('prompt', prompt_row_id))
  )
);

-- cyg_assistant_files
DROP POLICY IF EXISTS "Allowed domain users can read assistant files" ON public.cyg_assistant_files;
DROP POLICY IF EXISTS "Allowed domain users can insert assistant files" ON public.cyg_assistant_files;
DROP POLICY IF EXISTS "Allowed domain users can update assistant files" ON public.cyg_assistant_files;
DROP POLICY IF EXISTS "Allowed domain users can delete assistant files" ON public.cyg_assistant_files;

CREATE POLICY "Users can read accessible assistant files"
ON public.cyg_assistant_files FOR SELECT
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR (assistant_row_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.cyg_assistants a
      WHERE a.row_id = cyg_assistant_files.assistant_row_id
        AND (a.owner_id = auth.uid() OR public.can_read_resource('prompt', a.prompt_row_id))
    ))
  )
);

CREATE POLICY "Domain users can insert assistant files"
ON public.cyg_assistant_files FOR INSERT
WITH CHECK (current_user_has_allowed_domain());

CREATE POLICY "Owners and admins can update assistant files"
ON public.cyg_assistant_files FOR UPDATE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR (assistant_row_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.cyg_assistants a
      WHERE a.row_id = cyg_assistant_files.assistant_row_id
        AND (a.owner_id = auth.uid() OR public.can_edit_resource('prompt', a.prompt_row_id))
    ))
  )
);

CREATE POLICY "Owners and admins can delete assistant files"
ON public.cyg_assistant_files FOR DELETE
USING (
  current_user_has_allowed_domain()
  AND (
    public.is_admin(auth.uid())
    OR (assistant_row_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.cyg_assistants a
      WHERE a.row_id = cyg_assistant_files.assistant_row_id
        AND (a.owner_id = auth.uid() OR public.can_edit_resource('prompt', a.prompt_row_id))
    ))
  )
);