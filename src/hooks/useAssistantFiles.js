import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from 'sonner';

export const useAssistantFiles = (assistantRowId) => {
  const supabase = useSupabase();
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

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

  const uploadFile = useCallback(async (file) => {
    if (!supabase || !assistantRowId) return null;

    setIsUploading(true);
    try {
      // Generate unique path
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${assistantRowId}/${timestamp}_${safeName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('assistant-files')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

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

      if (dbError) throw dbError;

      setFiles(prev => [data, ...prev]);
      toast.success(`${file.name} uploaded`);
      return data;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(`Failed to upload ${file.name}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [supabase, assistantRowId]);

  const deleteFile = useCallback(async (fileRowId) => {
    if (!supabase) return false;

    try {
      // Get file info first
      const file = files.find(f => f.row_id === fileRowId);
      if (!file) return false;

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
  }, [supabase, files]);

  return {
    files,
    isLoading,
    isUploading,
    uploadFile,
    deleteFile,
    refetch: fetchFiles,
  };
};
