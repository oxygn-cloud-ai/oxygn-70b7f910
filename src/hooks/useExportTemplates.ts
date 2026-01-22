import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';
import type { Json } from '@/integrations/supabase/types';

export interface ExportTemplate {
  row_id: string;
  owner_id: string | null;
  template_name: string;
  export_type: string;
  selected_fields: string[] | null;
  selected_variables: Json | null;
  confluence_config: Json | null;
  is_deleted: boolean | null;
  is_private: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface SaveTemplateParams {
  templateName: string;
  exportType: string;
  selectedFields: string[];
  selectedVariables: Record<string, string[]>;
  confluenceConfig?: Record<string, unknown>;
}

interface UseExportTemplatesReturn {
  templates: ExportTemplate[];
  isLoading: boolean;
  isSaving: boolean;
  fetchTemplates: (exportType?: string | null) => Promise<ExportTemplate[]>;
  saveTemplate: (params: SaveTemplateParams) => Promise<ExportTemplate>;
  updateTemplate: (rowId: string, updates: Partial<ExportTemplate>) => Promise<ExportTemplate>;
  deleteTemplate: (rowId: string, isAdmin?: boolean) => Promise<boolean>;
}

export const useExportTemplates = (): UseExportTemplatesReturn => {
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all export templates for the current user (excluding deleted)
  const fetchTemplates = useCallback(async (exportType: string | null = null): Promise<ExportTemplate[]> => {
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

      const result = (data || []) as ExportTemplate[];
      setTemplates(result);
      return result;
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
  }: SaveTemplateParams): Promise<ExportTemplate> => {
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
          selected_variables: selectedVariables as Json,
          confluence_config: confluenceConfig as Json
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      const template = data as ExportTemplate;
      setTemplates(prev => [template, ...prev]);
      toast.success('Export template saved');
      trackEvent('export_template_created', { template_name: templateName, export_type: exportType });
      return template;
    } catch (error) {
      console.error('Error saving export template:', error);
      toast.error('Failed to save template');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Update an existing template
  const updateTemplate = useCallback(async (rowId: string, updates: Partial<ExportTemplate>): Promise<ExportTemplate> => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('q_export_templates')
        .update(updates)
        .eq('row_id', rowId)
        .select()
        .maybeSingle();

      if (error) throw error;

      const template = data as ExportTemplate;
      setTemplates(prev => prev.map(t => t.row_id === rowId ? template : t));
      toast.success('Template updated');
      trackEvent('export_template_updated', { row_id: rowId });
      return template;
    } catch (error) {
      console.error('Error updating export template:', error);
      toast.error('Failed to update template');
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
        .from('q_export_templates')
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
