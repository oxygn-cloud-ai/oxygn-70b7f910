import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

/**
 * Hook for managing deleted items across all types (prompts, templates, JSON schemas, export templates)
 * @param {boolean} isAdmin - If true, fetches all deleted items across all users (admin bypass)
 */
export const useDeletedItems = (isAdmin = false) => {
  const [deletedItems, setDeletedItems] = useState({
    prompts: [],
    templates: [],
    jsonSchemas: [],
    exportTemplates: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [counts, setCounts] = useState({
    prompts: 0,
    templates: 0,
    jsonSchemas: 0,
    exportTemplates: 0,
    total: 0
  });

  // Fetch all deleted items for current user only
  const fetchAllDeleted = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDeletedItems({ prompts: [], templates: [], jsonSchemas: [], exportTemplates: [] });
        setCounts({ prompts: 0, templates: 0, jsonSchemas: 0, exportTemplates: 0, total: 0 });
        return { prompts: [], templates: [], jsonSchemas: [], exportTemplates: [] };
      }

      // Build queries - admins see all, regular users see only their own
      let promptsQuery = supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('row_id, prompt_name, parent_row_id, updated_at, icon_name, owner_id')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });

      let templatesQuery = supabase
        .from(import.meta.env.VITE_TEMPLATES_TBL)
        .select('row_id, template_name, category, updated_at, owner_id')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });

      let jsonSchemasQuery = supabase
        .from('q_json_schema_templates')
        .select('row_id, schema_name, category, updated_at, owner_id')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });

      let exportTemplatesQuery = supabase
        .from('q_export_templates')
        .select('row_id, template_name, export_type, updated_at, owner_id')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });

      // Apply owner filter for non-admins
      if (!isAdmin) {
        promptsQuery = promptsQuery.eq('owner_id', user.id);
        templatesQuery = templatesQuery.eq('owner_id', user.id);
        jsonSchemasQuery = jsonSchemasQuery.eq('owner_id', user.id);
        exportTemplatesQuery = exportTemplatesQuery.eq('owner_id', user.id);
      }

      const [promptsRes, templatesRes, jsonSchemasRes, exportTemplatesRes] = await Promise.all([
        promptsQuery,
        templatesQuery,
        jsonSchemasQuery,
        exportTemplatesQuery
      ]);

      const prompts = promptsRes.data || [];
      const templates = templatesRes.data || [];
      const jsonSchemas = jsonSchemasRes.data || [];
      const exportTemplates = exportTemplatesRes.data || [];

      setDeletedItems({
        prompts,
        templates,
        jsonSchemas,
        exportTemplates
      });

      setCounts({
        prompts: prompts.length,
        templates: templates.length,
        jsonSchemas: jsonSchemas.length,
        exportTemplates: exportTemplates.length,
        total: prompts.length + templates.length + jsonSchemas.length + exportTemplates.length
      });

      return { prompts, templates, jsonSchemas, exportTemplates };
    } catch (error) {
      console.error('Error fetching deleted items:', error);
      toast.error('Failed to load deleted items');
      return { prompts: [], templates: [], jsonSchemas: [], exportTemplates: [] };
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Restore a single item (RLS protects cross-tenant access)
  const restoreItem = useCallback(async (type, rowId) => {
    try {
      let tableName;
      switch (type) {
        case 'prompts':
          tableName = import.meta.env.VITE_PROMPTS_TBL;
          break;
        case 'templates':
          tableName = import.meta.env.VITE_TEMPLATES_TBL;
          break;
        case 'jsonSchemas':
          tableName = 'q_json_schema_templates';
          break;
        case 'exportTemplates':
          tableName = 'q_export_templates';
          break;
        default:
          throw new Error('Unknown item type');
      }

      const { error } = await supabase
        .from(tableName)
        .update({ is_deleted: false })
        .eq('row_id', rowId);

      if (error) throw error;

      // Update local state
      setDeletedItems(prev => ({
        ...prev,
        [type]: prev[type].filter(item => item.row_id !== rowId)
      }));

      setCounts(prev => ({
        ...prev,
        [type]: prev[type] - 1,
        total: prev.total - 1
      }));

      toast.success('Item restored');
      
      // Track item restored
      trackEvent('deleted_item_restored', {
        item_type: type,
        item_id: rowId,
      });
      
      return true;
    } catch (error) {
      console.error('Error restoring item:', error);
      toast.error('Failed to restore item');
      return false;
    }
  }, []);

  // Permanently delete a single item (RLS protects cross-tenant access)
  const permanentlyDeleteItem = useCallback(async (type, rowId) => {
    try {
      let tableName;
      switch (type) {
        case 'prompts':
          tableName = import.meta.env.VITE_PROMPTS_TBL;
          break;
        case 'templates':
          tableName = import.meta.env.VITE_TEMPLATES_TBL;
          break;
        case 'jsonSchemas':
          tableName = 'q_json_schema_templates';
          break;
        case 'exportTemplates':
          tableName = 'q_export_templates';
          break;
        default:
          throw new Error('Unknown item type');
      }

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('row_id', rowId);

      if (error) throw error;

      // Update local state
      setDeletedItems(prev => ({
        ...prev,
        [type]: prev[type].filter(item => item.row_id !== rowId)
      }));

      setCounts(prev => ({
        ...prev,
        [type]: prev[type] - 1,
        total: prev.total - 1
      }));

      toast.success('Item permanently deleted');
      
      // Track permanent deletion
      trackEvent('deleted_item_purged', {
        item_type: type,
        item_id: rowId,
      });
      
      return true;
    } catch (error) {
      console.error('Error permanently deleting item:', error);
      toast.error('Failed to delete item');
      return false;
    }
  }, []);

  // Restore all items of a specific type (or all types if type is null) for current user only
  const restoreAll = useCallback(async (type = null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return false;
      }

      const typesToRestore = type ? [type] : ['prompts', 'templates', 'jsonSchemas', 'exportTemplates'];
      
      for (const t of typesToRestore) {
        let tableName;
        switch (t) {
          case 'prompts':
            tableName = import.meta.env.VITE_PROMPTS_TBL;
            break;
          case 'templates':
            tableName = import.meta.env.VITE_TEMPLATES_TBL;
            break;
          case 'jsonSchemas':
            tableName = 'q_json_schema_templates';
            break;
          case 'exportTemplates':
            tableName = 'q_export_templates';
            break;
          default:
            continue;
        }

        let query = supabase
          .from(tableName)
          .update({ is_deleted: false })
          .eq('is_deleted', true);
        
        // Apply owner filter for non-admins
        if (!isAdmin) {
          query = query.eq('owner_id', user.id);
        }

        const { error } = await query;
        if (error) throw error;
      }

      // Refresh the list
      await fetchAllDeleted();
      toast.success(type ? `All ${type} restored` : 'All items restored');
      return true;
    } catch (error) {
      console.error('Error restoring all items:', error);
      toast.error('Failed to restore items');
      return false;
    }
  }, [fetchAllDeleted, isAdmin]);

  // Permanently delete all items of a specific type (or all types if type is null) for current user only
  const permanentlyDeleteAll = useCallback(async (type = null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return false;
      }

      const typesToDelete = type ? [type] : ['prompts', 'templates', 'jsonSchemas', 'exportTemplates'];
      
      for (const t of typesToDelete) {
        let tableName;
        switch (t) {
          case 'prompts':
            tableName = import.meta.env.VITE_PROMPTS_TBL;
            break;
          case 'templates':
            tableName = import.meta.env.VITE_TEMPLATES_TBL;
            break;
          case 'jsonSchemas':
            tableName = 'q_json_schema_templates';
            break;
          case 'exportTemplates':
            tableName = 'q_export_templates';
            break;
          default:
            continue;
        }

        let query = supabase
          .from(tableName)
          .delete()
          .eq('is_deleted', true);
        
        // Apply owner filter for non-admins
        if (!isAdmin) {
          query = query.eq('owner_id', user.id);
        }

        const { error } = await query;
        if (error) throw error;
      }

      // Refresh the list
      await fetchAllDeleted();
      toast.success(type ? `Trash emptied for ${type}` : 'Trash emptied');
      return true;
    } catch (error) {
      console.error('Error emptying trash:', error);
      toast.error('Failed to empty trash');
      return false;
    }
  }, [fetchAllDeleted, isAdmin]);

  // Get just the counts without full data for current user only
  const fetchCounts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCounts({ prompts: 0, templates: 0, jsonSchemas: 0, exportTemplates: 0, total: 0 });
        return { prompts: 0, templates: 0, jsonSchemas: 0, exportTemplates: 0, total: 0 };
      }

      // Build count queries - admins see all, regular users see only their own
      let promptsCountQuery = supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('row_id', { count: 'exact', head: true })
        .eq('is_deleted', true);

      let templatesCountQuery = supabase
        .from(import.meta.env.VITE_TEMPLATES_TBL)
        .select('row_id', { count: 'exact', head: true })
        .eq('is_deleted', true);

      let jsonSchemasCountQuery = supabase
        .from('q_json_schema_templates')
        .select('row_id', { count: 'exact', head: true })
        .eq('is_deleted', true);

      let exportTemplatesCountQuery = supabase
        .from('q_export_templates')
        .select('row_id', { count: 'exact', head: true })
        .eq('is_deleted', true);

      // Apply owner filter for non-admins
      if (!isAdmin) {
        promptsCountQuery = promptsCountQuery.eq('owner_id', user.id);
        templatesCountQuery = templatesCountQuery.eq('owner_id', user.id);
        jsonSchemasCountQuery = jsonSchemasCountQuery.eq('owner_id', user.id);
        exportTemplatesCountQuery = exportTemplatesCountQuery.eq('owner_id', user.id);
      }

      const [promptsRes, templatesRes, jsonSchemasRes, exportTemplatesRes] = await Promise.all([
        promptsCountQuery,
        templatesCountQuery,
        jsonSchemasCountQuery,
        exportTemplatesCountQuery
      ]);

      const newCounts = {
        prompts: promptsRes.count || 0,
        templates: templatesRes.count || 0,
        jsonSchemas: jsonSchemasRes.count || 0,
        exportTemplates: exportTemplatesRes.count || 0,
        total: (promptsRes.count || 0) + (templatesRes.count || 0) + (jsonSchemasRes.count || 0) + (exportTemplatesRes.count || 0)
      };

      setCounts(newCounts);
      return newCounts;
    } catch (error) {
      console.error('Error fetching deleted counts:', error);
      return counts;
    }
  }, [counts, isAdmin]);

  return {
    deletedItems,
    counts,
    isLoading,
    fetchAllDeleted,
    fetchCounts,
    restoreItem,
    permanentlyDeleteItem,
    restoreAll,
    permanentlyDeleteAll
  };
};

export default useDeletedItems;
