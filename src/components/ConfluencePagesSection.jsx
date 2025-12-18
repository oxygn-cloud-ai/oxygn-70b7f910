import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileStack, RefreshCw, Search, X, ExternalLink, Upload, Loader2 } from 'lucide-react';
import { useConfluencePages } from '@/hooks/useConfluencePages';
import ConfluenceSearchModal from './ConfluenceSearchModal';
import { formatDistanceToNow } from 'date-fns';

const ConfluencePagesSection = ({ 
  assistantRowId = null, 
  promptRowId = null,
  assistantId = null, // OpenAI assistant ID for syncing to OpenAI
  isActive = true 
}) => {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [syncingPageId, setSyncingPageId] = useState(null);
  
  const {
    pages,
    isLoading,
    isSyncing,
    fetchAttachedPages,
    detachPage,
    syncPage,
    syncToOpenAI
  } = useConfluencePages(assistantRowId, promptRowId);

  const handleSync = async (rowId) => {
    setSyncingPageId(rowId);
    try {
      await syncPage(rowId);
    } finally {
      setSyncingPageId(null);
    }
  };

  const handleSyncToOpenAI = async (rowId) => {
    if (!assistantId) return;
    setSyncingPageId(rowId);
    try {
      await syncToOpenAI(rowId, assistantId);
    } finally {
      setSyncingPageId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileStack className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Confluence Pages ({pages.length})</CardTitle>
            </div>
            <div className="flex gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7" 
                      onClick={() => setSearchModalOpen(true)}
                    >
                      <Search className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Browse Confluence</TooltipContent>
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
          ) : pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Confluence pages attached</p>
          ) : (
            <div className="space-y-1">
              {pages.map(page => (
                <div 
                  key={page.row_id} 
                  className="flex items-center justify-between text-sm py-2 px-2 bg-muted rounded group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileStack className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{page.page_title}</span>
                      <Badge 
                        variant={page.sync_status === 'synced' ? 'default' : page.sync_status === 'error' ? 'destructive' : 'secondary'} 
                        className="text-[10px] px-1 py-0 h-4"
                      >
                        {page.sync_status === 'synced' ? '✓' : page.sync_status === 'error' ? '✕' : '○'}
                      </Badge>
                      {page.openai_file_id && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">OpenAI</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{page.space_name || page.space_key}</span>
                      {page.last_synced_at && (
                        <span>• Synced {formatDistanceToNow(new Date(page.last_synced_at))} ago</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {page.page_url && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                              <a href={page.page_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open in Confluence</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => handleSync(page.row_id)}
                            disabled={syncingPageId === page.row_id}
                          >
                            <RefreshCw className={`h-3 w-3 ${syncingPageId === page.row_id ? 'animate-spin' : ''}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Refresh Content</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {assistantId && isActive && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6" 
                              onClick={() => handleSyncToOpenAI(page.row_id)}
                              disabled={syncingPageId === page.row_id}
                            >
                              <Upload className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Upload to OpenAI</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => detachPage(page.row_id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Detach Page</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfluenceSearchModal
        open={searchModalOpen}
        onOpenChange={setSearchModalOpen}
        assistantRowId={assistantRowId}
        promptRowId={promptRowId}
        onPageAttached={fetchAttachedPages}
      />
    </>
  );
};

export default ConfluencePagesSection;
