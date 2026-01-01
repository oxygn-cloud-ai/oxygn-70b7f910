-- Phase 3-4: Update RLS Policies for Strict Ownership

-- ========================================
-- Q_PROMPTS - Strict ownership
-- ========================================

-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "q Users can read accessible prompts" ON q_prompts;

-- New strict ownership policy for SELECT
CREATE POLICY "Users can read own prompts"
ON q_prompts FOR SELECT
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR 
    owner_id = auth.uid()
  )
);

-- Drop existing UPDATE policy and recreate without is_legacy
DROP POLICY IF EXISTS "q Owners and admins can update prompts" ON q_prompts;

CREATE POLICY "Owners and admins can update prompts"
ON q_prompts FOR UPDATE
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR 
    owner_id = auth.uid()
  )
);

-- ========================================
-- Q_TEMPLATES - Strict ownership
-- ========================================

-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "q Users can read accessible templates" ON q_templates;

-- New strict ownership policy
CREATE POLICY "Users can read own templates"
ON q_templates FOR SELECT
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR 
    owner_id = auth.uid()
  )
);

-- ========================================
-- Q_JSON_SCHEMA_TEMPLATES - Keep NULL owners visible as system
-- ========================================

-- Drop existing policy if any
DROP POLICY IF EXISTS "Users can view accessible schema templates" ON q_json_schema_templates;

-- New policy: own + system (NULL owner)
CREATE POLICY "Users can view own or system schema templates"
ON q_json_schema_templates FOR SELECT
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR
    owner_id IS NULL OR  -- System templates
    owner_id = auth.uid() OR  -- Own templates
    is_private = false  -- Shared templates
  )
);

-- ========================================
-- Q_PROMPT_LIBRARY - Add system access
-- ========================================

-- Drop existing policy
DROP POLICY IF EXISTS "Users can read shared or own library items" ON q_prompt_library;

-- New policy with system items visible
CREATE POLICY "Users can read library items"
ON q_prompt_library FOR SELECT
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR 
    owner_id = auth.uid() OR 
    is_system = true OR 
    is_private = false
  )
);

-- System items are immutable by non-admins
DROP POLICY IF EXISTS "Users can update own library items" ON q_prompt_library;

CREATE POLICY "Users can update own non-system library items"
ON q_prompt_library FOR UPDATE
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR 
    (owner_id = auth.uid() AND (is_system = false OR is_system IS NULL))
  )
);

-- System items cannot be deleted by non-admins
DROP POLICY IF EXISTS "Users can delete own library items" ON q_prompt_library;

CREATE POLICY "Users can delete own non-system library items"
ON q_prompt_library FOR DELETE
USING (
  current_user_has_allowed_domain() AND (
    is_admin(auth.uid()) OR 
    (owner_id = auth.uid() AND (is_system = false OR is_system IS NULL))
  )
);