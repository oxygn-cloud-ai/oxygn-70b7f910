import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const useTreeData = (supabase) => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultAdminPrompt, setDefaultAdminPrompt] = useState('');

  const fetchPrompts = useCallback(async (parentRowId = null) => {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('prompts')
        .select('row_id, parent_row_id, prompt_name, note, created, is_deleted')
        .order('created', { ascending: true });

      if (parentRowId) {
        query = query.eq('parent_row_id', parentRowId);
      } else {
        query = query.is('parent_row_id', null);
      }

      console.log('Supabase API Call:', {
        url: query.url.toString(),
        method: 'GET',
        headers: query.headers,
        body: null,
      });

      const { data, error } = await query;

      console.log('Supabase API Response:', {
        status: data ? 200 : 500,
        data: data,
        error: error,
      });

      if (error) throw error;

      // Filter out deleted prompts and sort by created date
      const filteredData = data
        .filter(prompt => !prompt.is_deleted)
        .sort((a, b) => new Date(a.created) - new Date(b.created));

      const promptsWithChildren = await Promise.all(filteredData.map(async (prompt) => {
        const children = await fetchPrompts(prompt.row_id);
        return {
          ...prompt,
          id: prompt.row_id,
          name: prompt.prompt_name,
          children: children.length > 0 ? children : undefined
        };
      }));

      return promptsWithChildren;
    } catch (error) {
      console.error('Error fetching prompts:', error);
      return [];
    }
  }, [supabase]);

  const fetchTreeData = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const data = await fetchPrompts();
      setTreeData(data);

      // Fetch default admin prompt from settings
      const settingsQuery = supabase
        .from('settings')
        .select('def_admin_prompt')
        .single();

      console.log('Supabase API Call (Settings):', {
        url: settingsQuery.url.toString(),
        method: 'GET',
        headers: settingsQuery.headers,
        body: null,
      });

      const { data: settingsData, error: settingsError } = await settingsQuery;

      console.log('Supabase API Response (Settings):', {
        status: settingsData ? 200 : 500,
        data: settingsData,
        error: settingsError,
      });

      if (settingsError) throw settingsError;
      setDefaultAdminPrompt(settingsData.def_admin_prompt || '');
    } catch (error) {
      console.error('Error fetching tree data:', error);
      toast.error(`Failed to fetch prompts: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPrompts, supabase]);

  useEffect(() => {
    if (supabase) {
      fetchTreeData();
    }
  }, [fetchTreeData, supabase]);

  const addItem = useCallback(async (parentId) => {
    if (!supabase) return null;
    try {
      // Fetch the latest def_admin_prompt value
      const settingsQuery = supabase
        .from('settings')
        .select('def_admin_prompt')
        .single();

      console.log('Supabase API Call (Settings for Add Item):', {
        url: settingsQuery.url.toString(),
        method: 'GET',
        headers: settingsQuery.headers,
        body: null,
      });

      const { data: settingsData, error: settingsError } = await settingsQuery;

      console.log('Supabase API Response (Settings for Add Item):', {
        status: settingsData ? 200 : 500,
        data: settingsData,
        error: settingsError,
      });

      if (settingsError) throw settingsError;

      const latestDefaultAdminPrompt = settingsData.def_admin_prompt || '';

      const newItem = {
        parent_row_id: parentId,
        prompt_name: 'New Prompt',
        note: '',
        created: new Date().toISOString(),
        is_deleted: false,
        input_admin_prompt: latestDefaultAdminPrompt
      };

      const insertQuery = supabase.from('prompts').insert(newItem).select().single();

      console.log('Supabase API Call (Insert New Item):', {
        url: insertQuery.url.toString(),
        method: 'POST',
        headers: insertQuery.headers,
        body: newItem,
      });

      const { data, error } = await insertQuery;

      console.log('Supabase API Response (Insert New Item):', {
        status: data ? 200 : 500,
        data: data,
        error: error,
      });

      if (error) throw error;

      await fetchTreeData();
      return data.row_id;
    } catch (error) {
      console.error('Error adding new item:', error);
      toast.error(`Failed to add new item: ${error.message}`);
      return null;
    }
  }, [supabase, fetchTreeData]);

  const updateItemName = useCallback(async (id, newName) => {
    if (!supabase) return false;
    try {
      const updateQuery = supabase.from('prompts').update({ prompt_name: newName }).eq('row_id', id);

      console.log('Supabase API Call (Update Item Name):', {
        url: updateQuery.url.toString(),
        method: 'PATCH',
        headers: updateQuery.headers,
        body: { prompt_name: newName },
      });

      const { error } = await updateQuery;

      console.log('Supabase API Response (Update Item Name):', {
        status: error ? 500 : 200,
        error: error,
      });

      if (error) throw error;

      await fetchTreeData();
      return true;
    } catch (error) {
      console.error('Error updating item name:', error);
      toast.error(`Failed to update item name: ${error.message}`);
      return false;
    }
  }, [supabase, fetchTreeData]);

  const deleteItem = useCallback(async (id) => {
    if (!supabase) return false;
    try {
      // Mark the item and its children as deleted
      const markAsDeleted = async (itemId) => {
        const updateQuery = supabase
          .from('prompts')
          .update({ is_deleted: true })
          .eq('row_id', itemId);

        console.log('Supabase API Call (Mark as Deleted):', {
          url: updateQuery.url.toString(),
          method: 'PATCH',
          headers: updateQuery.headers,
          body: { is_deleted: true },
        });
        
        const { error } = await updateQuery;

        console.log('Supabase API Response (Mark as Deleted):', {
          status: error ? 500 : 200,
          error: error,
        });
        
        if (error) throw error;

        // Fetch and mark children as deleted
        const childrenQuery = supabase
          .from('prompts')
          .select('row_id')
          .eq('parent_row_id', itemId);

        console.log('Supabase API Call (Fetch Children):', {
          url: childrenQuery.url.toString(),
          method: 'GET',
          headers: childrenQuery.headers,
          body: null,
        });
        
        const { data: children, error: childrenError } = await childrenQuery;

        console.log('Supabase API Response (Fetch Children):', {
          status: children ? 200 : 500,
          data: children,
          error: childrenError,
        });
        
        if (childrenError) throw childrenError;

        for (const child of children) {
          await markAsDeleted(child.row_id);
        }
      };

      await markAsDeleted(id);
      await fetchTreeData();
      toast.success('Item deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(`Failed to delete item: ${error.message}`);
      return false;
    }
  }, [supabase, fetchTreeData]);

  return { 
    treeData, 
    addItem, 
    updateItemName,
    deleteItem,
    isLoading,
    refreshTreeData: fetchTreeData,
    defaultAdminPrompt
  };
};

export default useTreeData;