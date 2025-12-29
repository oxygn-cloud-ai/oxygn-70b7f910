import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export const useWorkbenchConfluence = () => {
  const [pages, setPages] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const invokeConfluence = async (action, params = {}) => {
    const { data, error } = await supabase.functions.invoke('confluence-manager', {
      body: { action, ...params }
    });
    if (error) throw error;
    return data;
  };

  const fetchPages = useCallback(async (threadRowId) => {
    if (!threadRowId) {
      setPages([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('q_workbench_confluence_links')
        .select('*')
        .eq('thread_row_id', threadRowId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPages(data || []);
    } catch (error) {
      console.error('Error fetching confluence pages:', error);
      toast.error('Failed to load Confluence pages');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchPages = useCallback(async (query, spaceKey = null) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await invokeConfluence('search', { query, space_key: spaceKey });
      setSearchResults(result.pages || []);
    } catch (error) {
      console.error('Error searching Confluence:', error);
      toast.error('Failed to search Confluence');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const listSpaces = useCallback(async () => {
    try {
      const result = await invokeConfluence('list_spaces');
      setSpaces(result.spaces || []);
      return result.spaces || [];
    } catch (error) {
      console.error('Error listing spaces:', error);
      toast.error('Failed to load Confluence spaces');
      return [];
    }
  }, []);

  const syncPageById = useCallback(async (rowId, pageId) => {
    setIsSyncing(true);
    try {
      // Fetch page content from Confluence
      const result = await invokeConfluence('get_page_content', { page_id: pageId });

      // Update local record with content
      const { error } = await supabase
        .from('q_workbench_confluence_links')
        .update({
          content_text: result.content_text,
          sync_status: 'synced'
        })
        .eq('row_id', rowId);

      if (error) throw error;

      setPages(prev => prev.map(p => 
        p.row_id === rowId 
          ? { ...p, content_text: result.content_text, sync_status: 'synced' }
          : p
      ));

      toast.success('Page synced');
      return true;
    } catch (error) {
      console.error('Error syncing page:', error);
      toast.error('Failed to sync page content');

      // Mark as failed
      await supabase
        .from('q_workbench_confluence_links')
        .update({ sync_status: 'failed' })
        .eq('row_id', rowId);

      return false;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const attachPage = useCallback(async (threadRowId, pageData) => {
    if (!threadRowId || !pageData) return null;

    try {
      // Check if already attached
      const existing = pages.find(p => p.page_id === pageData.page_id);
      if (existing) {
        toast.info('Page already attached');
        return existing;
      }

      const { data, error } = await supabase
        .from('q_workbench_confluence_links')
        .insert({
          thread_row_id: threadRowId,
          page_id: pageData.page_id,
          page_title: pageData.page_title || pageData.title,
          page_url: pageData.page_url || pageData.url,
          space_key: pageData.space_key,
          sync_status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      setPages(prev => [data, ...prev]);
      toast.success('Page attached');

      // Auto-sync content using the new page's data directly
      syncPageById(data.row_id, pageData.page_id);

      return data;
    } catch (error) {
      console.error('Error attaching page:', error);
      toast.error('Failed to attach page');
      return null;
    }
  }, [pages, syncPageById]);

  const detachPage = useCallback(async (rowId) => {
    try {
      const { error } = await supabase
        .from('q_workbench_confluence_links')
        .delete()
        .eq('row_id', rowId);

      if (error) throw error;

      setPages(prev => prev.filter(p => p.row_id !== rowId));
      toast.success('Page detached');
      return true;
    } catch (error) {
      console.error('Error detaching page:', error);
      toast.error('Failed to detach page');
      return false;
    }
  }, []);

  const syncPage = useCallback(async (rowId) => {
    const page = pages.find(p => p.row_id === rowId);
    if (!page) return false;
    return syncPageById(rowId, page.page_id);
  }, [pages, syncPageById]);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  return {
    pages,
    searchResults,
    spaces,
    isLoading,
    isSearching,
    isSyncing,
    fetchPages,
    searchPages,
    listSpaces,
    attachPage,
    detachPage,
    syncPage,
    clearSearch
  };
};
