import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, RefreshCw, Search, X, ExternalLink, Loader2, ChevronRight, ChevronDown, Folder, Layout, Database, Newspaper } from 'lucide-react';
import { useConfluencePages } from '@/hooks/useConfluencePages';
import ConfluenceSearchModal from './ConfluenceSearchModal';
import { cn } from '@/lib/utils';

// Helper to build tree from flat pages list
const buildPageTree = (pages) => {
  const pageMap = new Map();
  const rootPages = [];
  
  pages.forEach(page => {
    pageMap.set(page.page_id, { ...page, children: [] });
  });
  
  pages.forEach(page => {
    const node = pageMap.get(page.page_id);
    if (page.parent_page_id && pageMap.has(page.parent_page_id)) {
      pageMap.get(page.parent_page_id).children.push(node);
    } else {
      rootPages.push(node);
    }
  });
  
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      // Sort by position first (null positions go last)
      const ap = a.position ?? Number.MAX_SAFE_INTEGER;
      const bp = b.position ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      // Fallback to title for items without position
      return (a.page_title || '').localeCompare(b.page_title || '');
    });
    nodes.forEach(node => sortNodes(node.children));
  };
  sortNodes(rootPages);
  
  return rootPages;
};

// Confluence-style tree node for attached pages
const PageTreeNode = ({ 
  page, 
  level = 0, 
  syncingPageId, 
  onSync, 
  onDetach, 
  isLast = false,
  parentLines = []
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = page.children?.length > 0;

  const renderTreeLines = () => {
    if (level === 0) return null;
    
    return (
      <div className="flex">
        {parentLines.map((showLine, idx) => (
          <div key={idx} className="w-4 flex-shrink-0 relative">
            {showLine && (
              <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border" />
            )}
          </div>
        ))}
        <div className="w-4 flex-shrink-0 relative">
          <div className="absolute left-1.5 top-1/2 w-1.5 h-px bg-border" />
          {!isLast && (
            <div className="absolute left-1.5 top-1/2 bottom-0 w-px bg-border" />
          )}
          <div className="absolute left-1.5 top-0 h-1/2 w-px bg-border" />
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center group hover:bg-muted/50 rounded-sm">
        {level > 0 && renderTreeLines()}
        
        <div className="w-4 flex-shrink-0 flex items-center justify-center">
          {hasChildren ? (
            <button
              className="p-0.5 hover:bg-muted rounded"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-3" />
          )}
        </div>

        {/* Content type icon based on stored content_type */}
        {page.content_type === 'folder' ? (
          <Folder className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mr-1" />
        ) : page.content_type === 'whiteboard' ? (
          <Layout className="h-3.5 w-3.5 text-purple-500 flex-shrink-0 mr-1" />
        ) : page.content_type === 'database' ? (
          <Database className="h-3.5 w-3.5 text-blue-500 flex-shrink-0 mr-1" />
        ) : page.content_type === 'blogpost' ? (
          <Newspaper className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mr-1" />
        ) : (
          <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mr-1" />
        )}
        
        <span className="text-sm truncate flex-1 py-1">{page.page_title}</span>
        
        <Badge 
          variant={page.sync_status === 'synced' ? 'default' : page.sync_status === 'error' ? 'destructive' : 'secondary'} 
          className="text-[10px] px-1 py-0 h-4 mr-1"
        >
          {page.sync_status === 'synced' ? '✓' : page.sync_status === 'error' ? '✕' : '○'}
        </Badge>
        
        {page.openai_file_id && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 mr-1">Indexed</Badge>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {page.page_url && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a 
                    href={page.page_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-muted rounded"
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>Open in Confluence</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="p-1 hover:bg-muted rounded"
                  onClick={() => onSync(page.row_id)}
                  disabled={syncingPageId === page.row_id}
                >
                  <RefreshCw className={cn(
                    "h-3 w-3 text-muted-foreground",
                    syncingPageId === page.row_id && "animate-spin"
                  )} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Refresh Content</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  className="p-1 hover:bg-muted rounded"
                  onClick={() => onDetach(page.row_id)}
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Detach Page</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {hasChildren && expanded && (
        <div>
          {page.children.map((child, idx) => (
            <PageTreeNode
              key={child.row_id}
              page={child}
              level={level + 1}
              syncingPageId={syncingPageId}
              onSync={onSync}
              onDetach={onDetach}
              isLast={idx === page.children.length - 1}
              parentLines={[...parentLines, !isLast]}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ConfluencePagesSection = ({ 
  conversationRowId = null, 
  promptRowId = null
}) => {
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [syncingPageId, setSyncingPageId] = useState(null);
  
  const {
    pages,
    isLoading,
    fetchAttachedPages,
    detachPage,
    syncPage,
  } = useConfluencePages(conversationRowId, promptRowId);

  const pageTree = useMemo(() => buildPageTree(pages), [pages]);

  const handleSync = async (rowId) => {
    setSyncingPageId(rowId);
    try {
      await syncPage(rowId);
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
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Confluence Pages ({pages.length})</CardTitle>
            </div>
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : pages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Confluence pages attached</p>
          ) : (
            <div>
              {pageTree.map((page, idx) => (
                <PageTreeNode
                  key={page.row_id}
                  page={page}
                  syncingPageId={syncingPageId}
                  onSync={handleSync}
                  onDetach={detachPage}
                  isLast={idx === pageTree.length - 1}
                  parentLines={[]}
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