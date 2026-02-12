// @ts-nocheck
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent, trackException, trackApiError } from '@/lib/posthog';

// Type definitions
interface ConfluencePage {
  row_id: string;
  page_id: string;
  page_title: string;
  parent_page_id: string | null;
  page_url: string | null;
  sync_status: string;
  openai_file_id: string | null;
  content_type: string;
  position: number | null;
}

interface ConfluenceSpace {
  key: string;
  name: string;
}

interface ConfluenceTemplate {
  id: string;
  name: string;
}

interface SearchResult {
  id: string;
  title: string;
  url?: string;
  spaceName?: string;
  spaceKey?: string;
}

interface TreeNode {
  id: string;
  title: string;
  type?: string;
  url?: string;
  hasChildren?: boolean;
  children?: TreeNode[];
  loaded?: boolean;
  isContainer?: boolean;
  isFolder?: boolean;
}

interface ConnectionStatus {
  success: boolean;
  message?: string;
}

interface CreatePageParams {
  spaceKey: string;
  parentId?: string;
  title: string;
  body?: string;
}

interface InvokeFunctionParams {
  [key: string]: unknown;
}

// Move invokeFunction outside component to ensure stable reference
const invokeFunction = async <T = unknown>(action: string, params: InvokeFunctionParams = {}): Promise<T> => {
  console.log(`[invokeFunction] Calling confluence-manager with action: ${action}`, params);
  
  try {
    const { data, error } = await supabase.functions.invoke('confluence-manager', {
      body: { action, ...params }
    });
    
    // Handle Supabase invoke error (network issues, etc.)
    if (error) {
      console.error(`[invokeFunction] Supabase function invoke error:`, error);
      // Try to extract meaningful error message
      const errorMessage = error.message || 'Edge function error';
      throw new Error(errorMessage);
    }
    
    // Handle errors returned in the response body from the edge function
    if (data?.error) {
      console.error(`[invokeFunction] Edge function returned error:`, data.error);
      throw new Error(data.error);
    }
    
    console.log(`[invokeFunction] Success for action: ${action}`);
    return data as T;
  } catch (err) {
    console.error(`[invokeFunction] Caught error for action ${action}:`, err);
    trackApiError('confluence-manager', err as Error, { action });
    // Re-throw with clear message
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(typeof err === 'string' ? err : 'Unknown error occurred');
  }
};

export const useConfluencePages = (conversationRowId?: string | null, promptRowId?: string | null) => {
  const [pages, setPages] = useState<ConfluencePage[]>([]);
  const [spaces, setSpaces] = useState<ConfluenceSpace[]>([]);
  const [templates, setTemplates] = useState<ConfluenceTemplate[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [spaceTree, setSpaceTree] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchAttachedPages = useCallback(async () => {
    if (!conversationRowId && !promptRowId) return;
    
    if (isMountedRef.current) setIsLoading(true);
    try {
      const data = await invokeFunction<{ pages: ConfluencePage[] }>('list-attached', { assistantRowId: conversationRowId, promptRowId });
      if (isMountedRef.current) setPages(data.pages || []);
    } catch (error) {
      console.error('Error fetching attached pages:', error);
      if (isMountedRef.current) toast.error('Failed to fetch Confluence pages');
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [conversationRowId, promptRowId]);

  useEffect(() => {
    fetchAttachedPages();
  }, [fetchAttachedPages]);

  const testConnection = useCallback(async () => {
    try {
      const data = await invokeFunction<ConnectionStatus>('test-connection');
      if (isMountedRef.current) setConnectionStatus(data);
      return data;
    } catch (error) {
      const status: ConnectionStatus = { success: false, message: (error as Error).message };
      if (isMountedRef.current) setConnectionStatus(status);
      return status;
    }
  }, []);

  const listSpaces = useCallback(async () => {
    try {
      const data = await invokeFunction<{ spaces: ConfluenceSpace[] }>('list-spaces');
      if (isMountedRef.current) setSpaces(data.spaces || []);
      return data.spaces;
    } catch (error) {
      console.error('Error listing spaces:', error);
      if (isMountedRef.current) toast.error('Failed to list Confluence spaces');
      return [];
    }
  }, []);

  const listTemplates = useCallback(async (spaceKey: string) => {
    if (!spaceKey) {
      if (isMountedRef.current) setTemplates([]);
      return [];
    }
    
    if (isMountedRef.current) setIsLoadingTemplates(true);
    try {
      const data = await invokeFunction<{ templates: ConfluenceTemplate[] }>('list-templates', { spaceKey });
      if (isMountedRef.current) setTemplates(data.templates || []);
      return data.templates || [];
    } catch (error) {
      console.error('Error listing templates:', error);
      if (isMountedRef.current) toast.error('Failed to load Confluence templates');
      return [];
    } finally {
      if (isMountedRef.current) setIsLoadingTemplates(false);
    }
  }, []);

  const getSpaceTree = useCallback(async (spaceKey: string, abortSignal?: AbortSignal) => {
    if (!spaceKey) {
      if (isMountedRef.current) setSpaceTree([]);
      return [];
    }
    
    if (isMountedRef.current) setIsLoadingTree(true);
    try {
      const data = await invokeFunction<{ tree: TreeNode[] }>('get-space-tree', { spaceKey });
      if (abortSignal?.aborted || !isMountedRef.current) return [];
      setSpaceTree(data.tree || []);
      return data.tree;
    } catch (error) {
      if (abortSignal?.aborted || !isMountedRef.current) return [];
      console.error('Error getting space tree:', error);
      toast.error('Failed to load space pages');
      return [];
    } finally {
      if (!abortSignal?.aborted && isMountedRef.current) {
        setIsLoadingTree(false);
      }
    }
  }, []);

  const getPageChildren = useCallback(async (nodeId: string, spaceKey: string, nodeType = 'page'): Promise<TreeNode[]> => {
    try {
      // Always use get-page-children with nodeType - backend handles routing
      const data = await invokeFunction<{ children: TreeNode[] }>('get-page-children', { 
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
    if (isMountedRef.current) {
      setIsLoadingTree(false);
      setSpaceTree([]);
    }
  }, []);

  const searchPages = useCallback(async (query: string, spaceKey?: string) => {
    if (!query || query.length < 2) {
      if (isMountedRef.current) setSearchResults([]);
      return [];
    }
    
    if (isMountedRef.current) setIsSearching(true);
    try {
      const data = await invokeFunction<{ pages: SearchResult[] }>('search-pages', { query, spaceKey });
      if (isMountedRef.current) setSearchResults(data.pages || []);
      return data.pages;
    } catch (error) {
      console.error('Error searching pages:', error);
      if (isMountedRef.current) toast.error('Failed to search Confluence');
      return [];
    } finally {
      if (isMountedRef.current) setIsSearching(false);
    }
  }, []);

  const createPage = useCallback(async ({ spaceKey, parentId, title, body }: CreatePageParams) => {
    console.log('[useConfluencePages] Creating page:', { spaceKey, parentId, title, bodyLength: body?.length });
    if (isMountedRef.current) setIsCreatingPage(true);
    try {
      const data = await invokeFunction<{ success: boolean }>('create-page', { spaceKey, parentId, title, body });
      if (data.success && isMountedRef.current) {
        toast.success('Page created successfully');
        trackEvent('confluence_page_created', { space_key: spaceKey, has_parent: !!parentId });
      }
      return data;
    } catch (error) {
      console.error('[useConfluencePages] Error creating page:', error);
      trackException(error as Error, { action: 'confluence_create_page', space_key: spaceKey });
      const errorMessage = (error as Error)?.message || 'Failed to create page';
      if (isMountedRef.current) toast.error(errorMessage);
      throw error;
    } finally {
      if (isMountedRef.current) setIsCreatingPage(false);
    }
  }, []);

  const findUniqueTitle = useCallback(async (spaceKey: string, baseTitle: string, parentId?: string) => {
    try {
      console.log('[useConfluencePages] Finding unique title:', { spaceKey, baseTitle, parentId });
      const data = await invokeFunction<{ uniqueTitle: string; wasModified: boolean; error?: string }>('find-unique-title', { 
        spaceKey, 
        baseTitle, 
        parentId 
      });
      console.log('[useConfluencePages] Unique title result:', data);
      return data;
    } catch (error) {
      console.error('[useConfluencePages] Error finding unique title:', error);
      // Return original title on error
      return { uniqueTitle: baseTitle, wasModified: false, error: (error as Error).message };
    }
  }, []);

  const attachPage = async (pageId: string, contentType = 'page') => {
    try {
      const data = await invokeFunction<{ success: boolean; page: ConfluencePage }>('attach-page', { 
        pageId, 
        assistantRowId: conversationRowId, 
        promptRowId,
        contentType
      });
      
      if (data.success && isMountedRef.current) {
        setPages(prev => [data.page, ...prev]);
        toast.success('Page attached successfully');
        trackEvent('confluence_page_attached', { page_id: pageId, content_type: contentType });
      }
      return data;
    } catch (error) {
      console.error('Error attaching page:', error);
      if (isMountedRef.current) toast.error('Failed to attach page');
      throw error;
    }
  };

  const detachPage = async (rowId: string) => {
    try {
      await invokeFunction('detach-page', { rowId });
      if (isMountedRef.current) {
        setPages(prev => prev.filter(p => p.row_id !== rowId));
        toast.success('Page detached');
      }
      trackEvent('confluence_page_detached', { row_id: rowId });
    } catch (error) {
      console.error('Error detaching page:', error);
      if (isMountedRef.current) toast.error('Failed to detach page');
      throw error;
    }
  };

  const syncPage = async (rowId: string) => {
    if (isMountedRef.current) setIsSyncing(true);
    try {
      const data = await invokeFunction<{ success: boolean; page: ConfluencePage }>('sync-page', { rowId });
      if (data.success && isMountedRef.current) {
        setPages(prev => prev.map(p => 
          p.row_id === rowId ? data.page : p
        ));
        toast.success('Page synced');
      }
      return data;
    } catch (error) {
      console.error('Error syncing page:', error);
      if (isMountedRef.current) toast.error('Failed to sync page');
      throw error;
    } finally {
      if (isMountedRef.current) setIsSyncing(false);
    }
  };

  const syncToVectorStore = async (rowId: string, assistantId: string) => {
    if (isMountedRef.current) setIsSyncing(true);
    try {
      const data = await invokeFunction<{ success: boolean; openaiFileId: string }>('sync-to-vector-store', { rowId, assistantId });
      if (data.success && isMountedRef.current) {
        setPages(prev => prev.map(p => 
          p.row_id === rowId ? { ...p, openai_file_id: data.openaiFileId } : p
        ));
        toast.success('Page indexed to vector store');
      }
      return data;
    } catch (error) {
      console.error('Error syncing to vector store:', error);
      if (isMountedRef.current) toast.error('Failed to index page');
      throw error;
    } finally {
      if (isMountedRef.current) setIsSyncing(false);
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
    findUniqueTitle,
    attachPage,
    detachPage,
    syncPage,
    syncToVectorStore,
    clearSearch,
    clearSpaceTree,
    clearTemplates
  };
};
