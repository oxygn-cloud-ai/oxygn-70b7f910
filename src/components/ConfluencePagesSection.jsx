import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileStack, RefreshCw, Search, X, ExternalLink, Upload, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import { useConfluencePages } from '@/hooks/useConfluencePages';
import ConfluenceSearchModal from './ConfluenceSearchModal';
import { formatDistanceToNow } from 'date-fns';

// Helper to build tree from flat pages list
const buildPageTree = (pages) => {
  const pageMap = new Map();
  const rootPages = [];
  
  // First pass: create map of all pages by page_id
  pages.forEach(page => {
    pageMap.set(page.page_id, { ...page, children: [] });
  });
  
  // Second pass: build tree structure
  pages.forEach(page => {
    const node = pageMap.get(page.page_id);
    if (page.parent_page_id && pageMap.has(page.parent_page_id)) {
      // Has parent in our set - add as child
      pageMap.get(page.parent_page_id).children.push(node);
    } else {
      // No parent or parent not in our set - it's a root
      rootPages.push(node);
    }
  });
  
  // Sort children alphabetically
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => a.page_title.localeCompare(b.page_title));
    nodes.forEach(node => sortNodes(node.children));
  };
  sortNodes(rootPages);
  
  return rootPages;
};

// Recursive tree node component
const PageTreeNode = ({ 
  page, 
  depth = 0, 
  syncingPageId, 
  onSync, 
  onSyncToOpenAI, 
  onDetach, 
  assistantId, 
  isActive 
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = page.children?.length > 0;
  
  return (
    <div>
      <div 
        className="flex items-center justify-between text-sm py-1.5 px-2 bg-muted/50 rounded group hover:bg-muted transition-colors"
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex-1 min-w-0 flex items-center gap-1">
          {hasChildren ? (
            <button 
              onClick={() => setExpanded(!expanded)} 
              className="p-0.5 hover:bg-background rounded"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
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
                  onClick={() => onSync(page.row_id)}
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
                    onClick={() => onSyncToOpenAI(page.row_id)}
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
                  onClick={() => onDetach(page.row_id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Detach Page</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="mt-0.5 space-y-0.5">
          {page.children.map(child => (
            <PageTreeNode
              key={child.row_id}
              page={child}
              depth={depth + 1}
              syncingPageId={syncingPageId}
              onSync={onSync}
              onSyncToOpenAI={onSyncToOpenAI}
              onDetach={onDetach}
              assistantId={assistantId}
              isActive={isActive}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ConfluencePagesSection = ({ 
  assistantRowId = null, 
  promptRowId = null,
  assistantId = null,
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

  // Build hierarchical tree from flat pages
  const pageTree = useMemo(() => buildPageTree(pages), [pages]);

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
            <div className="space-y-0.5">
              {pageTree.map(page => (
                <PageTreeNode
                  key={page.row_id}
                  page={page}
                  syncingPageId={syncingPageId}
                  onSync={handleSync}
                  onSyncToOpenAI={handleSyncToOpenAI}
                  onDetach={detachPage}
                  assistantId={assistantId}
                  isActive={isActive}
                />
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