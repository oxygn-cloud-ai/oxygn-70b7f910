/**
 * FigmaFilesSection Component
 * Displays attached Figma files with sync/detach actions
 * Follows ConfluencePagesSection pattern
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Image, RefreshCw, Search, X, ExternalLink, Loader2 } from 'lucide-react';
import { useFigmaFiles } from '@/hooks/useFigmaFiles';
import FigmaSearchModal from './FigmaSearchModal';
import { cn } from '@/lib/utils';
import type { FigmaFile } from '@/types/figma';

interface FigmaFilesSectionProps {
  promptRowId: string | null;
}

const FigmaFilesSection: React.FC<FigmaFilesSectionProps> = ({ 
  promptRowId 
}) => {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [syncingFileId, setSyncingFileId] = useState<string | null>(null);
  
  const {
    files,
    isLoading,
    fetchAttachedFiles,
    detachFile,
    syncFile,
  } = useFigmaFiles(promptRowId);

  // Fetch attached files when promptRowId changes
  useEffect(() => {
    if (promptRowId) {
      fetchAttachedFiles(promptRowId);
    }
  }, [promptRowId, fetchAttachedFiles]);

  const handleSync = async (rowId: string) => {
    setSyncingFileId(rowId);
    try {
      await syncFile(rowId);
    } finally {
      setSyncingFileId(null);
    }
  };

  const handleDetach = async (rowId: string) => {
    await detachFile(rowId);
  };

  const handleFileAttached = () => {
    if (promptRowId) {
      fetchAttachedFiles(promptRowId);
    }
  };

  return (
    <>
      <Card className="bg-surface-container-low border-outline-variant rounded-m3-lg">
        <CardHeader className="pb-2 px-3 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="h-4 w-4 text-on-surface-variant" />
              <CardTitle className="text-title-sm text-on-surface font-medium">
                Figma Files ({files.length})
              </CardTitle>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                    onClick={() => setSearchModalOpen(true)}
                  >
                    <Search className="h-4 w-4 text-on-surface-variant" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Attach Figma File</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
            </div>
          ) : files.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No Figma files attached</p>
          ) : (
            <div className="space-y-2">
              {files.map((file: FigmaFile) => (
                <div 
                  key={file.row_id}
                  className="flex items-center gap-3 p-2 rounded-m3-sm hover:bg-surface-container group"
                >
                  {/* Thumbnail */}
                  {file.thumbnail_url ? (
                    <img 
                      src={file.thumbnail_url} 
                      alt={file.file_name || 'Figma file'}
                      className="h-10 w-14 object-cover rounded bg-surface-container"
                    />
                  ) : (
                    <div className="h-10 w-14 flex items-center justify-center rounded bg-surface-container">
                      <Image className="h-5 w-5 text-on-surface-variant" />
                    </div>
                  )}

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <span className="text-body-sm text-on-surface truncate block">
                      {file.file_name || file.file_key}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-on-surface-variant truncate">
                        {file.file_key}
                      </span>
                      <Badge 
                        variant={file.sync_status === 'synced' ? 'default' : file.sync_status === 'error' ? 'destructive' : 'secondary'} 
                        className="text-[10px] px-1 py-0 h-4"
                      >
                        {file.sync_status === 'synced' ? '✓' : file.sync_status === 'error' ? '✕' : '○'}
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a 
                            href={`https://www.figma.com/file/${file.file_key}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container-high"
                          >
                            <ExternalLink className="h-4 w-4 text-on-surface-variant" />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Open in Figma</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container-high"
                            onClick={() => handleSync(file.row_id)}
                            disabled={syncingFileId === file.row_id}
                          >
                            <RefreshCw className={cn(
                              "h-4 w-4 text-on-surface-variant",
                              syncingFileId === file.row_id && "animate-spin"
                            )} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Sync Metadata</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container-high"
                            onClick={() => handleDetach(file.row_id)}
                          >
                            <X className="h-4 w-4 text-on-surface-variant" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Detach File</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FigmaSearchModal
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
        promptRowId={promptRowId}
        onFileAttached={handleFileAttached}
      />
    </>
  );
};

export default FigmaFilesSection;
