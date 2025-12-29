import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

// Move invokeFunction outside component to ensure stable reference
const invokeFunction = async (action, params = {}) => {
  console.log(`[invokeFunction] Calling confluence-manager with action: ${action}`, params);
  
  try {
    const { data, error } = await supabase.functions.invoke('confluence-manager', {
      body: { action, ...params }
    });
    
    // Handle Supabase invoke error (network issues, etc.)
    if (error) {
      console.error(`[invokeFunction] Supabase function invoke error:`, error);
      // Try to extract meaningful error message
      const errorMessage = error.message || error.context?.message || 'Edge function error';
      throw new Error(errorMessage);
    }
    
    // Handle errors returned in the response body from the edge function
    if (data?.error) {
      console.error(`[invokeFunction] Edge function returned error:`, data.error);
      throw new Error(data.error);
    }
    
    console.log(`[invokeFunction] Success for action: ${action}`);
    return data;
  } catch (err) {
    console.error(`[invokeFunction] Caught error for action ${action}:`, err);
    // Re-throw with clear message
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(typeof err === 'string' ? err : 'Unknown error occurred');
  }
};

export const useConfluencePages = (conversationRowId = null, promptRowId = null) => {
  const [pages, setPages] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [spaceTree, setSpaceTree] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const fetchAttachedPages = useCallback(async () => {
    if (!conversationRowId && !promptRowId) return;
    
    setIsLoading(true);
    try {
      const data = await invokeFunction('list-attached', { assistantRowId: conversationRowId, promptRowId });
      setPages(data.pages || []);
    } catch (error) {
      console.error('Error fetching attached pages:', error);
      toast.error('Failed to fetch Confluence pages');
    } finally {
      setIsLoading(false);
    }
  }, [conversationRowId, promptRowId]);

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

  const listTemplates = useCallback(async (spaceKey) => {
    if (!spaceKey) {
      setTemplates([]);
      return [];
    }
    
    setIsLoadingTemplates(true);
    try {
      const data = await invokeFunction('list-templates', { spaceKey });
      setTemplates(data.templates || []);
      return data.templates || [];
    } catch (error) {
      console.error('Error listing templates:', error);
      toast.error('Failed to load Confluence templates');
      return [];
    } finally {
      setIsLoadingTemplates(false);
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

  const getPageChildren = useCallback(async (nodeId, spaceKey, nodeType = 'page') => {
    try {
      // Always use get-page-children with nodeType - backend handles routing
      const data = await invokeFunction('get-page-children', { 
        pageId: nodeId, 
        spaceKey,
        nodeType 
      });
      return data.children || [];
    } catch (error) {
      console.error('Error getting children:', error);
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

  const createPage = useCallback(async ({ spaceKey, parentId, title, body }) => {
    console.log('[useConfluencePages] Creating page:', { spaceKey, parentId, title, bodyLength: body?.length });
    setIsCreatingPage(true);
    try {
      const data = await invokeFunction('create-page', { spaceKey, parentId, title, body });
      if (data.success) {
        toast.success('Page created successfully');
      }
      return data;
    } catch (error) {
      console.error('[useConfluencePages] Error creating page:', error);
      // Extract error message from the error object
      const errorMessage = error?.message || error?.error || 'Failed to create page';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsCreatingPage(false);
    }
  }, []);

  const attachPage = async (pageId, contentType = 'page') => {
    try {
      const data = await invokeFunction('attach-page', { 
        pageId, 
        assistantRowId: conversationRowId, 
        promptRowId,
        contentType
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
      const data = await invokeFunction('sync-to-vector-store', { rowId, assistantId });
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

  const clearTemplates = useCallback(() => {
    setTemplates([]);
  }, []);

  return {
    pages,
    spaces,
    templates,
    searchResults,
    spaceTree,
    setSpaceTree,
    isLoading,
    isSyncing,
    isSearching,
    isLoadingTree,
    isLoadingTemplates,
    isCreatingPage,
    connectionStatus,
    fetchAttachedPages,
    testConnection,
    listSpaces,
    listTemplates,
    getSpaceTree,
    getPageChildren,
    cancelTreeLoading,
    searchPages,
    createPage,
    attachPage,
    detachPage,
    syncPage,
    syncToVectorStore,
    clearSearch,
    clearSpaceTree,
    clearTemplates
  };
};
