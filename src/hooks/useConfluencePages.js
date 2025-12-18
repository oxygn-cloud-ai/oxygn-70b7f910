import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useConfluencePages = (assistantRowId = null, promptRowId = null) => {
  const [pages, setPages] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const invokeFunction = async (action, params = {}) => {
    const { data, error } = await supabase.functions.invoke('confluence-manager', {
      body: { action, ...params }
    });
    
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    
    return data;
  };

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

  const testConnection = async () => {
    try {
      const data = await invokeFunction('test-connection');
      setConnectionStatus(data);
      return data;
    } catch (error) {
      const status = { success: false, message: error.message };
      setConnectionStatus(status);
      return status;
    }
  };

  const listSpaces = async () => {
    try {
      const data = await invokeFunction('list-spaces');
      setSpaces(data.spaces || []);
      return data.spaces;
    } catch (error) {
      console.error('Error listing spaces:', error);
      toast.error('Failed to list Confluence spaces');
      return [];
    }
  };

  const searchPages = async (query, spaceKey = null) => {
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
  };

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

  const syncToOpenAI = async (rowId, assistantId) => {
    setIsSyncing(true);
    try {
      const data = await invokeFunction('sync-to-openai', { rowId, assistantId });
      if (data.success) {
        setPages(prev => prev.map(p => 
          p.row_id === rowId ? { ...p, openai_file_id: data.openaiFileId } : p
        ));
        toast.success('Page uploaded to OpenAI');
      }
      return data;
    } catch (error) {
      console.error('Error syncing to OpenAI:', error);
      toast.error('Failed to upload to OpenAI');
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const clearSearch = () => {
    setSearchResults([]);
  };

  return {
    pages,
    spaces,
    searchResults,
    isLoading,
    isSyncing,
    isSearching,
    connectionStatus,
    fetchAttachedPages,
    testConnection,
    listSpaces,
    searchPages,
    attachPage,
    detachPage,
    syncPage,
    syncToOpenAI,
    clearSearch
  };
};
