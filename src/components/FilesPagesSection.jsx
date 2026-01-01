import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Upload, X, Loader2, RefreshCw, File, FileImage, FileArchive } from 'lucide-react';
import { useConversationFiles } from '@/hooks/useConversationFiles';
import { cn } from '@/lib/utils';

// Helper to get file icon based on mime type
const getFileIcon = (mimeType) => {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.includes('zip') || mimeType.includes('archive')) return FileArchive;
  if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
  return File;
};

// Format file size
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FilesPagesSection = ({ 
  conversationRowId = null,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  
  const {
    files,
    isLoading,
    isUploading,
    isSyncing,
    uploadFile,
    deleteFile,
    syncFiles,
  } = useConversationFiles(conversationRowId);

  const handleFileUpload = async (e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles?.length > 0) {
      await uploadFile(Array.from(selectedFiles));
    }
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles?.length > 0) {
      await uploadFile(Array.from(droppedFiles));
    }
  };

  if (!conversationRowId) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <FileText className="h-8 w-8 text-on-surface-variant" />
            <p className="text-tree text-on-surface-variant">
              Select a prompt to attach files.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "transition-colors",
        isDragging && "border-primary bg-primary/5"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Files ({files.length})</CardTitle>
          </div>
          <div className="flex items-center gap-0.5">
            {/* Sync button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    onClick={syncFiles}
                    disabled={isSyncing || files.length === 0}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Sync files to conversation</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Upload button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <label className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
                    <input 
                      type="file" 
                      multiple 
                      className="hidden" 
                      onChange={handleFileUpload} 
                      disabled={isUploading} 
                    />
                    {isUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                  </label>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Upload files</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isDragging ? 'Drop files here...' : 'No files attached. Drag & drop or click upload.'}
          </p>
        ) : (
          <div className="space-y-1">
            {files.map((file) => {
              const FileIcon = getFileIcon(file.mime_type);
              return (
                <div 
                  key={file.row_id} 
                  className="flex items-center gap-2 group hover:bg-muted/50 rounded-sm px-1 py-1"
                >
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate flex-1">{file.original_filename}</span>
                  
                  {file.file_size && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatFileSize(file.file_size)}
                    </span>
                  )}
                  
                  <Badge 
                    variant={file.upload_status === 'synced' ? 'default' : file.upload_status === 'error' ? 'destructive' : 'secondary'} 
                    className="text-[10px] px-1 py-0 h-4"
                  >
                    {file.upload_status === 'synced' ? '✓' : file.upload_status === 'error' ? '✕' : '○'}
                  </Badge>
                  
                  {file.openai_file_id && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Indexed</Badge>
                  )}

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteFile(file.row_id)}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Delete file</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FilesPagesSection;
