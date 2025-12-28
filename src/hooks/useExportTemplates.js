import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export const useExportTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all export templates for the current user (excluding deleted)
  const fetchTemplates = useCallback(async (exportType = null) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('q_export_templates')
        .select('*')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('updated_at', { ascending: false });

      if (exportType) {
        query = query.eq('export_type', exportType);
      }

      const { data, error } = await query;
      if (error) throw error;

      setTemplates(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching export templates:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save a new export template
  const saveTemplate = useCallback(async ({
    templateName,
    exportType,
    selectedFields,
    selectedVariables,
    confluenceConfig
  }) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('q_export_templates')
        .insert({
          owner_id: user.id,
          template_name: templateName,
          export_type: exportType,
          selected_fields: selectedFields,
          selected_variables: selectedVariables,
          confluence_config: confluenceConfig
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [data, ...prev]);
      toast.success('Export template saved');
      return data;
    } catch (error) {
      console.error('Error saving export template:', error);
      toast.error('Failed to save template');
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
        .from('q_export_templates')
        .update(updates)
        .eq('row_id', rowId)
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => prev.map(t => t.row_id === rowId ? data : t));
      toast.success('Template updated');
      return data;
    } catch (error) {
      console.error('Error updating export template:', error);
      toast.error('Failed to update template');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Delete a template (soft delete)
  const deleteTemplate = useCallback(async (rowId) => {
    try {
      const { error } = await supabase
        .from('q_export_templates')
        .update({ is_deleted: true })
        .eq('row_id', rowId);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.row_id !== rowId));
      toast.success('Template deleted');
    } catch (error) {
      console.error('Error deleting export template:', error);
      toast.error('Failed to delete template');
      throw error;
    }
  }, []);

  return {
    templates,
    isLoading,
    isSaving,
    fetchTemplates,
    saveTemplate,
    updateTemplate,
    deleteTemplate
  };
};
