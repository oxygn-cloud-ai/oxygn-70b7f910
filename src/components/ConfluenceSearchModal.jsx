import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Search, Plus, Loader2, FileText, ExternalLink, ChevronRight, ChevronDown, FolderOpen, X, Home, BookOpen, Folder } from 'lucide-react';
import { useConfluencePages } from '@/hooks/useConfluencePages';
import { cn } from '@/lib/utils';

// Get icon for node type
const getNodeIcon = (node) => {
  if (node.isContainer) return Folder;
  if (node.isHomepage) return Home;
  if (node.type === 'blogpost') return BookOpen;
  return FileText;
};

// Recursive tree node component with lazy loading
const TreeNode = ({ 
  node, 
  level = 0, 
  onAttach, 
  attachingPageId, 
  expandedNodes, 
  toggleExpand,
  loadingNodes,
  spaceKey
}) => {
  const hasChildren = node.hasChildren || (node.children && node.children.length > 0);
  const isExpanded = expandedNodes.has(node.id);
  const isLoading = loadingNodes.has(node.id);
  const hasLoadedChildren = node.loaded || (node.children && node.children.length > 0);
  const isContainer = node.isContainer;
  const canAttach = !isContainer; // Can't attach containers
  const NodeIcon = getNodeIcon(node);

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 group",
          isContainer && "bg-muted/30"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0"
              onClick={() => toggleExpand(node.id, spaceKey)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : (
            <span className="w-5" />
          )}
          <NodeIcon className={cn(
            "h-4 w-4 flex-shrink-0",
            isContainer ? "text-primary" : "text-muted-foreground"
          )} />
          <span className={cn(
            "text-sm truncate",
            isContainer && "font-medium"
          )}>
            {node.title}
          </span>
          {node.url && !isContainer && (
            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          )}
        </div>
        {canAttach && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onAttach(node.id)}
            disabled={attachingPageId === node.id}
          >
            {attachingPageId === node.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
      {hasLoadedChildren && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
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
            />
          ))}
          {node.children.length === 0 && (
            <div 
              className="text-xs text-muted-foreground py-1"
              style={{ paddingLeft: `${(level + 1) * 16 + 28}px` }}
            >
              No child pages
            </div>
          )}
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

  // Load space tree when space is selected
  useEffect(() => {
    if (selectedSpace && selectedSpace !== 'all') {
      // Cancel any previous loading
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

  // Debounced search - also cancels tree loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        // Cancel tree loading when searching
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

  const handleAttach = async (pageId) => {
    setAttachingPageId(pageId);
    try {
      await attachPage(pageId);
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
      // Collapse
      setExpandedNodes(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    } else {
      // Expand - load children if not loaded
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
      
      // Skip loading for containers (already loaded) or if already loaded
      if (node && !node.loaded && !node.isContainer && node.children?.length === 0) {
        // Need to load children
        setLoadingNodes(prev => new Set(prev).add(nodeId));
        
        try {
          const children = await getPageChildren(nodeId, spaceKey);
          
          // Update tree with children
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
      
      // Expand
      setExpandedNodes(prev => new Set(prev).add(nodeId));
    }
  };

  // Show search results if searching, otherwise show tree
  const showSearchResults = searchQuery.length >= 2;
  const showTree = selectedSpace && selectedSpace !== 'all' && !showSearchResults;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Browse Confluence</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Space selector and search */}
          <div className="flex gap-2">
            <Select value={selectedSpace} onValueChange={setSelectedSpace}>
              <SelectTrigger className="w-[200px]">
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

          {/* Loading indicator with cancel button */}
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
          <ScrollArea className="h-[400px] border rounded-md">
            {isSearching ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : showSearchResults ? (
              // Search results
              searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-12 w-12 mb-2 opacity-50" />
                  <p>No pages found</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {searchResults.map((page) => (
                    <div
                      key={page.id}
                      className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{page.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="truncate">{page.spaceName || page.spaceKey}</span>
                          {page.url && (
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAttach(page.id)}
                        disabled={attachingPageId === page.id}
                      >
                        {attachingPageId === page.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )
            ) : showTree && !isLoadingTree ? (
              // Tree view
              spaceTree.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mb-2 opacity-50" />
                  <p>No pages in this space</p>
                </div>
              ) : (
                <div className="p-2">
                  {spaceTree.map((node) => (
                    <TreeNode
                      key={node.id}
                      node={node}
                      onAttach={handleAttach}
                      attachingPageId={attachingPageId}
                      expandedNodes={expandedNodes}
                      toggleExpand={toggleExpand}
                      loadingNodes={loadingNodes}
                      spaceKey={selectedSpace}
                    />
                  ))}
                </div>
              )
            ) : !isLoadingTree ? (
              // Empty state - prompt to select space or search
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FolderOpen className="h-12 w-12 mb-2 opacity-50" />
                <p>Select a space to browse pages</p>
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