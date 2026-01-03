import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

export const useJsonSchemaTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch JSON schema templates (own + system templates)
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Query own templates + system templates (owner_id IS NULL)
      // RLS also handles this, but explicit query for clarity
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
      setTemplates(data || []);
      return data || [];
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
  }) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('q_json_schema_templates')
        .insert({
          owner_id: user.id,
          schema_name: schemaName,
          schema_description: schemaDescription,
          category: category || 'general',
          json_schema: jsonSchema,
          node_config: nodeConfig || null,
          child_creation: childCreation || null,
          action_config: actionConfig || null,
          model_config: modelConfig || null,
          system_prompt_template: systemPromptTemplate || null,
          sample_output: sampleOutput || null
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [...prev, data].sort((a, b) => 
        a.schema_name.localeCompare(b.schema_name)
      ));
      toast.success('Schema template saved');
      
      // Track schema template created
      trackEvent('schema_template_created', {
        template_id: data.row_id,
        template_name: schemaName,
        category: category || 'general',
      });
      
      return data;
    } catch (error) {
      console.error('Error creating schema template:', error);
      toast.error('Failed to save schema template');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Update an existing template
  const updateTemplate = useCallback(async (rowId, updates) => {
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
        .single();

      if (error) throw error;

      setTemplates(prev => prev.map(t => t.row_id === rowId ? data : t));
      toast.success('Schema template updated');
      return data;
    } catch (error) {
      console.error('Error updating schema template:', error);
      toast.error('Failed to update schema template');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Delete a template (soft delete)
  const deleteTemplate = useCallback(async (rowId) => {
    try {
      const { error } = await supabase
        .from('q_json_schema_templates')
        .update({ is_deleted: true })
        .eq('row_id', rowId);

      if (error) {
        // RLS policy violation - user doesn't have permission
        if (error.code === '42501') {
          toast.info('This schema template belongs to another user and cannot be deleted');
          return false;
        }
        throw error;
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
  const duplicateTemplate = useCallback(async (template) => {
    return createTemplate({
      schemaName: `${template.schema_name} (copy)`,
      schemaDescription: template.schema_description,
      category: template.category,
      jsonSchema: template.json_schema,
      nodeConfig: template.node_config,
      childCreation: template.child_creation,
      actionConfig: template.action_config,
      modelConfig: template.model_config,
      systemPromptTemplate: template.system_prompt_template
    });
  }, [createTemplate]);

  // Get a single template by ID
  const getTemplate = useCallback(async (rowId) => {
    try {
      const { data, error } = await supabase
        .from('q_json_schema_templates')
        .select('*')
        .eq('row_id', rowId)
        .single();

      if (error) throw error;
      return data;
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
