-- Phase 2: Update RLS Helper Functions
-- Remove is_legacy dependencies and simplify to strict ownership

-- Update can_read_resource to remove is_legacy dependency
CREATE OR REPLACE FUNCTION public.can_read_resource(_resource_type text, _resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    public.is_admin(auth.uid())
    OR
    CASE 
      WHEN _resource_type = 'prompt' THEN (
        SELECT owner_id = auth.uid()
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
$function$;

-- Update can_edit_resource to remove is_legacy dependency
CREATE OR REPLACE FUNCTION public.can_edit_resource(_resource_type text, _resource_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    public.is_admin(auth.uid())
    OR
    CASE 
      WHEN _resource_type = 'prompt' THEN (
        SELECT owner_id = auth.uid()
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
$function$;