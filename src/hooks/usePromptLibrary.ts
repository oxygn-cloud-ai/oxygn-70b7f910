import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

export interface LibraryItem {
  row_id: string;
  name: string;
  content: string;
  description?: string | null;
  category?: string | null;
  is_private?: boolean | null;
  owner_id?: string | null;
  user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface LibraryItemUpdates {
  name?: string;
  content?: string;
  description?: string | null;
  category?: string | null;
  is_private?: boolean;
}

export interface UsePromptLibraryReturn {
  items: LibraryItem[];
  categories: string[];
  isLoading: boolean;
  createItem: (
    name: string,
    content: string,
    description?: string | null,
    category?: string | null,
    isPrivate?: boolean
  ) => Promise<LibraryItem | null>;
  updateItem: (rowId: string, updates: LibraryItemUpdates) => Promise<LibraryItem | null>;
  deleteItem: (rowId: string) => Promise<boolean>;
  getItemsByCategory: (category: string | null) => LibraryItem[];
  searchItems: (query: string) => LibraryItem[];
  getOwnItems: () => Promise<LibraryItem[]>;
  getSharedItems: () => Promise<LibraryItem[]>;
  refetch: () => Promise<void>;
}

export const usePromptLibrary = (): UsePromptLibraryReturn => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);

  const fetchItems = useCallback(async (): Promise<void> => {
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

      setItems((data as LibraryItem[]) || []);

      // Extract unique categories
      const uniqueCategories = [...new Set((data || [])
        .map((item: LibraryItem) => item.category)
        .filter((cat): cat is string => Boolean(cat)))];
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

  const createItem = useCallback(async (
    name: string,
    content: string,
    description: string | null = null,
    category: string | null = null,
    isPrivate = false
  ): Promise<LibraryItem | null> => {
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

      const newItem = data as LibraryItem;
      setItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
      
      if (category && !categories.includes(category)) {
        setCategories(prev => [...prev, category].sort());
      }

      toast.success('Library item created');
      
      // Track library item created
      trackEvent('library_item_created', {
        item_id: newItem.row_id,
        category,
      });
      
      return newItem;
    } catch (error) {
      console.error('Error creating library item:', error);
      toast.error('Failed to create library item');
      return null;
    }
  }, [items, categories]);

  const updateItem = useCallback(async (rowId: string, updates: LibraryItemUpdates): Promise<LibraryItem | null> => {
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
          i.name.toLowerCase() === updates.name!.toLowerCase() && 
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

      const updatedItem = data as LibraryItem;
      setItems(prev => prev
        .map(i => i.row_id === rowId ? updatedItem : i)
        .sort((a, b) => a.name.localeCompare(b.name))
      );

      // Update categories if needed
      if (updates.category && !categories.includes(updates.category)) {
        setCategories(prev => [...prev, updates.category!].sort());
      }

      toast.success('Library item updated');
      return updatedItem;
    } catch (error) {
      console.error('Error updating library item:', error);
      toast.error('Failed to update library item');
      return null;
    }
  }, [items, categories]);

  const deleteItem = useCallback(async (rowId: string): Promise<boolean> => {
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

  const getItemsByCategory = useCallback((category: string | null): LibraryItem[] => {
    if (!category) return items;
    return items.filter(i => i.category === category);
  }, [items]);

  const searchItems = useCallback((query: string): LibraryItem[] => {
    if (!query.trim()) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(i => 
      i.name.toLowerCase().includes(lowerQuery) ||
      i.description?.toLowerCase().includes(lowerQuery) ||
      i.content?.toLowerCase().includes(lowerQuery)
    );
  }, [items]);

  const getOwnItems = useCallback(async (): Promise<LibraryItem[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    return items.filter(i => i.owner_id === user.id);
  }, [items]);

  const getSharedItems = useCallback(async (): Promise<LibraryItem[]> => {
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

export default usePromptLibrary;
