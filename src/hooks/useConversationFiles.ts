import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { trackEvent, trackException } from '@/lib/posthog';

export interface ConversationFile {
  row_id: string;
  assistant_row_id?: string | null;
  storage_path?: string | null;
  original_filename?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  openai_file_id?: string | null;
  upload_status?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface UseConversationFilesReturn {
  files: ConversationFile[];
  isLoading: boolean;
  isUploading: boolean;
  isSyncing: boolean;
  uploadFile: (filesOrFile: File | File[]) => Promise<ConversationFile[] | null>;
  deleteFile: (fileRowId: string) => Promise<boolean>;
  syncFiles: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

export const useConversationFiles = (assistantRowId: string | null | undefined): UseConversationFilesReturn => {
  const supabase = useSupabase();
  const [files, setFiles] = useState<ConversationFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchFiles = useCallback(async (): Promise<void> => {
    if (!supabase || !assistantRowId) return;

    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_ASSISTANT_FILES_TBL)
        .select('*')
        .eq('assistant_row_id', assistantRowId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (isMountedRef.current) {
        setFiles((data as ConversationFile[]) || []);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load files');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [supabase, assistantRowId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Sync files to vector store
  const syncFiles = useCallback(async (): Promise<boolean> => {
    if (!supabase || !assistantRowId) return false;

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('conversation-manager', {
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
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [supabase, assistantRowId, fetchFiles]);

  const uploadFile = useCallback(async (filesOrFile: File | File[]): Promise<ConversationFile[] | null> => {
    if (!supabase || !assistantRowId) return null;

    // Support both single file and array of files
    const filesToUpload = Array.isArray(filesOrFile) ? filesOrFile : [filesOrFile];
    if (filesToUpload.length === 0) return null;

    setIsUploading(true);
    const uploadedFiles: ConversationFile[] = [];

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
          .from(import.meta.env.VITE_ASSISTANT_FILES_TBL)
          .insert({
            assistant_row_id: assistantRowId,
            storage_path: storagePath,
            original_filename: file.name,
            file_size: file.size,
            mime_type: file.type,
            upload_status: 'pending',
          })
          .select()
          .maybeSingle();

        if (dbError) {
          console.error('Error creating file record:', file.name, dbError);
          toast.error(`Failed to save ${file.name}`);
          continue;
        }

        const uploadedFile = data as ConversationFile;
        uploadedFiles.push(uploadedFile);
        if (isMountedRef.current) {
          setFiles(prev => [uploadedFile, ...prev]);
        }
      }

      if (uploadedFiles.length > 0) {
        toast.success(`${uploadedFiles.length} file(s) uploaded`, {
          source: 'useConversationFiles.uploadFile',
          details: JSON.stringify({ 
            assistantRowId, 
            fileCount: uploadedFiles.length, 
            fileNames: uploadedFiles.map(f => f.original_filename),
          }, null, 2),
        } as Record<string, unknown>);
        trackEvent('conversation_file_uploaded', { 
          file_count: uploadedFiles.length, 
          file_types: uploadedFiles.map(f => f.mime_type) 
        });
        // Auto-sync files after upload
        toast.info('Syncing files to assistant...', {
          source: 'useConversationFiles.uploadFile',
        } as Record<string, unknown>);
        await syncFiles();
      }

      return uploadedFiles;
    } catch (error) {
      const err = error as { code?: string; message?: string; stack?: string };
      console.error('Error in uploadFile:', error);
      toast.error('Failed to upload files', {
        source: 'useConversationFiles.uploadFile',
        errorCode: err?.code || 'UPLOAD_ERROR',
        details: JSON.stringify({ assistantRowId, error: err?.message, stack: err?.stack }, null, 2),
      } as Record<string, unknown>);
      trackException(error, { context: 'useConversationFiles.uploadFile' });
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsUploading(false);
      }
    }
  }, [supabase, assistantRowId, syncFiles]);

  const deleteFile = useCallback(async (fileRowId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      // Get file info first
      const file = files.find(f => f.row_id === fileRowId);
      if (!file) return false;

      // If file was uploaded to vector store, delete it there first
      if (file.openai_file_id) {
        console.log('Deleting file from vector store:', file.openai_file_id);
        const { data: deleteData, error: openaiError } = await supabase.functions.invoke('conversation-manager', {
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
      if (file.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('assistant-files')
          .remove([file.storage_path]);

        if (storageError) console.warn('Storage delete error:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from(import.meta.env.VITE_ASSISTANT_FILES_TBL)
        .delete()
        .eq('row_id', fileRowId);

      if (dbError) throw dbError;

      if (isMountedRef.current) {
        setFiles(prev => prev.filter(f => f.row_id !== fileRowId));
      }
      toast.success(`${file.original_filename} deleted`);
      trackEvent('conversation_file_deleted', { file_name: file.original_filename });
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
      trackException(error, { context: 'useConversationFiles.deleteFile' });
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

export default useConversationFiles;
