import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Loader2, FileText, ExternalLink, ChevronRight, ChevronDown, X, Folder, Layout, Database, Newspaper, BookOpen } from 'lucide-react';
import { useConfluencePages } from '@/hooks/useConfluencePages';
import { cn } from '@/lib/utils';

// Confluence-style tree node
const TreeNode = ({ 
  node, 
  level = 0, 
  onAttach, 
  attachingPageId, 
  expandedNodes, 
  toggleExpand,
  loadingNodes,
  spaceKey,
  isLast = false,
  parentLines = []
}) => {
  const hasChildren = node.hasChildren || (node.children && node.children.length > 0);
  const isExpanded = expandedNodes.has(node.id);
  const isLoading = loadingNodes.has(node.id);
  const hasLoadedChildren = node.loaded || (node.children && node.children.length > 0);
  const isContainer = node.isContainer;
  const canAttach = !isContainer;

  // Build tree lines for proper indentation
  const renderTreeLines = () => {
    if (level === 0) return null;
    
    return (
      <div className="flex">
        {parentLines.map((showLine, idx) => (
          <div key={idx} className="w-5 flex-shrink-0 relative">
            {showLine && (
              <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
            )}
          </div>
        ))}
        <div className="w-5 flex-shrink-0 relative">
          {/* Horizontal connector */}
          <div className="absolute left-2 top-1/2 w-2 h-px bg-border" />
          {/* Vertical line (only if not last) */}
          {!isLast && (
            <div className="absolute left-2 top-1/2 bottom-0 w-px bg-border" />
          )}
          {/* Vertical line from top */}
          <div className="absolute left-2 top-0 h-1/2 w-px bg-border" />
        </div>
      </div>
    );
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center group hover:bg-muted/50 rounded-sm",
          isContainer && "font-medium"
        )}
      >
        {/* Tree structure lines */}
        {level > 0 && renderTreeLines()}
        
        {/* Expand/collapse chevron */}
        <div className="w-5 flex-shrink-0 flex items-center justify-center">
          {hasChildren ? (
            <button
              className="p-0.5 hover:bg-muted rounded"
              onClick={() => toggleExpand(node.id, spaceKey)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-3" />
          )}
        </div>

        {/* Content type icon */}
        {node.isFolder ? (
          <Folder className="h-4 w-4 text-amber-500 flex-shrink-0 mr-1.5" />
        ) : node.isWhiteboard ? (
          <Layout className="h-4 w-4 text-purple-500 flex-shrink-0 mr-1.5" />
        ) : node.isDatabase ? (
          <Database className="h-4 w-4 text-blue-500 flex-shrink-0 mr-1.5" />
        ) : node.isBlogpost || node.type === 'blogpost' ? (
          <Newspaper className="h-4 w-4 text-emerald-500 flex-shrink-0 mr-1.5" />
        ) : node.isBlogContainer ? (
          <BookOpen className="h-4 w-4 text-emerald-600 flex-shrink-0 mr-1.5" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0 mr-1.5" />
        )}
        
        {/* Title */}
        <span className="text-sm truncate flex-1 py-1">{node.title}</span>
        
        {/* Actions (visible on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
          {node.url && !isContainer && (
            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-muted rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          )}
          {canAttach && (
            <button
              className="p-1 hover:bg-muted rounded"
              onClick={() => onAttach(node.id, node.type || 'page')}
              disabled={attachingPageId === node.id}
            >
              {attachingPageId === node.id ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : (
                <Plus className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasLoadedChildren && isExpanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child, idx) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onAttach={onAttach}
              attachingPageId={attachingPageId}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              loadingNodes={loadingNodes}
              spaceKey={spaceKey}
              isLast={idx === node.children.length - 1}
              parentLines={[...parentLines, !isLast]}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ConfluenceSearchModal = ({ 
  open, 
  onOpenChange, 
  assistantRowId = null,
  promptRowId = null,
  onPageAttached
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpace, setSelectedSpace] = useState('');
  const [attachingPageId, setAttachingPageId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [loadingNodes, setLoadingNodes] = useState(new Set());
  const abortControllerRef = useRef(null);
  
  const { 
    spaces, 
    searchResults, 
    spaceTree,
    setSpaceTree,
    isSearching, 
    isLoadingTree,
    listSpaces, 
    getSpaceTree,
    getPageChildren,
    cancelTreeLoading,
    searchPages, 
    attachPage,
    clearSearch,
    clearSpaceTree
  } = useConfluencePages(assistantRowId, promptRowId);

  // Load spaces when modal opens
  useEffect(() => {
    if (open && spaces.length === 0) {
      listSpaces();
    }
  }, [open, spaces.length, listSpaces]);

  // Load space tree when space is selected and auto-expand first level
  useEffect(() => {
    if (selectedSpace && selectedSpace !== 'all') {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      getSpaceTree(selectedSpace, abortControllerRef.current.signal);
      setExpandedNodes(new Set());
    } else {
      clearSpaceTree();
    }
  }, [selectedSpace, getSpaceTree, clearSpaceTree]);

  // Auto-expand top-level items when tree loads
  useEffect(() => {
    if (spaceTree.length > 0 && expandedNodes.size === 0) {
      // Auto-expand first few top-level items
      const toExpand = new Set();
      spaceTree.slice(0, 5).forEach(node => {
        if (node.hasChildren || node.children?.length > 0) {
          toExpand.add(node.id);
        }
      });
      if (toExpand.size > 0) {
        setExpandedNodes(toExpand);
      }
    }
  }, [spaceTree]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        if (isLoadingTree) {
          cancelTreeLoading();
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
        }
        searchPages(searchQuery, selectedSpace === 'all' ? null : selectedSpace);
      } else {
        clearSearch();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedSpace, searchPages, clearSearch, isLoadingTree, cancelTreeLoading]);

  // Clear state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedSpace('');
      setExpandedNodes(new Set());
      setLoadingNodes(new Set());
      clearSearch();
      clearSpaceTree();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [open, clearSearch, clearSpaceTree]);

  const handleAttach = async (pageId, contentType = 'page') => {
    setAttachingPageId(pageId);
    try {
      await attachPage(pageId, contentType);
      onPageAttached?.();
    } finally {
      setAttachingPageId(null);
    }
  };

  const handleCancelLoad = () => {
    cancelTreeLoading();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const toggleExpand = async (nodeId, spaceKey) => {
    const isCurrentlyExpanded = expandedNodes.has(nodeId);
    
    if (isCurrentlyExpanded) {
      setExpandedNodes(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    } else {
      const findNode = (nodes) => {
        for (const node of nodes) {
          if (node.id === nodeId) return node;
          if (node.children) {
            const found = findNode(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      
      const node = findNode(spaceTree);
      
      if (node && !node.loaded && !node.isContainer && node.children?.length === 0) {
        setLoadingNodes(prev => new Set(prev).add(nodeId));
        
        try {
          const children = await getPageChildren(nodeId, spaceKey);
          
          const updateNode = (nodes) => {
            return nodes.map(n => {
              if (n.id === nodeId) {
                return { ...n, children, loaded: true, hasChildren: children.length > 0 };
              }
              if (n.children) {
                return { ...n, children: updateNode(n.children) };
              }
              return n;
            });
          };
          
          setSpaceTree(prev => updateNode(prev));
        } finally {
          setLoadingNodes(prev => {
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          });
        }
      }
      
      setExpandedNodes(prev => new Set(prev).add(nodeId));
    }
  };

  const showSearchResults = searchQuery.length >= 2;
  const showTree = selectedSpace && selectedSpace !== 'all' && !showSearchResults;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Browse Confluence</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Space selector and search */}
          <div className="flex gap-2">
            <Select value={selectedSpace} onValueChange={setSelectedSpace}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select a space..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Spaces (search only)</SelectItem>
                {spaces.map((space) => (
                  <SelectItem key={space.key} value={space.key}>
                    {space.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Loading indicator */}
          {isLoadingTree && (
            <div className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading pages...</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2"
                onClick={handleCancelLoad}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          )}

          {/* Results area */}
          <ScrollArea className="h-[450px] border rounded-md bg-background">
            {isSearching ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : showSearchResults ? (
              searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">No pages found</p>
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {searchResults.map((page) => (
                    <div
                      key={page.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm truncate block">{page.title}</span>
                          <span className="text-xs text-muted-foreground truncate block">
                            {page.spaceName || page.spaceKey}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {page.url && (
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-muted rounded"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                        )}
                        <button
                          className="p-1 hover:bg-muted rounded"
                          onClick={() => handleAttach(page.id, 'page')}
                          disabled={attachingPageId === page.id}
                        >
                          {attachingPageId === page.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : showTree && !isLoadingTree ? (
              spaceTree.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">No pages in this space</p>
                </div>
              ) : (
                <div className="p-2">
                  {spaceTree.map((node, idx) => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      onAttach={handleAttach}
                      attachingPageId={attachingPageId}
                      expandedNodes={expandedNodes}
                      toggleExpand={toggleExpand}
                      loadingNodes={loadingNodes}
                      spaceKey={selectedSpace}
                      isLast={idx === spaceTree.length - 1}
                      parentLines={[]}
                    />
                  ))}
                </div>
              )
            ) : !isLoadingTree ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Select a space to browse pages</p>
                <p className="text-xs mt-1">or search across all spaces</p>
              </div>
            ) : null}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfluenceSearchModal;