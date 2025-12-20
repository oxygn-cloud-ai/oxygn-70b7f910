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
        .from('cyg_templates')
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
        .from('cyg_templates')
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
        .from('cyg_templates')
        .select('version')
        .eq('row_id', rowId)
        .single();

      const { error } = await supabase
        .from('cyg_templates')
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
        .from('cyg_templates')
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
        .from('cyg_templates')
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

        // Fetch children
        const { data: children } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('row_id')
          .eq('parent_row_id', rowId)
          .eq('is_deleted', false);

        const childStructures = [];
        if (children) {
          for (const child of children) {
            const childHierarchy = await fetchPromptHierarchy(child.row_id);
            childStructures.push(childHierarchy);
          }
        }

        return {
          prompt_name: prompt.prompt_name,
          input_admin_prompt: prompt.input_admin_prompt,
          input_user_prompt: prompt.input_user_prompt,
          model: prompt.model,
          temperature: prompt.temperature,
          max_tokens: prompt.max_tokens,
          top_p: prompt.top_p,
          frequency_penalty: prompt.frequency_penalty,
          presence_penalty: prompt.presence_penalty,
          is_assistant: prompt.is_assistant,
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
          // Only include user variables (not system or chained)
          if (!varName.startsWith('q.') && !varName.includes('.')) {
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
