import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from 'sonner';

export const useAssistantFiles = (assistantRowId, assistantStatus) => {
  const supabase = useSupabase();
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchFiles = useCallback(async () => {
    if (!supabase || !assistantRowId) return;

    try {
      const { data, error } = await supabase
        .from('cyg_assistant_files')
        .select('*')
        .eq('assistant_row_id', assistantRowId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, assistantRowId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Sync files to OpenAI
  const syncFiles = useCallback(async () => {
    if (!supabase || !assistantRowId) return false;

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('assistant-manager', {
        body: { action: 'sync', assistant_row_id: assistantRowId },
      });

      if (error) throw error;

      if (data.uploaded_count > 0) {
        toast.success(`Synced ${data.uploaded_count} file(s) to assistant`);
      }
      
      await fetchFiles();
      return true;
    } catch (error) {
      console.error('Error syncing files:', error);
      toast.error('Failed to sync files');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [supabase, assistantRowId, fetchFiles]);

  const uploadFile = useCallback(async (filesOrFile) => {
    if (!supabase || !assistantRowId) return null;

    // Support both single file and array of files
    const filesToUpload = Array.isArray(filesOrFile) ? filesOrFile : [filesOrFile];
    if (filesToUpload.length === 0) return null;

    setIsUploading(true);
    const uploadedFiles = [];

    try {
      for (const file of filesToUpload) {
        // Generate unique path
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${assistantRowId}/${timestamp}_${safeName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('assistant-files')
          .upload(storagePath, file);

        if (uploadError) {
          console.error('Error uploading file:', file.name, uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        // Create database record
        const { data, error: dbError } = await supabase
          .from('cyg_assistant_files')
          .insert({
            assistant_row_id: assistantRowId,
            storage_path: storagePath,
            original_filename: file.name,
            file_size: file.size,
            mime_type: file.type,
            upload_status: 'pending',
          })
          .select()
          .single();

        if (dbError) {
          console.error('Error creating file record:', file.name, dbError);
          toast.error(`Failed to save ${file.name}`);
          continue;
        }

        uploadedFiles.push(data);
        setFiles(prev => [data, ...prev]);
      }

      if (uploadedFiles.length > 0) {
        toast.success(`${uploadedFiles.length} file(s) uploaded`);

        // Auto-sync if assistant is active
        if (assistantStatus === 'active') {
          toast.info('Syncing files to assistant...');
          await syncFiles();
        }
      }

      return uploadedFiles;
    } catch (error) {
      console.error('Error in uploadFile:', error);
      toast.error('Failed to upload files');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [supabase, assistantRowId, assistantStatus, syncFiles]);

  const deleteFile = useCallback(async (fileRowId) => {
    if (!supabase) return false;

    try {
      // Get file info first
      const file = files.find(f => f.row_id === fileRowId);
      if (!file) return false;

      // If file was uploaded to OpenAI, delete it there first
      if (file.openai_file_id) {
        console.log('Deleting file from OpenAI:', file.openai_file_id);
        const { data: deleteData, error: openaiError } = await supabase.functions.invoke('assistant-manager', {
          body: {
            action: 'delete-file',
            openai_file_id: file.openai_file_id,
            assistant_row_id: assistantRowId,
          },
        });

        if (openaiError || deleteData?.success === false) {
          console.warn('OpenAI delete error:', openaiError || deleteData);
          toast.error('Failed to fully remove file from assistant. Please try again.');
          return false;
        }
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('assistant-files')
        .remove([file.storage_path]);

      if (storageError) console.warn('Storage delete error:', storageError);

      // Delete from database
      const { error: dbError } = await supabase
        .from('cyg_assistant_files')
        .delete()
        .eq('row_id', fileRowId);

      if (dbError) throw dbError;

      setFiles(prev => prev.filter(f => f.row_id !== fileRowId));
      toast.success(`${file.original_filename} deleted`);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
      return false;
    }
  }, [supabase, files, assistantRowId]);

  return {
    files,
    isLoading,
    isUploading,
    isSyncing,
    uploadFile,
    deleteFile,
    syncFiles,
    refetch: fetchFiles,
  };
};
