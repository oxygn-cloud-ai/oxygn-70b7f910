import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

export const usePromptLibrary = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch own items + shared items (is_private = false)
      const { data, error } = await supabase
        .from('q_prompt_library')
        .select('*')
        .or(`owner_id.eq.${user.id},is_private.eq.false`)
        .order('name', { ascending: true });

      if (error) throw error;

      setItems(data || []);

      // Extract unique categories
      const uniqueCategories = [...new Set((data || [])
        .map(item => item.category)
        .filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching library items:', error);
      toast.error('Failed to load prompt library');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const createItem = useCallback(async (name, content, description = null, category = null, isPrivate = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check for duplicate name
      const existing = items.find(i => 
        i.name.toLowerCase() === name.toLowerCase() && i.owner_id === user.id
      );
      if (existing) {
        toast.error('An item with this name already exists');
        return null;
      }

      const { data, error } = await supabase
        .from('q_prompt_library')
        .insert({
          name,
          content,
          description,
          category,
          is_private: isPrivate,
          owner_id: user.id,
          user_id: user.id
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      setItems(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      
      if (category && !categories.includes(category)) {
        setCategories(prev => [...prev, category].sort());
      }

      toast.success('Library item created');
      
      // Track library item created
      trackEvent('library_item_created', {
        item_id: data.row_id,
        category,
      });
      
      return data;
    } catch (error) {
      console.error('Error creating library item:', error);
      toast.error('Failed to create library item');
      return null;
    }
  }, [items, categories]);

  const updateItem = useCallback(async (rowId, updates) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify ownership
      const item = items.find(i => i.row_id === rowId);
      if (!item || item.owner_id !== user.id) {
        toast.error('You can only edit your own items');
        return null;
      }

      // Check for duplicate name if name is being updated
      if (updates.name) {
        const existing = items.find(i => 
          i.name.toLowerCase() === updates.name.toLowerCase() && 
          i.owner_id === user.id && 
          i.row_id !== rowId
        );
        if (existing) {
          toast.error('An item with this name already exists');
          return null;
        }
      }

      const { data, error } = await supabase
        .from('q_prompt_library')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('row_id', rowId)
        .select()
        .maybeSingle();

      if (error) throw error;

      setItems(prev => prev
        .map(i => i.row_id === rowId ? data : i)
        .sort((a, b) => a.name.localeCompare(b.name))
      );

      // Update categories if needed
      if (updates.category && !categories.includes(updates.category)) {
        setCategories(prev => [...prev, updates.category].sort());
      }

      toast.success('Library item updated');
      return data;
    } catch (error) {
      console.error('Error updating library item:', error);
      toast.error('Failed to update library item');
      return null;
    }
  }, [items, categories]);

  const deleteItem = useCallback(async (rowId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify ownership
      const item = items.find(i => i.row_id === rowId);
      if (!item || item.owner_id !== user.id) {
        toast.error('You can only delete your own items');
        return false;
      }

      const { error } = await supabase
        .from('q_prompt_library')
        .delete()
        .eq('row_id', rowId);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.row_id !== rowId));
      toast.success('Library item deleted');
      return true;
    } catch (error) {
      console.error('Error deleting library item:', error);
      toast.error('Failed to delete library item');
      return false;
    }
  }, [items]);

  const getItemsByCategory = useCallback((category) => {
    if (!category) return items;
    return items.filter(i => i.category === category);
  }, [items]);

  const searchItems = useCallback((query) => {
    if (!query.trim()) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(i => 
      i.name.toLowerCase().includes(lowerQuery) ||
      i.description?.toLowerCase().includes(lowerQuery) ||
      i.content?.toLowerCase().includes(lowerQuery)
    );
  }, [items]);

  const getOwnItems = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    return items.filter(i => i.owner_id === user.id);
  }, [items]);

  const getSharedItems = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    return items.filter(i => i.owner_id !== user.id && !i.is_private);
  }, [items]);

  return {
    items,
    categories,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
    getItemsByCategory,
    searchItems,
    getOwnItems,
    getSharedItems,
    refetch: fetchItems
  };
};
