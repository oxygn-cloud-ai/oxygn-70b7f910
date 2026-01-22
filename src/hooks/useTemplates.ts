import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { trackEvent } from '@/lib/posthog';

export interface TemplateStructure {
  prompt_name?: string | null;
  input_admin_prompt?: string | null;
  input_user_prompt?: string | null;
  note?: string | null;
  icon_name?: string | null;
  model?: string | null;
  model_on?: boolean | null;
  temperature?: number | null;
  temperature_on?: boolean | null;
  max_tokens?: number | null;
  max_tokens_on?: boolean | null;
  top_p?: number | null;
  top_p_on?: boolean | null;
  frequency_penalty?: number | null;
  frequency_penalty_on?: boolean | null;
  presence_penalty?: number | null;
  presence_penalty_on?: boolean | null;
  response_format?: string | null;
  response_format_on?: boolean | null;
  reasoning_effort?: string | null;
  reasoning_effort_on?: boolean | null;
  node_type?: string | null;
  post_action?: string | null;
  post_action_config?: Record<string, unknown> | null;
  is_assistant?: boolean | null;
  thread_mode?: string | null;
  child_thread_strategy?: string | null;
  children?: TemplateStructure[];
  [key: string]: unknown;
}

export interface Template {
  row_id: string;
  template_name: string;
  template_description?: string | null;
  category?: string | null;
  structure?: TemplateStructure | null;
  variable_definitions?: Record<string, unknown> | null;
  is_private?: boolean | null;
  is_deleted?: boolean | null;
  owner_id?: string | null;
  version?: number | null;
  starred?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface CreateTemplateParams {
  name: string;
  description?: string;
  category?: string;
  structure?: TemplateStructure;
  isPrivate?: boolean;
}

export interface CreateFromPromptOptions {
  name: string;
  description?: string;
  category?: string;
  isPrivate?: boolean;
  includeChildren?: boolean;
}

export interface UseTemplatesReturn {
  templates: Template[];
  isLoading: boolean;
  fetchTemplates: () => Promise<void>;
  createTemplate: (params: CreateTemplateParams) => Promise<Template | null>;
  updateTemplate: (rowId: string, updates: Partial<Template>) => Promise<boolean>;
  deleteTemplate: (rowId: string, isAdmin?: boolean) => Promise<boolean>;
  getTemplate: (rowId: string) => Promise<Template | null>;
  createFromPrompt: (promptRowId: string, options: CreateFromPromptOptions) => Promise<Template | null>;
  extractTemplateVariables: (structure: TemplateStructure) => string[];
}

/**
 * Hook for managing templates
 */
export const useTemplates = (): UseTemplatesReturn => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  /**
   * Fetch all templates visible to the user (RLS handles access control)
   */
  const fetchTemplates = useCallback(async (): Promise<void> => {
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
      setTemplates((data as Template[]) || []);
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
  }: CreateTemplateParams): Promise<Template | null> => {
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
      
      setTemplates(prev => [data as Template, ...prev]);
      toast.success('Template created');
      
      // Track template creation
      trackEvent('template_created', {
        template_id: data?.row_id,
        template_name: name,
        category,
      });
      
      return data as Template;
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
      return null;
    }
  }, [user]);

  /**
   * Update a template
   */
  const updateTemplate = useCallback(async (rowId: string, updates: Partial<Template>): Promise<boolean> => {
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
          version: ((current?.version as number) || 0) + 1,
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
  const deleteTemplate = useCallback(async (rowId: string, isAdmin = false): Promise<boolean> => {
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
  const getTemplate = useCallback(async (rowId: string): Promise<Template | null> => {
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_TEMPLATES_TBL)
        .select('*')
        .eq('row_id', rowId)
        .maybeSingle();

      if (error) throw error;
      return data as Template | null;
    } catch (error) {
      console.error('Error fetching template:', error);
      return null;
    }
  }, []);

  /**
   * Create a template from an existing prompt hierarchy
   */
  const createFromPrompt = useCallback(async (
    promptRowId: string,
    options: CreateFromPromptOptions
  ): Promise<Template | null> => {
    const {
      name,
      description = '',
      category = 'general',
      isPrivate = false,
      includeChildren = true,
    } = options;

    try {
      // Fetch the prompt and all its children recursively
      const fetchPromptHierarchy = async (rowId: string, shouldIncludeChildren = true): Promise<TemplateStructure> => {
        const { data: prompt, error } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('*')
          .eq('row_id', rowId)
          .maybeSingle();

        if (error) throw error;
        if (!prompt) throw new Error(`Prompt not found: ${rowId}`);

        let childStructures: TemplateStructure[] = [];
        
        // Only fetch children if includeChildren is true
        if (shouldIncludeChildren) {
          const { data: children } = await supabase
            .from(import.meta.env.VITE_PROMPTS_TBL)
            .select('row_id')
            .eq('parent_row_id', rowId)
            .eq('is_deleted', false)
            .order('position_lex', { ascending: true });

          if (children) {
            for (const child of children) {
              const childHierarchy = await fetchPromptHierarchy(child.row_id, true);
              childStructures.push(childHierarchy);
            }
          }
        }

        // CRITICAL: Sanitize q.ref[UUID] patterns to prevent cross-family data leakage
        const sanitizeQRef = (text: string | null | undefined): string | null | undefined => {
          if (!text || typeof text !== 'string') return text;
          return text.replace(/\{\{q\.ref\[[a-f0-9-]{36}\]\.([a-z_]+)\}\}/gi, '{{q.ref[TEMPLATE_REF].$1}}');
        };

        return {
          prompt_name: prompt.prompt_name,
          input_admin_prompt: sanitizeQRef(prompt.input_admin_prompt),
          input_user_prompt: sanitizeQRef(prompt.input_user_prompt),
          note: prompt.note,
          icon_name: prompt.icon_name,
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
          reasoning_effort: prompt.reasoning_effort,
          reasoning_effort_on: prompt.reasoning_effort_on,
          tool_choice: prompt.tool_choice,
          tool_choice_on: prompt.tool_choice_on,
          is_assistant: prompt.is_assistant,
          thread_mode: prompt.thread_mode,
          child_thread_strategy: prompt.child_thread_strategy,
          default_child_thread_strategy: prompt.default_child_thread_strategy,
          web_search_on: prompt.web_search_on,
          confluence_enabled: prompt.confluence_enabled,
          code_interpreter_on: prompt.code_interpreter_on,
          file_search_on: prompt.file_search_on,
          node_type: prompt.node_type,
          post_action: prompt.post_action,
          post_action_config: prompt.post_action_config,
          json_schema_template_id: prompt.json_schema_template_id,
          exclude_from_cascade: prompt.exclude_from_cascade,
          exclude_from_export: prompt.exclude_from_export,
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
  const extractTemplateVariables = useCallback((structure: TemplateStructure): string[] => {
    const variables = new Set<string>();
    const variablePattern = /\{\{([^}]+)\}\}/g;

    const extractFromObject = (obj: unknown): void => {
      if (!obj) return;
      
      if (typeof obj === 'string') {
        const matches = obj.matchAll(variablePattern);
        for (const match of matches) {
          const varName = match[1].trim();
          variables.add(varName);
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(extractFromObject);
      } else if (typeof obj === 'object') {
        Object.values(obj as Record<string, unknown>).forEach(extractFromObject);
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
