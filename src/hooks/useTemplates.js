import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook for managing templates
 */
export const useTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  /**
   * Fetch all accessible templates
   */
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
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
  }, []);

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
        .single();

      if (error) throw error;
      
      setTemplates(prev => [data, ...prev]);
      toast.success('Template created');
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
        .single();

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
  const deleteTemplate = useCallback(async (rowId) => {
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_TEMPLATES_TBL)
        .update({ is_deleted: true })
        .eq('row_id', rowId);

      if (error) throw error;
      
      setTemplates(prev => prev.filter(t => t.row_id !== rowId));
      toast.success('Template deleted');
      return true;
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
      return false;
    }
  }, []);

  /**
   * Get a template by ID
   */
  const getTemplate = useCallback(async (rowId) => {
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_TEMPLATES_TBL)
        .select('*')
        .eq('row_id', rowId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching template:', error);
      return null;
    }
  }, []);

  /**
   * Create a template from an existing prompt hierarchy
   */
  const createFromPrompt = useCallback(async (promptRowId, templateName) => {
    try {
      // Fetch the prompt and all its children recursively
      const fetchPromptHierarchy = async (rowId) => {
        const { data: prompt, error } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('*')
          .eq('row_id', rowId)
          .single();

        if (error) throw error;

        // Fetch children ordered by position
        const { data: children } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('row_id')
          .eq('parent_row_id', rowId)
          .eq('is_deleted', false)
          .order('position', { ascending: true });

        const childStructures = [];
        if (children) {
          for (const child of children) {
            const childHierarchy = await fetchPromptHierarchy(child.row_id);
            childStructures.push(childHierarchy);
          }
        }

        // Include all relevant prompt fields in the template structure
        return {
          _id: prompt.row_id, // Use original ID for reference
          prompt_name: prompt.prompt_name,
          input_admin_prompt: prompt.input_admin_prompt,
          input_user_prompt: prompt.input_user_prompt,
          note: prompt.note,
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
          // Assistant settings
          is_assistant: prompt.is_assistant,
          thread_mode: prompt.thread_mode,
          child_thread_strategy: prompt.child_thread_strategy,
          default_child_thread_strategy: prompt.default_child_thread_strategy,
          // Tools
          web_search_on: prompt.web_search_on,
          confluence_enabled: prompt.confluence_enabled,
          // Children
          children: childStructures,
        };
      };

      const structure = await fetchPromptHierarchy(promptRowId);

      const template = await createTemplate({
        name: templateName,
        structure,
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
          // Exclude system variables (q.* pattern for chained prompt references)
          // but allow user-defined namespaced variables like policy.name
          if (!varName.startsWith('q.')) {
            variables.add(varName);
          }
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
