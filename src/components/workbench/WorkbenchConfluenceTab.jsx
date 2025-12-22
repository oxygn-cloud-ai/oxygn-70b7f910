import React, { useState, useEffect } from 'react';
import { Search, FileText, Link2, Unlink, RefreshCw, Loader2, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const WorkbenchConfluenceTab = ({
  pages,
  searchResults,
  spaces,
  isLoading,
  isSearching,
  isSyncing,
  onSearch,
  onListSpaces,
  onAttachPage,
  onDetachPage,
  onSyncPage,
  onClearSearch,
  disabled
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);

  useEffect(() => {
    if (spaces.length === 0) {
      onListSpaces();
    }
  }, [spaces.length, onListSpaces]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchMode(true);
      onSearch(searchQuery);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearchMode(false);
    onClearSearch();
  };

  const handleAttach = (result) => {
    onAttachPage({
      page_id: result.id || result.page_id,
      page_title: result.title || result.page_title,
      page_url: result._links?.webui ? `${result._links.base}${result._links.webui}` : result.page_url,
      space_key: result.space?.key || result.space_key
    });
  };

  const isPageAttached = (pageId) => {
    return pages.some(p => p.page_id === pageId);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="p-3 border-b border-border">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Confluence..."
            className="h-8 text-xs"
            disabled={disabled}
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={disabled || isSearching || !searchQuery.trim()}
          >
            {isSearching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
        
        {isSearchMode && (
          <Button
            variant="link"
            size="sm"
            className="h-6 px-0 text-[10px] mt-1"
            onClick={handleClearSearch}
          >
            ← Back to attached pages
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isSearchMode ? (
            /* Search Results */
            <>
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">
                    {isSearching ? 'Searching...' : 'No pages found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((result) => {
                    const pageId = result.id || result.page_id;
                    const attached = isPageAttached(pageId);
                    
                    return (
                      <div
                        key={pageId}
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-lg transition-colors",
                          attached ? "bg-primary/5" : "hover:bg-muted/50"
                        )}
                      >
                        <FileText className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {result.title || result.page_title}
                          </p>
                          {result.space?.key && (
                            <p className="text-[10px] text-muted-foreground">
                              {result.space.key}
                            </p>
                          )}
                        </div>

                        <Button
                          variant={attached ? "secondary" : "outline"}
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => handleAttach(result)}
                          disabled={attached}
                        >
                          {attached ? (
                            <>
                              <Check className="h-3 w-3 mr-1" />
                              Attached
                            </>
                          ) : (
                            <>
                              <Link2 className="h-3 w-3 mr-1" />
                              Attach
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Attached Pages */
            <>
              {pages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No pages attached</p>
                  <p className="text-[10px] mt-1">Search to find and attach pages</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {pages.map((page) => (
                    <div
                      key={page.row_id}
                      className="group flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <FileText className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" title={page.page_title}>
                          {page.page_title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {page.space_key && (
                            <span className="text-[10px] text-muted-foreground">
                              {page.space_key}
                            </span>
                          )}
                          {page.sync_status === 'synced' ? (
                            <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                              <Check className="h-2 w-2 mr-0.5" />
                              Synced
                            </Badge>
                          ) : page.sync_status === 'failed' ? (
                            <Badge variant="destructive" className="h-4 px-1 text-[9px]">
                              Failed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-4 px-1 text-[9px]">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider delayDuration={200}>
                          {page.page_url && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => window.open(page.page_url, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Open in Confluence</TooltipContent>
                            </Tooltip>
                          )}

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onSyncPage(page.row_id)}
                                disabled={isSyncing}
                              >
                                {isSyncing ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Refresh content</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => onDetachPage(page.row_id)}
                              >
                                <Unlink className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Detach page</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default WorkbenchConfluenceTab;
