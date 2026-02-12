// @ts-nocheck
/**
 * useFigmaFiles Hook
 * Manages Figma file attachments for prompts
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';
import type { FigmaFile, UseFigmaFilesReturn } from '@/types/figma';

export const useFigmaFiles = (promptRowId: string | null = null): UseFigmaFilesReturn => {
  const [files, setFiles] = useState<FigmaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected' | 'error'>('unknown');
  const [error, setError] = useState<string | null>(null);
  
  const isFetchingRef = useRef(false);

  /**
   * Invoke the figma-manager edge function
   */
  const invokeFigmaManager = useCallback(async (
    action: string,
    params: Record<string, any> = {}
  ): Promise<any> => {
    const { data, error } = await supabase.functions.invoke('figma-manager', {
      body: { action, ...params }
    });

    if (error) {
      console.error('[useFigmaFiles] Edge function error:', error);
      throw error;
    }

    if (data?.error) {
      console.error('[useFigmaFiles] API error:', data.error);
      throw new Error(data.error);
    }

    return data;
  }, []);

  /**
   * Test Figma connection
   */
  const testConnection = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await invokeFigmaManager('test-connection');
      
      if (data.connected) {
        setConnectionStatus('connected');
        toast.success('Connected to Figma');
        trackEvent('figma_connection_test_success');
        return true;
      } else {
        setConnectionStatus('disconnected');
        toast.error('Failed to connect to Figma', {
          description: data.error || 'Check your access token'
        });
        trackEvent('figma_connection_test_failed');
        return false;
      }
    } catch (err) {
      setConnectionStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
      toast.error('Figma connection error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [invokeFigmaManager]);

  /**
   * Fetch attached files for a prompt
   */
  const fetchAttachedFiles = useCallback(async (targetPromptRowId: string): Promise<void> => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await invokeFigmaManager('list-attached', { promptRowId: targetPromptRowId });
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
      console.error('[useFigmaFiles] Fetch error:', err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [invokeFigmaManager]);

  /**
   * Attach a Figma file to a prompt
   */
  const attachFile = useCallback(async (fileKey: string, targetPromptRowId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await invokeFigmaManager('attach-file', { 
        fileKey, 
        promptRowId: targetPromptRowId 
      });
      
      if (data.file) {
        setFiles(prev => [...prev, data.file]);
        toast.success('Figma file attached');
        trackEvent('figma_file_attached', { file_key: fileKey });
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach file');
      toast.error('Failed to attach Figma file');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [invokeFigmaManager]);

  /**
   * Detach a file from a prompt
   */
  const detachFile = useCallback(async (rowId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      await invokeFigmaManager('detach-file', { rowId });
      setFiles(prev => prev.filter(f => f.row_id !== rowId));
      toast.success('Figma file detached');
      trackEvent('figma_file_detached');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detach file');
      toast.error('Failed to detach Figma file');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [invokeFigmaManager]);

  /**
   * Sync a file's metadata from Figma
   */
  const syncFile = useCallback(async (rowId: string): Promise<boolean> => {
    setIsSyncing(true);
    setError(null);
    
    try {
      const data = await invokeFigmaManager('sync-file', { rowId });
      
      if (data.file) {
        setFiles(prev => prev.map(f => f.row_id === rowId ? data.file : f));
        toast.success('Figma file synced');
        trackEvent('figma_file_synced');
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync file');
      toast.error('Failed to sync Figma file');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [invokeFigmaManager]);

  return {
    files,
    isLoading,
    isSyncing,
    connectionStatus,
    error,
    testConnection,
    fetchAttachedFiles,
    attachFile,
    detachFile,
    syncFile,
  };
};

export default useFigmaFiles;
