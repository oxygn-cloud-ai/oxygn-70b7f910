import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface KnowledgeItem {
  row_id: string;
  topic: string;
  title: string;
  content: string;
  keywords?: string[] | null;
  priority?: number | null;
  is_active?: boolean | null;
  is_auto_generated?: boolean | null;
  source_type?: string | null;
  source_id?: string | null;
  embedding?: string | null;
  version?: number | null;
  created_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface KnowledgeItemInput {
  topic: string;
  title: string;
  content: string;
  keywords?: string[];
  priority?: number;
}

export interface KnowledgeHistoryItem {
  row_id: string;
  knowledge_row_id?: string | null;
  topic?: string | null;
  title?: string | null;
  content?: string | null;
  version?: number | null;
  edited_at?: string | null;
  edited_by?: string | null;
}

export interface BulkImportResult {
  created: number;
  updated: number;
  errors: Array<{ item: string; error: string }>;
}

export interface EmbeddingRegenerationResult {
  success: boolean;
  error?: string;
  processed?: number;
  failed?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

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
  'troubleshooting',
  'database',
  'edge_functions',
  'api'
] as const;

export type KnowledgeTopic = typeof TOPICS[number];

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export const useKnowledge = () => {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedTopic, setSelectedTopic] = useState<KnowledgeTopic | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const isMountedRef = useRef<boolean>(true);

  // Reset mounted ref on mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Fetch all knowledge items
  const fetchItems = useCallback(async (): Promise<void> => {
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
      
      let filtered = (data || []) as KnowledgeItem[];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(item => 
          item.title.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q) ||
          item.keywords?.some(k => k.toLowerCase().includes(q))
        );
      }
      
      if (isMountedRef.current) setItems(filtered);
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Error fetching knowledge:', error);
        toast.error('Failed to load knowledge items');
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [selectedTopic, searchQuery]);

  // Create a new knowledge item
  const createItem = useCallback(async (itemData: KnowledgeItemInput): Promise<KnowledgeItem | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate embedding via edge function
      let embedding: number[] | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const embeddingResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
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
        .maybeSingle();

      if (error) throw error;
      
      const newItem = data as KnowledgeItem;
      setItems(prev => [...prev, newItem]);
      toast.success('Knowledge item created');
      trackEvent('knowledge_item_created', { topic: itemData.topic, title: itemData.title });
      return newItem;
    } catch (error) {
      console.error('Error creating knowledge:', error);
      toast.error('Failed to create knowledge item');
      return null;
    }
  }, []);

  // Update a knowledge item
  const updateItem = useCallback(async (rowId: string, itemData: Partial<KnowledgeItemInput>): Promise<KnowledgeItem | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current item for history
      const { data: currentItem } = await supabase
        .from('q_app_knowledge')
        .select('*')
        .eq('row_id', rowId)
        .maybeSingle();

      const current = currentItem as KnowledgeItem | null;

      // Save to history
      if (current) {
        await supabase.from('q_app_knowledge_history').insert({
          knowledge_row_id: rowId,
          topic: current.topic,
          title: current.title,
          content: current.content,
          version: current.version,
          edited_by: user.id
        });
      }

      // Generate new embedding if content changed
      let embedding: number[] | null = null;
      if (itemData.title || itemData.content) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const embeddingResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embedding`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`
              },
              body: JSON.stringify({
                text: `${itemData.title || current?.title}\n\n${itemData.content || current?.content}`
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

      const updateData: Record<string, unknown> = {
        ...itemData,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
        version: (current?.version || 0) + 1
      };

      if (embedding) {
        updateData.embedding = `[${embedding.join(',')}]`;
      }

      const { data, error } = await supabase
        .from('q_app_knowledge')
        .update(updateData)
        .eq('row_id', rowId)
        .select()
        .maybeSingle();

      if (error) throw error;
      
      const updated = data as KnowledgeItem;
      setItems(prev => prev.map(i => i.row_id === rowId ? updated : i));
      toast.success('Knowledge item updated');
      trackEvent('knowledge_item_updated', { row_id: rowId });
      return updated;
    } catch (error) {
      console.error('Error updating knowledge:', error);
      toast.error('Failed to update knowledge item');
      return null;
    }
  }, []);

  // Soft delete a knowledge item
  const deleteItem = useCallback(async (rowId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('q_app_knowledge')
        .update({ is_active: false })
        .eq('row_id', rowId);

      if (error) throw error;
      
      setItems(prev => prev.filter(i => i.row_id !== rowId));
      toast.success('Knowledge item deleted');
      trackEvent('knowledge_item_deleted', { row_id: rowId });
      return true;
    } catch (error) {
      console.error('Error deleting knowledge:', error);
      toast.error('Failed to delete knowledge item');
      return false;
    }
  }, []);

  // Get item history
  const getItemHistory = useCallback(async (rowId: string): Promise<KnowledgeHistoryItem[]> => {
    try {
      const { data, error } = await supabase
        .from('q_app_knowledge_history')
        .select('*')
        .eq('knowledge_row_id', rowId)
        .order('edited_at', { ascending: false });

      if (error) throw error;
      return (data || []) as KnowledgeHistoryItem[];
    } catch (error) {
      console.error('Error fetching history:', error);
      return [];
    }
  }, []);

  // Export items (with optional topic filter)
  const exportItems = useCallback(async (topicFilter: KnowledgeTopic | null = null): Promise<{ data: KnowledgeItem[]; error: Error | null }> => {
    try {
      let query = supabase
        .from('q_app_knowledge')
        .select('topic, title, content, keywords, priority')
        .eq('is_active', true)
        .order('topic')
        .order('priority', { ascending: false });

      if (topicFilter) {
        query = query.eq('topic', topicFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { data: (data || []) as KnowledgeItem[], error: null };
    } catch (error) {
      console.error('Error exporting knowledge:', error);
      return { data: [], error: error as Error };
    }
  }, []);

  // Bulk import items with upsert logic
  const bulkImportItems = useCallback(async (importItems: KnowledgeItemInput[]): Promise<BulkImportResult> => {
    const results: BulkImportResult = { created: 0, updated: 0, errors: [] };
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      for (const item of importItems) {
        try {
          // Check if item exists by topic + title
          const { data: existing } = await supabase
            .from('q_app_knowledge')
            .select('row_id')
            .eq('topic', item.topic)
            .eq('title', item.title)
            .eq('is_active', true)
            .maybeSingle();

          if (existing) {
            // Update existing item (skip history for bulk operations)
            const { error } = await supabase
              .from('q_app_knowledge')
              .update({
                content: item.content,
                keywords: item.keywords || [],
                priority: item.priority || 0,
                embedding: null, // Clear for regeneration
                updated_by: user.id,
                updated_at: new Date().toISOString()
              })
              .eq('row_id', existing.row_id);

            if (error) throw error;
            results.updated++;
          } else {
            // Create new item
            const { error } = await supabase
              .from('q_app_knowledge')
              .insert({
                topic: item.topic,
                title: item.title,
                content: item.content,
                keywords: item.keywords || [],
                priority: item.priority || 0,
                embedding: null,
                created_by: user.id,
                updated_by: user.id
              });

            if (error) throw error;
            results.created++;
          }
        } catch (itemError) {
          const err = itemError as Error;
          results.errors.push({ item: item.title, error: err.message });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in bulk import:', error);
      const err = error as Error;
      results.errors.push({ item: 'auth', error: err.message });
      return results;
    }
  }, []);

  // Trigger batch embedding regeneration
  const regenerateEmbeddings = useCallback(async (): Promise<EmbeddingRegenerationResult> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-embeddings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to regenerate embeddings: ${response.status}`);
      }

      const result = await response.json();
      return { success: true, ...result };
    } catch (error) {
      console.error('Error regenerating embeddings:', error);
      const err = error as Error;
      return { success: false, error: err.message };
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
    getItemHistory,
    exportItems,
    bulkImportItems,
    regenerateEmbeddings
  };
};
