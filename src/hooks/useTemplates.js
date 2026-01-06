import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { trackEvent } from '@/lib/posthog';

/**
 * Hook for managing templates
 */
export const useTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  /**
   * Fetch all templates visible to the user (RLS handles access control)
   */
  const fetchTemplates = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // RLS policy handles visibility - fetch all non-deleted templates
      const { data, error } = await supabase
        .from(import.meta.env.VITE_TEMPLATES_TBL)
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  /**
   * Create a new template
   */
  const createTemplate = useCallback(async ({
    name,
    description = '',
    category = 'general',
    structure = {},
    isPrivate = false,
  }) => {
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_TEMPLATES_TBL)
        .insert({
          template_name: name,
          template_description: description,
          category,
          structure,
          is_private: isPrivate,
          owner_id: user?.id,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      
      setTemplates(prev => [data, ...prev]);
      toast.success('Template created');
      
      // Track template creation
      trackEvent('template_created', {
        template_id: data?.row_id,
        template_name: name,
        category,
      });
      
      return data;
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
      return null;
    }
  }, [user]);

  /**
   * Update a template
   */
  const updateTemplate = useCallback(async (rowId, updates) => {
    try {
      // First get current version
      const { data: current } = await supabase
        .from(import.meta.env.VITE_TEMPLATES_TBL)
        .select('version')
        .eq('row_id', rowId)
        .maybeSingle();

      const { error } = await supabase
        .from(import.meta.env.VITE_TEMPLATES_TBL)
        .update({
          ...updates,
          version: (current?.version || 0) + 1,
        })
        .eq('row_id', rowId);

      if (error) throw error;
      
      setTemplates(prev => 
        prev.map(t => t.row_id === rowId ? { ...t, ...updates } : t)
      );
      toast.success('Template updated');
      return true;
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
      return false;
    }
  }, []);

  /**
   * Delete a template (soft delete)
   */
  const deleteTemplate = useCallback(async (rowId, isAdmin = false) => {
    try {
      if (!user?.id) {
        toast.error('Not authenticated');
        return false;
      }

      // Build query - admins can delete any template, non-admins only their own
      let query = supabase
        .from(import.meta.env.VITE_TEMPLATES_TBL)
        .update({ is_deleted: true })
        .eq('row_id', rowId);

      // Only filter by owner_id if not admin
      if (!isAdmin) {
        query = query.eq('owner_id', user.id);
      }

      const { data, error } = await query
        .select('row_id')
        .maybeSingle();

      if (error) {
        // RLS policy violation - user doesn't have permission
        if (error.code === '42501') {
          toast.info('This template belongs to another user and cannot be deleted');
          return false;
        }
        throw error;
      }

      // Check if any row was actually updated
      if (!data) {
        toast.info('This template belongs to another user and cannot be deleted');
        return false;
      }
      
      setTemplates(prev => prev.filter(t => t.row_id !== rowId));
      toast.success('Template deleted');
      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
      return false;
    }
  }, [user]);

  /**
   * Get a template by ID
   */
  const getTemplate = useCallback(async (rowId) => {
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_TEMPLATES_TBL)
        .select('*')
        .eq('row_id', rowId)
        .maybeSingle();

      if (error) throw error;
      return data; // May be null if not found
    } catch (error) {
      console.error('Error fetching template:', error);
      return null;
    }
  }, []);

  /**
   * Create a template from an existing prompt hierarchy
   * @param {string} promptRowId - The prompt to create from
   * @param {Object} options - Template options
   * @param {string} options.name - Template name
   * @param {string} options.description - Template description
   * @param {string} options.category - Template category
   * @param {boolean} options.isPrivate - Whether template is private
   * @param {boolean} options.includeChildren - Whether to include child prompts
   */
  const createFromPrompt = useCallback(async (promptRowId, options = {}) => {
    const {
      name,
      description = '',
      category = 'general',
      isPrivate = false,
      includeChildren = true,
    } = options;

    try {
      // Fetch the prompt and all its children recursively
      const fetchPromptHierarchy = async (rowId, shouldIncludeChildren = true) => {
        const { data: prompt, error } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('*')
          .eq('row_id', rowId)
          .maybeSingle();

        if (error) throw error;
        if (!prompt) throw new Error(`Prompt not found: ${rowId}`);

        let childStructures = [];
        
        // Only fetch children if includeChildren is true
        if (shouldIncludeChildren) {
          const { data: children } = await supabase
            .from(import.meta.env.VITE_PROMPTS_TBL)
            .select('row_id')
            .eq('parent_row_id', rowId)
            .eq('is_deleted', false)
            .order('position', { ascending: true });

          if (children) {
            for (const child of children) {
              const childHierarchy = await fetchPromptHierarchy(child.row_id, true);
              childStructures.push(childHierarchy);
            }
          }
        }

        // CRITICAL: Sanitize q.ref[UUID] patterns to prevent cross-family data leakage
        // Templates should NOT contain hardcoded UUIDs from the source family
        const sanitizeQRef = (text) => {
          if (!text || typeof text !== 'string') return text;
          // Replace {{q.ref[UUID].field}} with {{q.ref[TEMPLATE_REF].field}} placeholder
          // The placeholder indicates this was a reference that needs remapping on instantiation
          return text.replace(/\{\{q\.ref\[[a-f0-9-]{36}\]\.([a-z_]+)\}\}/gi, '{{q.ref[TEMPLATE_REF].$1}}');
        };

        // Include ALL relevant prompt fields in the template structure
        // REMOVED: _id field - embedding source UUIDs causes cross-family leakage
        return {
          // NO _id FIELD - this was the root cause of template-based cross-family leaks
          prompt_name: prompt.prompt_name,
          input_admin_prompt: sanitizeQRef(prompt.input_admin_prompt),
          input_user_prompt: sanitizeQRef(prompt.input_user_prompt),
          note: prompt.note,
          icon_name: prompt.icon_name,
          // Model settings
          model: prompt.model,
          model_on: prompt.model_on,
          temperature: prompt.temperature,
          temperature_on: prompt.temperature_on,
          max_tokens: prompt.max_tokens,
          max_tokens_on: prompt.max_tokens_on,
          top_p: prompt.top_p,
          top_p_on: prompt.top_p_on,
          frequency_penalty: prompt.frequency_penalty,
          frequency_penalty_on: prompt.frequency_penalty_on,
          presence_penalty: prompt.presence_penalty,
          presence_penalty_on: prompt.presence_penalty_on,
          stop: prompt.stop,
          stop_on: prompt.stop_on,
          response_format: prompt.response_format,
          response_format_on: prompt.response_format_on,
          n: prompt.n,
          n_on: prompt.n_on,
          logit_bias: prompt.logit_bias,
          logit_bias_on: prompt.logit_bias_on,
          o_user: prompt.o_user,
          o_user_on: prompt.o_user_on,
          stream: prompt.stream,
          stream_on: prompt.stream_on,
          seed: prompt.seed,
          seed_on: prompt.seed_on,
          // Reasoning settings
          reasoning_effort: prompt.reasoning_effort,
          reasoning_effort_on: prompt.reasoning_effort_on,
          tool_choice: prompt.tool_choice,
          tool_choice_on: prompt.tool_choice_on,
          // Assistant settings
          is_assistant: prompt.is_assistant,
          thread_mode: prompt.thread_mode,
          child_thread_strategy: prompt.child_thread_strategy,
          default_child_thread_strategy: prompt.default_child_thread_strategy,
          // Tools
          web_search_on: prompt.web_search_on,
          confluence_enabled: prompt.confluence_enabled,
          code_interpreter_on: prompt.code_interpreter_on,
          file_search_on: prompt.file_search_on,
          // ACTION NODE FIELDS (critical for action templates)
          node_type: prompt.node_type,
          post_action: prompt.post_action,
          post_action_config: prompt.post_action_config,
          json_schema_template_id: prompt.json_schema_template_id,
          // REMOVED: extracted_variables - contains runtime data from source family
          // Exclusion flags
          exclude_from_cascade: prompt.exclude_from_cascade,
          exclude_from_export: prompt.exclude_from_export,
          // Children
          children: childStructures,
        };
      };

      const structure = await fetchPromptHierarchy(promptRowId, includeChildren);

      const template = await createTemplate({
        name,
        description,
        category,
        structure,
        isPrivate,
      });

      return template;
    } catch (error) {
      console.error('Error creating template from prompt:', error);
      toast.error('Failed to create template from prompt');
      return null;
    }
  }, [createTemplate]);

  /**
   * Extract variables from a template structure
   */
  const extractTemplateVariables = useCallback((structure) => {
    const variables = new Set();
    const variablePattern = /\{\{([^}]+)\}\}/g;

    const extractFromObject = (obj) => {
      if (!obj) return;
      
      if (typeof obj === 'string') {
        const matches = obj.matchAll(variablePattern);
        for (const match of matches) {
          const varName = match[1].trim();
          // Include all variables - both user-defined and system (q.*) variables
          variables.add(varName);
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(extractFromObject);
      } else if (typeof obj === 'object') {
        Object.values(obj).forEach(extractFromObject);
      }
    };

    extractFromObject(structure);
    return Array.from(variables);
  }, []);

  return {
    templates,
    isLoading,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplate,
    createFromPrompt,
    extractTemplateVariables,
  };
};

export default useTemplates;
