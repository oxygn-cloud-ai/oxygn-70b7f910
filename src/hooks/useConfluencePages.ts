import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent, trackException, trackApiError } from '@/lib/posthog';

// ============================================================================
// Types
// ============================================================================

export interface ConfluencePage {
  row_id: string;
  page_id?: string | null;
  page_title?: string | null;
  page_url?: string | null;
  space_key?: string | null;
  space_name?: string | null;
  content_type?: string | null;
  content_text?: string | null;
  content_html?: string | null;
  sync_status?: string | null;
  last_synced_at?: string | null;
  openai_file_id?: string | null;
  assistant_row_id?: string | null;
  prompt_row_id?: string | null;
  [key: string]: unknown;
}

export interface ConfluenceSpace {
  key: string;
  name: string;
  type?: string;
  [key: string]: unknown;
}

export interface ConfluenceTemplate {
  id: string;
  name: string;
  body?: string;
  variables?: string[];
  [key: string]: unknown;
}

export interface SpaceTreeNode {
  id: string;
  title: string;
  type?: string;
  children?: SpaceTreeNode[];
  hasChildren?: boolean;
  [key: string]: unknown;
}

export interface ConnectionStatus {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface CreatePageParams {
  spaceKey: string;
  parentId: string | null;
  title: string;
  body: string;
}

export interface CreatePageResult {
  success: boolean;
  pageId?: string;
  pageUrl?: string;
  error?: string;
  [key: string]: unknown;
}

export interface FindUniqueTitleResult {
  uniqueTitle: string;
  wasModified: boolean;
  error?: string;
}

export interface UseConfluencePagesReturn {
  pages: ConfluencePage[];
  spaces: ConfluenceSpace[];
  templates: ConfluenceTemplate[];
  searchResults: ConfluencePage[];
  spaceTree: SpaceTreeNode[];
  setSpaceTree: React.Dispatch<React.SetStateAction<SpaceTreeNode[]>>;
  isLoading: boolean;
  isSyncing: boolean;
  isSearching: boolean;
  isLoadingTree: boolean;
  isLoadingTemplates: boolean;
  isCreatingPage: boolean;
  connectionStatus: ConnectionStatus | null;
  fetchAttachedPages: () => Promise<void>;
  testConnection: () => Promise<ConnectionStatus>;
  listSpaces: () => Promise<ConfluenceSpace[]>;
  listTemplates: (spaceKey: string) => Promise<ConfluenceTemplate[]>;
  getSpaceTree: (spaceKey: string, abortSignal?: AbortSignal) => Promise<SpaceTreeNode[]>;
  getPageChildren: (nodeId: string, spaceKey: string, nodeType?: string) => Promise<SpaceTreeNode[]>;
  cancelTreeLoading: () => void;
  searchPages: (query: string, spaceKey?: string | null) => Promise<ConfluencePage[]>;
  createPage: (params: CreatePageParams) => Promise<CreatePageResult>;
  findUniqueTitle: (spaceKey: string, baseTitle: string, parentId?: string | null) => Promise<FindUniqueTitleResult>;
  attachPage: (pageId: string, contentType?: string) => Promise<{ success: boolean; page?: ConfluencePage }>;
  detachPage: (rowId: string) => Promise<void>;
  syncPage: (rowId: string) => Promise<{ success: boolean; page?: ConfluencePage }>;
  syncToVectorStore: (rowId: string, assistantId: string) => Promise<{ success: boolean; openaiFileId?: string }>;
  clearSearch: () => void;
  clearSpaceTree: () => void;
  clearTemplates: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

interface InvokeFunctionResponse {
  pages?: ConfluencePage[];
  spaces?: ConfluenceSpace[];
  templates?: ConfluenceTemplate[];
  tree?: SpaceTreeNode[];
  children?: SpaceTreeNode[];
  success?: boolean;
  page?: ConfluencePage;
  uniqueTitle?: string;
  wasModified?: boolean;
  openaiFileId?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * Invoke confluence-manager edge function
 */
const invokeFunction = async (action: string, params: Record<string, unknown> = {}): Promise<InvokeFunctionResponse> => {
  console.log(`[invokeFunction] Calling confluence-manager with action: ${action}`, params);
  
  try {
    const { data, error } = await supabase.functions.invoke('confluence-manager', {
      body: { action, ...params }
    });
    
    // Handle Supabase invoke error (network issues, etc.)
    if (error) {
      console.error(`[invokeFunction] Supabase function invoke error:`, error);
      // Try to extract meaningful error message
      const errorMessage = error.message || (error as { context?: { message?: string } }).context?.message || 'Edge function error';
      throw new Error(errorMessage);
    }
    
    // Handle errors returned in the response body from the edge function
    if (data?.error) {
      console.error(`[invokeFunction] Edge function returned error:`, data.error);
      throw new Error(data.error);
    }
    
    console.log(`[invokeFunction] Success for action: ${action}`);
    return data as InvokeFunctionResponse;
  } catch (err) {
    console.error(`[invokeFunction] Caught error for action ${action}:`, err);
    trackApiError('confluence-manager', err instanceof Error ? err : new Error(String(err)), { action });
    // Re-throw with clear message
    if (err instanceof Error) {
      throw err;
    }
    throw new Error(typeof err === 'string' ? err : 'Unknown error occurred');
  }
};

// ============================================================================
// Hook Implementation
// ============================================================================

export const useConfluencePages = (
  conversationRowId: string | null = null,
  promptRowId: string | null = null
): UseConfluencePagesReturn => {
  const [pages, setPages] = useState<ConfluencePage[]>([]);
  const [spaces, setSpaces] = useState<ConfluenceSpace[]>([]);
  const [templates, setTemplates] = useState<ConfluenceTemplate[]>([]);
  const [searchResults, setSearchResults] = useState<ConfluencePage[]>([]);
  const [spaceTree, setSpaceTree] = useState<SpaceTreeNode[]>([]);
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

  const fetchAttachedPages = useCallback(async (): Promise<void> => {
    if (!conversationRowId && !promptRowId) return;
    
    if (isMountedRef.current) setIsLoading(true);
    try {
      const data = await invokeFunction('list-attached', { assistantRowId: conversationRowId, promptRowId });
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

  const testConnection = useCallback(async (): Promise<ConnectionStatus> => {
    try {
      const data = await invokeFunction('test-connection');
      const status: ConnectionStatus = { success: true, ...data };
      if (isMountedRef.current) setConnectionStatus(status);
      return status;
    } catch (error) {
      const status: ConnectionStatus = { success: false, message: error instanceof Error ? error.message : String(error) };
      if (isMountedRef.current) setConnectionStatus(status);
      return status;
    }
  }, []);

  const listSpaces = useCallback(async (): Promise<ConfluenceSpace[]> => {
    try {
      const data = await invokeFunction('list-spaces');
      if (isMountedRef.current) setSpaces(data.spaces || []);
      return data.spaces || [];
    } catch (error) {
      console.error('Error listing spaces:', error);
      if (isMountedRef.current) toast.error('Failed to list Confluence spaces');
      return [];
    }
  }, []);

  const listTemplates = useCallback(async (spaceKey: string): Promise<ConfluenceTemplate[]> => {
    if (!spaceKey) {
      if (isMountedRef.current) setTemplates([]);
      return [];
    }
    
    if (isMountedRef.current) setIsLoadingTemplates(true);
    try {
      const data = await invokeFunction('list-templates', { spaceKey });
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

  const getSpaceTree = useCallback(async (spaceKey: string, abortSignal?: AbortSignal): Promise<SpaceTreeNode[]> => {
    if (!spaceKey) {
      if (isMountedRef.current) setSpaceTree([]);
      return [];
    }
    
    if (isMountedRef.current) setIsLoadingTree(true);
    try {
      const data = await invokeFunction('get-space-tree', { spaceKey });
      if (abortSignal?.aborted || !isMountedRef.current) return [];
      setSpaceTree(data.tree || []);
      return data.tree || [];
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

  const getPageChildren = useCallback(async (
    nodeId: string,
    spaceKey: string,
    nodeType: string = 'page'
  ): Promise<SpaceTreeNode[]> => {
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

  const cancelTreeLoading = useCallback((): void => {
    if (isMountedRef.current) {
      setIsLoadingTree(false);
      setSpaceTree([]);
    }
  }, []);

  const searchPages = useCallback(async (query: string, spaceKey: string | null = null): Promise<ConfluencePage[]> => {
    if (!query || query.length < 2) {
      if (isMountedRef.current) setSearchResults([]);
      return [];
    }
    
    if (isMountedRef.current) setIsSearching(true);
    try {
      const data = await invokeFunction('search-pages', { query, spaceKey });
      if (isMountedRef.current) setSearchResults(data.pages || []);
      return data.pages || [];
    } catch (error) {
      console.error('Error searching pages:', error);
      if (isMountedRef.current) toast.error('Failed to search Confluence');
      return [];
    } finally {
      if (isMountedRef.current) setIsSearching(false);
    }
  }, []);

  const createPage = useCallback(async (params: CreatePageParams): Promise<CreatePageResult> => {
    console.log('[useConfluencePages] Creating page:', { ...params, bodyLength: params.body?.length });
    if (isMountedRef.current) setIsCreatingPage(true);
    try {
      const data = await invokeFunction('create-page', params);
      if (data.success && isMountedRef.current) {
        toast.success('Page created successfully');
        trackEvent('confluence_page_created', { space_key: params.spaceKey, has_parent: !!params.parentId });
      }
      return data as CreatePageResult;
    } catch (error) {
      console.error('[useConfluencePages] Error creating page:', error);
      trackException(error instanceof Error ? error : new Error(String(error)), { action: 'confluence_create_page', space_key: params.spaceKey });
      const errorMessage = error instanceof Error ? error.message : 'Failed to create page';
      if (isMountedRef.current) toast.error(errorMessage);
      throw error;
    } finally {
      if (isMountedRef.current) setIsCreatingPage(false);
    }
  }, []);

  const findUniqueTitle = useCallback(async (
    spaceKey: string,
    baseTitle: string,
    parentId: string | null = null
  ): Promise<FindUniqueTitleResult> => {
    try {
      console.log('[useConfluencePages] Finding unique title:', { spaceKey, baseTitle, parentId });
      const data = await invokeFunction('find-unique-title', { 
        spaceKey, 
        baseTitle, 
        parentId 
      });
      console.log('[useConfluencePages] Unique title result:', data);
      return {
        uniqueTitle: data.uniqueTitle || baseTitle,
        wasModified: data.wasModified || false,
        error: data.error
      };
    } catch (error) {
      console.error('[useConfluencePages] Error finding unique title:', error);
      // Return original title on error
      return { uniqueTitle: baseTitle, wasModified: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, []);

  const attachPage = async (pageId: string, contentType: string = 'page'): Promise<{ success: boolean; page?: ConfluencePage }> => {
    try {
      const data = await invokeFunction('attach-page', { 
        pageId, 
        assistantRowId: conversationRowId, 
        promptRowId,
        contentType
      });
      
      if (data.success && isMountedRef.current) {
        if (data.page) {
          setPages(prev => [data.page!, ...prev]);
        }
        toast.success('Page attached successfully');
        trackEvent('confluence_page_attached', { page_id: pageId, content_type: contentType });
      }
      return { success: data.success || false, page: data.page };
    } catch (error) {
      console.error('Error attaching page:', error);
      if (isMountedRef.current) toast.error('Failed to attach page');
      throw error;
    }
  };

  const detachPage = async (rowId: string): Promise<void> => {
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

  const syncPage = async (rowId: string): Promise<{ success: boolean; page?: ConfluencePage }> => {
    if (isMountedRef.current) setIsSyncing(true);
    try {
      const data = await invokeFunction('sync-page', { rowId });
      if (data.success && isMountedRef.current && data.page) {
        setPages(prev => prev.map(p => 
          p.row_id === rowId ? data.page! : p
        ));
        toast.success('Page synced');
      }
      return { success: data.success || false, page: data.page };
    } catch (error) {
      console.error('Error syncing page:', error);
      if (isMountedRef.current) toast.error('Failed to sync page');
      throw error;
    } finally {
      if (isMountedRef.current) setIsSyncing(false);
    }
  };

  const syncToVectorStore = async (rowId: string, assistantId: string): Promise<{ success: boolean; openaiFileId?: string }> => {
    if (isMountedRef.current) setIsSyncing(true);
    try {
      const data = await invokeFunction('sync-to-vector-store', { rowId, assistantId });
      if (data.success && isMountedRef.current) {
        setPages(prev => prev.map(p => 
          p.row_id === rowId ? { ...p, openai_file_id: data.openaiFileId } : p
        ));
        toast.success('Page indexed to vector store');
      }
      return { success: data.success || false, openaiFileId: data.openaiFileId };
    } catch (error) {
      console.error('Error syncing to vector store:', error);
      if (isMountedRef.current) toast.error('Failed to index page');
      throw error;
    } finally {
      if (isMountedRef.current) setIsSyncing(false);
    }
  };

  const clearSearch = useCallback((): void => {
    setSearchResults([]);
  }, []);

  const clearSpaceTree = useCallback((): void => {
    setSpaceTree([]);
  }, []);

  const clearTemplates = useCallback((): void => {
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
