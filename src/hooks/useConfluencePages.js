import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

// Move invokeFunction outside component to ensure stable reference
const invokeFunction = async (action, params = {}) => {
  const { data, error } = await supabase.functions.invoke('confluence-manager', {
    body: { action, ...params }
  });
  
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  
  return data;
};

export const useConfluencePages = (assistantRowId = null, promptRowId = null) => {
  const [pages, setPages] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [spaceTree, setSpaceTree] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const fetchAttachedPages = useCallback(async () => {
    if (!assistantRowId && !promptRowId) return;
    
    setIsLoading(true);
    try {
      const data = await invokeFunction('list-attached', { assistantRowId, promptRowId });
      setPages(data.pages || []);
    } catch (error) {
      console.error('Error fetching attached pages:', error);
      toast.error('Failed to fetch Confluence pages');
    } finally {
      setIsLoading(false);
    }
  }, [assistantRowId, promptRowId]);

  useEffect(() => {
    fetchAttachedPages();
  }, [fetchAttachedPages]);

  const testConnection = useCallback(async () => {
    try {
      const data = await invokeFunction('test-connection');
      setConnectionStatus(data);
      return data;
    } catch (error) {
      const status = { success: false, message: error.message };
      setConnectionStatus(status);
      return status;
    }
  }, []);

  const listSpaces = useCallback(async () => {
    try {
      const data = await invokeFunction('list-spaces');
      setSpaces(data.spaces || []);
      return data.spaces;
    } catch (error) {
      console.error('Error listing spaces:', error);
      toast.error('Failed to list Confluence spaces');
      return [];
    }
  }, []);

  const getSpaceTree = useCallback(async (spaceKey, abortSignal) => {
    if (!spaceKey) {
      setSpaceTree([]);
      return [];
    }
    
    setIsLoadingTree(true);
    try {
      const data = await invokeFunction('get-space-tree', { spaceKey });
      if (abortSignal?.aborted) return [];
      setSpaceTree(data.tree || []);
      return data.tree;
    } catch (error) {
      if (abortSignal?.aborted) return [];
      console.error('Error getting space tree:', error);
      toast.error('Failed to load space pages');
      return [];
    } finally {
      if (!abortSignal?.aborted) {
        setIsLoadingTree(false);
      }
    }
  }, []);

  const getPageChildren = useCallback(async (pageId, spaceKey) => {
    try {
      const data = await invokeFunction('get-page-children', { pageId, spaceKey });
      return data.children || [];
    } catch (error) {
      console.error('Error getting page children:', error);
      return [];
    }
  }, []);

  const cancelTreeLoading = useCallback(() => {
    setIsLoadingTree(false);
    setSpaceTree([]);
  }, []);

  const searchPages = useCallback(async (query, spaceKey = null) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return [];
    }
    
    setIsSearching(true);
    try {
      const data = await invokeFunction('search-pages', { query, spaceKey });
      setSearchResults(data.pages || []);
      return data.pages;
    } catch (error) {
      console.error('Error searching pages:', error);
      toast.error('Failed to search Confluence');
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  const attachPage = async (pageId) => {
    try {
      const data = await invokeFunction('attach-page', { 
        pageId, 
        assistantRowId, 
        promptRowId 
      });
      
      if (data.success) {
        setPages(prev => [data.page, ...prev]);
        toast.success('Page attached successfully');
      }
      return data;
    } catch (error) {
      console.error('Error attaching page:', error);
      toast.error('Failed to attach page');
      throw error;
    }
  };

  const detachPage = async (rowId) => {
    try {
      await invokeFunction('detach-page', { rowId });
      setPages(prev => prev.filter(p => p.row_id !== rowId));
      toast.success('Page detached');
    } catch (error) {
      console.error('Error detaching page:', error);
      toast.error('Failed to detach page');
      throw error;
    }
  };

  const syncPage = async (rowId) => {
    setIsSyncing(true);
    try {
      const data = await invokeFunction('sync-page', { rowId });
      if (data.success) {
        setPages(prev => prev.map(p => 
          p.row_id === rowId ? data.page : p
        ));
        toast.success('Page synced');
      }
      return data;
    } catch (error) {
      console.error('Error syncing page:', error);
      toast.error('Failed to sync page');
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const syncToVectorStore = async (rowId, assistantId) => {
    setIsSyncing(true);
    try {
      const data = await invokeFunction('sync-to-openai', { rowId, assistantId });
      if (data.success) {
        setPages(prev => prev.map(p => 
          p.row_id === rowId ? { ...p, openai_file_id: data.openaiFileId } : p
        ));
        toast.success('Page indexed to vector store');
      }
      return data;
    } catch (error) {
      console.error('Error syncing to vector store:', error);
      toast.error('Failed to index page');
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  const clearSpaceTree = useCallback(() => {
    setSpaceTree([]);
  }, []);

  return {
    pages,
    spaces,
    searchResults,
    spaceTree,
    setSpaceTree,
    isLoading,
    isSyncing,
    isSearching,
    isLoadingTree,
    connectionStatus,
    fetchAttachedPages,
    testConnection,
    listSpaces,
    getSpaceTree,
    getPageChildren,
    cancelTreeLoading,
    searchPages,
    attachPage,
    detachPage,
    syncPage,
    syncToVectorStore,
    clearSearch,
    clearSpaceTree
  };
};
