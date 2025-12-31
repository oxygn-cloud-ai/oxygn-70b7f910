-- Fix database functions that reference dropped cyg_prompts table
-- Need to DROP and recreate owns_prompt due to parameter order mismatch

-- 1. Drop and recreate owns_prompt function
DROP FUNCTION IF EXISTS public.owns_prompt(uuid, uuid);

CREATE FUNCTION public.owns_prompt(_prompt_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE prompt_chain AS (
    SELECT row_id, parent_row_id, owner_id
    FROM public.q_prompts
    WHERE row_id = _prompt_id
    
    UNION ALL
    
    SELECT p.row_id, p.parent_row_id, p.owner_id
    FROM public.q_prompts p
    INNER JOIN prompt_chain pc ON p.row_id = pc.parent_row_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM prompt_chain
    WHERE owner_id = _user_id
  )
$$;

-- 2. Update can_read_resource function
CREATE OR REPLACE FUNCTION public.can_read_resource(_resource_type text, _resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    public.is_admin(auth.uid())
    OR
    CASE 
      WHEN _resource_type = 'prompt' THEN (
        SELECT 
          (owner_id = auth.uid())
          OR (is_legacy = true)
          OR (is_private = false OR is_private IS NULL)
          OR EXISTS (
            SELECT 1 FROM public.resource_shares
            WHERE resource_type = 'prompt'
              AND resource_id = _resource_id
              AND shared_with_user_id = auth.uid()
          )
        FROM public.q_prompts
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

-- 3. Update can_edit_resource function
CREATE OR REPLACE FUNCTION public.can_edit_resource(_resource_type text, _resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    public.is_admin(auth.uid())
    OR
    CASE 
      WHEN _resource_type = 'prompt' THEN (
        SELECT 
          (owner_id = auth.uid())
          OR (is_legacy = true)
          OR EXISTS (
            SELECT 1 FROM public.resource_shares
            WHERE resource_type = 'prompt'
              AND resource_id = _resource_id
              AND shared_with_user_id = auth.uid()
              AND permission = 'edit'
          )
        FROM public.q_prompts
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

-- 4. Update set_assistant_owner trigger function
CREATE OR REPLACE FUNCTION public.set_assistant_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.prompt_row_id IS NOT NULL AND NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id
    FROM public.q_prompts
    WHERE row_id = NEW.prompt_row_id;
  END IF;
  RETURN NEW;
END;
$$;