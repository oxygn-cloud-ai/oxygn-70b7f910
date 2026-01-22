import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';
import type { Json } from '@/integrations/supabase/types';

export interface JsonSchemaTemplate {
  row_id: string;
  owner_id: string | null;
  schema_name: string;
  schema_description: string | null;
  category: string | null;
  json_schema: Json;
  node_config: Json | null;
  child_creation: Json | null;
  action_config: Json | null;
  model_config: Json | null;
  system_prompt_template: string | null;
  sample_output: Json | null;
  is_deleted: boolean | null;
  is_private: boolean | null;
  contributor_display_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CreateTemplateParams {
  schemaName: string;
  schemaDescription?: string;
  category?: string;
  jsonSchema: Record<string, unknown>;
  nodeConfig?: Record<string, unknown> | null;
  childCreation?: Record<string, unknown> | null;
  actionConfig?: Record<string, unknown> | null;
  modelConfig?: Record<string, unknown> | null;
  systemPromptTemplate?: string | null;
  sampleOutput?: Record<string, unknown> | null;
}

interface UseJsonSchemaTemplatesReturn {
  templates: JsonSchemaTemplate[];
  isLoading: boolean;
  isSaving: boolean;
  fetchTemplates: () => Promise<JsonSchemaTemplate[]>;
  createTemplate: (params: CreateTemplateParams) => Promise<JsonSchemaTemplate>;
  updateTemplate: (rowId: string, updates: Partial<JsonSchemaTemplate>) => Promise<JsonSchemaTemplate>;
  deleteTemplate: (rowId: string, isAdmin?: boolean) => Promise<boolean>;
  duplicateTemplate: (template: JsonSchemaTemplate) => Promise<JsonSchemaTemplate>;
  getTemplate: (rowId: string) => Promise<JsonSchemaTemplate | null>;
}

export const useJsonSchemaTemplates = (): UseJsonSchemaTemplatesReturn => {
  const [templates, setTemplates] = useState<JsonSchemaTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch JSON schema templates (own + system templates)
  const fetchTemplates = useCallback(async (): Promise<JsonSchemaTemplate[]> => {
    setIsLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Query own templates + system templates (owner_id IS NULL)
      let query = supabase
        .from('q_json_schema_templates')
        .select('*')
        .eq('is_deleted', false);
      
      // If user is logged in, filter to show own + system templates
      if (user?.id) {
        query = query.or(`owner_id.eq.${user.id},owner_id.is.null`);
      }
      
      const { data, error } = await query
        .order('category', { ascending: true })
        .order('schema_name', { ascending: true });

      if (error) {
        console.error('[useJsonSchemaTemplates] Query error:', error);
        throw error;
      }

      console.log('[useJsonSchemaTemplates] Fetched templates:', data?.length || 0);
      const result = (data || []) as JsonSchemaTemplate[];
      setTemplates(result);
      return result;
    } catch (error) {
      console.error('[useJsonSchemaTemplates] Fetch error:', error);
      toast.error('Failed to load schema templates');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new schema template
  const createTemplate = useCallback(async ({
    schemaName,
    schemaDescription,
    category,
    jsonSchema,
    nodeConfig,
    childCreation,
    actionConfig,
    modelConfig,
    systemPromptTemplate,
    sampleOutput
  }: CreateTemplateParams): Promise<JsonSchemaTemplate> => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('q_json_schema_templates')
        .insert({
          owner_id: user.id,
          schema_name: schemaName,
          schema_description: schemaDescription || null,
          category: category || 'general',
          json_schema: jsonSchema as Json,
          node_config: nodeConfig as Json || null,
          child_creation: childCreation as Json || null,
          action_config: actionConfig as Json || null,
          model_config: modelConfig as Json || null,
          system_prompt_template: systemPromptTemplate || null,
          sample_output: sampleOutput as Json || null
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      const template = data as JsonSchemaTemplate;
      setTemplates(prev => [...prev, template].sort((a, b) => 
        a.schema_name.localeCompare(b.schema_name)
      ));
      toast.success('Schema template saved');
      
      // Track schema template created
      trackEvent('schema_template_created', {
        template_id: template.row_id,
        template_name: schemaName,
        category: category || 'general',
      });
      
      return template;
    } catch (error) {
      console.error('Error creating schema template:', error);
      toast.error('Failed to save schema template');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Update an existing template
  const updateTemplate = useCallback(async (rowId: string, updates: Partial<JsonSchemaTemplate>): Promise<JsonSchemaTemplate> => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('q_json_schema_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('row_id', rowId)
        .select()
        .maybeSingle();

      if (error) throw error;

      const template = data as JsonSchemaTemplate;
      setTemplates(prev => prev.map(t => t.row_id === rowId ? template : t));
      toast.success('Schema template updated');
      return template;
    } catch (error) {
      console.error('Error updating schema template:', error);
      toast.error('Failed to update schema template');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Delete a template (soft delete)
  const deleteTemplate = useCallback(async (rowId: string, isAdmin = false): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return false;
      }

      // Build query - admins can delete any template, non-admins only their own
      let query = supabase
        .from('q_json_schema_templates')
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
          toast.info('This schema template belongs to another user and cannot be deleted');
          return false;
        }
        throw error;
      }

      // Check if any row was actually updated
      if (!data) {
        toast.info('This schema template belongs to another user and cannot be deleted');
        return false;
      }

      setTemplates(prev => prev.filter(t => t.row_id !== rowId));
      toast.success('Schema template deleted');
      return true;
    } catch (error) {
      console.error('Error deleting schema template:', error);
      toast.error('Failed to delete schema template');
      return false;
    }
  }, []);

  // Duplicate a template
  const duplicateTemplate = useCallback(async (template: JsonSchemaTemplate): Promise<JsonSchemaTemplate> => {
    return createTemplate({
      schemaName: `${template.schema_name} (copy)`,
      schemaDescription: template.schema_description || undefined,
      category: template.category || undefined,
      jsonSchema: template.json_schema as Record<string, unknown>,
      nodeConfig: template.node_config as Record<string, unknown> | null,
      childCreation: template.child_creation as Record<string, unknown> | null,
      actionConfig: template.action_config as Record<string, unknown> | null,
      modelConfig: template.model_config as Record<string, unknown> | null,
      systemPromptTemplate: template.system_prompt_template
    });
  }, [createTemplate]);

  // Get a single template by ID
  const getTemplate = useCallback(async (rowId: string): Promise<JsonSchemaTemplate | null> => {
    try {
      const { data, error } = await supabase
        .from('q_json_schema_templates')
        .select('*')
        .eq('row_id', rowId)
        .maybeSingle();

      if (error) throw error;
      return data as JsonSchemaTemplate | null;
    } catch (error) {
      console.error('Error fetching schema template:', error);
      return null;
    }
  }, []);

  // Load templates on mount
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    isLoading,
    isSaving,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    getTemplate
  };
};

export default useJsonSchemaTemplates;
