import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { v4 as uuidv4 } from 'uuid';

export const useWorkbenchFiles = () => {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchFiles = useCallback(async (threadRowId) => {
    if (!threadRowId) {
      setFiles([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('q_workbench_files')
        .select('*')
        .eq('thread_row_id', threadRowId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load files');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadFile = useCallback(async (threadRowId, file) => {
    if (!threadRowId || !file) return null;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate unique storage path
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const storagePath = `${user.id}/${threadRowId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('workbench-files')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Create database record
      const { data, error: dbError } = await supabase
        .from('q_workbench_files')
        .insert({
          thread_row_id: threadRowId,
          original_filename: file.name,
          storage_path: storagePath,
          mime_type: file.type,
          file_size: file.size,
          upload_status: 'uploaded'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setFiles(prev => [data, ...prev]);
      toast.success('File uploaded');
      return data;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const deleteFile = useCallback(async (rowId) => {
    const file = files.find(f => f.row_id === rowId);
    if (!file) return false;

    try {
      // Delete from storage
      if (file.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('workbench-files')
          .remove([file.storage_path]);

        if (storageError) {
          console.warn('Storage delete warning:', storageError);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('q_workbench_files')
        .delete()
        .eq('row_id', rowId);

      if (error) throw error;

      setFiles(prev => prev.filter(f => f.row_id !== rowId));
      toast.success('File deleted');
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
      return false;
    }
  }, [files]);

  const syncFileToOpenAI = useCallback(async (rowId) => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('workbench-manager', {
        body: { action: 'sync_file', file_row_id: rowId }
      });

      if (response.error) throw response.error;

      // Update local state with OpenAI file ID
      if (response.data?.openai_file_id) {
        setFiles(prev => prev.map(f => 
          f.row_id === rowId 
            ? { ...f, openai_file_id: response.data.openai_file_id, upload_status: 'synced' }
            : f
        ));
      }

      toast.success('File synced to AI');
      return true;
    } catch (error) {
      console.error('Error syncing file:', error);
      toast.error('Failed to sync file');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    files,
    isLoading,
    isUploading,
    isSyncing,
    fetchFiles,
    uploadFile,
    deleteFile,
    syncFileToOpenAI
  };
};
