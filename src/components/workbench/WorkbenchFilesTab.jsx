import React, { useRef } from 'react';
import { Upload, File, Trash2, RefreshCw, Check, Loader2, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const WorkbenchFilesTab = ({
  files,
  isLoading,
  isUploading,
  isSyncing,
  onUploadFile,
  onDeleteFile,
  onSyncFile,
  disabled
}) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      e.target.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Upload Button */}
      <div className="p-3 border-b border-border">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5 mr-2" />
          )}
          Upload File
        </Button>
      </div>

      {/* File List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <File className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No files attached</p>
              <p className="text-[10px] mt-1">Upload files to use in your chat</p>
            </div>
          ) : (
            files.map((file) => (
              <div
                key={file.row_id}
                className="group flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <File className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" title={file.original_filename}>
                    {file.original_filename}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {formatFileSize(file.file_size)}
                    </span>
                    {file.upload_status === 'synced' ? (
                      <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                        <Check className="h-2 w-2 mr-0.5" />
                        Synced
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-4 px-1 text-[9px]">
                        <Cloud className="h-2 w-2 mr-0.5" />
                        Local
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <TooltipProvider delayDuration={200}>
                    {file.upload_status !== 'synced' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onSyncFile(file.row_id)}
                            disabled={isSyncing}
                          >
                            {isSyncing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Sync to AI</TooltipContent>
                      </Tooltip>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => onDeleteFile(file.row_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete file</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default WorkbenchFilesTab;
