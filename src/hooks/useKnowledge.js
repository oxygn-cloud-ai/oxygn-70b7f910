import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

const TOPICS = [
  'overview',
  'prompts',
  'variables',
  'templates',
  'json_schemas',
  'actions',
  'files',
  'confluence',
  'cascade',
  'library',
  'workbench',
  'troubleshooting',
  'database',
  'edge_functions',
  'api'
];

export const useKnowledge = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all knowledge items
  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('q_app_knowledge')
        .select('*')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('title', { ascending: true });

      if (selectedTopic) {
        query = query.eq('topic', selectedTopic);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      let filtered = data || [];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(item => 
          item.title.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q) ||
          item.keywords?.some(k => k.toLowerCase().includes(q))
        );
      }
      
      setItems(filtered);
    } catch (error) {
      console.error('Error fetching knowledge:', error);
      toast.error('Failed to load knowledge items');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTopic, searchQuery]);

  // Create a new knowledge item
  const createItem = useCallback(async (itemData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate embedding via edge function
      let embedding = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const embeddingResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              text: `${itemData.title}\n\n${itemData.content}`
            })
          }
        );
        
        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          embedding = embeddingData.embedding;
        }
      } catch (e) {
        console.warn('Failed to generate embedding:', e);
      }

      const { data, error } = await supabase
        .from('q_app_knowledge')
        .insert({
          ...itemData,
          embedding: embedding ? `[${embedding.join(',')}]` : null,
          created_by: user.id,
          updated_by: user.id
        })
        .select()
        .single();

      if (error) throw error;
      
      setItems(prev => [...prev, data]);
      toast.success('Knowledge item created');
      return data;
    } catch (error) {
      console.error('Error creating knowledge:', error);
      toast.error('Failed to create knowledge item');
      return null;
    }
  }, []);

  // Update a knowledge item
  const updateItem = useCallback(async (rowId, itemData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current item for history
      const { data: currentItem } = await supabase
        .from('q_app_knowledge')
        .select('*')
        .eq('row_id', rowId)
        .single();

      // Save to history
      if (currentItem) {
        await supabase.from('q_app_knowledge_history').insert({
          knowledge_row_id: rowId,
          topic: currentItem.topic,
          title: currentItem.title,
          content: currentItem.content,
          version: currentItem.version,
          edited_by: user.id
        });
      }

      // Generate new embedding if content changed
      let embedding = null;
      if (itemData.title || itemData.content) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const embeddingResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                text: `${itemData.title || currentItem?.title}\n\n${itemData.content || currentItem?.content}`
              })
            }
          );
          
          if (embeddingResponse.ok) {
            const embeddingData = await embeddingResponse.json();
            embedding = embeddingData.embedding;
          }
        } catch (e) {
          console.warn('Failed to generate embedding:', e);
        }
      }

      const updateData = {
        ...itemData,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
        version: (currentItem?.version || 0) + 1
      };

      if (embedding) {
        updateData.embedding = `[${embedding.join(',')}]`;
      }

      const { data, error } = await supabase
        .from('q_app_knowledge')
        .update(updateData)
        .eq('row_id', rowId)
        .select()
        .single();

      if (error) throw error;
      
      setItems(prev => prev.map(i => i.row_id === rowId ? data : i));
      toast.success('Knowledge item updated');
      return data;
    } catch (error) {
      console.error('Error updating knowledge:', error);
      toast.error('Failed to update knowledge item');
      return null;
    }
  }, []);

  // Soft delete a knowledge item
  const deleteItem = useCallback(async (rowId) => {
    try {
      const { error } = await supabase
        .from('q_app_knowledge')
        .update({ is_active: false })
        .eq('row_id', rowId);

      if (error) throw error;
      
      setItems(prev => prev.filter(i => i.row_id !== rowId));
      toast.success('Knowledge item deleted');
      return true;
    } catch (error) {
      console.error('Error deleting knowledge:', error);
      toast.error('Failed to delete knowledge item');
      return false;
    }
  }, []);

  // Get item history
  const getItemHistory = useCallback(async (rowId) => {
    try {
      const { data, error } = await supabase
        .from('q_app_knowledge_history')
        .select('*')
        .eq('knowledge_row_id', rowId)
        .order('edited_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching history:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    items,
    isLoading,
    topics: TOPICS,
    selectedTopic,
    setSelectedTopic,
    searchQuery,
    setSearchQuery,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
    getItemHistory
  };
};
