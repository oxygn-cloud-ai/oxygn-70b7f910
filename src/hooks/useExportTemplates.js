import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

export const useExportTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all export templates for the current user (excluding deleted)
  const fetchTemplates = useCallback(async (exportType = null) => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTemplates([]);
        return [];
      }

      let query = supabase
        .from('q_export_templates')
        .select('*')
        .eq('owner_id', user.id)
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
        .maybeSingle();

      if (error) throw error;

      setTemplates(prev => [data, ...prev]);
      toast.success('Export template saved');
      trackEvent('export_template_created', { template_name: templateName, export_type: exportType });
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
        .maybeSingle();

      if (error) throw error;

      setTemplates(prev => prev.map(t => t.row_id === rowId ? data : t));
      toast.success('Template updated');
      trackEvent('export_template_updated', { row_id: rowId });
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

      if (error) {
        // RLS policy violation - user doesn't have permission
        if (error.code === '42501') {
          toast.info('This template belongs to another user and cannot be deleted');
          return false;
        }
        throw error;
      }

      setTemplates(prev => prev.filter(t => t.row_id !== rowId));
      toast.success('Template deleted');
      trackEvent('export_template_deleted', { row_id: rowId });
      return true;
    } catch (error) {
      console.error('Error deleting export template:', error);
      toast.error('Failed to delete template');
      return false;
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
