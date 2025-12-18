import React, { useState, useEffect, useCallback } from 'react';
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
import { Search, Plus, Loader2, FileText, ExternalLink, ChevronRight, ChevronDown, FolderOpen } from 'lucide-react';
import { useConfluencePages } from '@/hooks/useConfluencePages';
import { cn } from '@/lib/utils';

// Recursive tree node component
const TreeNode = ({ node, level = 0, onAttach, attachingPageId, expandedNodes, toggleExpand }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);

  return (
    <div>
      <div
        className={cn(
          "flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 group",
          level > 0 && "ml-4"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 p-0"
              onClick={() => toggleExpand(node.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : (
            <span className="w-5" />
          )}
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm truncate">{node.title}</span>
          {node.url && (
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
      </div>
      {hasChildren && isExpanded && (
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
  
  const { 
    spaces, 
    searchResults, 
    spaceTree,
    isSearching, 
    isLoadingTree,
    listSpaces, 
    getSpaceTree,
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
      getSpaceTree(selectedSpace);
      setExpandedNodes(new Set());
    } else {
      clearSpaceTree();
    }
  }, [selectedSpace, getSpaceTree, clearSpaceTree]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) {
        searchPages(searchQuery, selectedSpace === 'all' ? null : selectedSpace);
      } else {
        clearSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedSpace, searchPages, clearSearch]);

  // Clear state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedSpace('');
      setExpandedNodes(new Set());
      clearSearch();
      clearSpaceTree();
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

  const toggleExpand = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const getAllIds = (nodes) => {
      const ids = [];
      nodes.forEach(node => {
        if (node.children?.length > 0) {
          ids.push(node.id);
          ids.push(...getAllIds(node.children));
        }
      });
      return ids;
    };
    setExpandedNodes(new Set(getAllIds(spaceTree)));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
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

          {/* Tree controls */}
          {showTree && spaceTree.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {spaceTree.length} root pages
              </span>
              <span className="text-muted-foreground">•</span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={expandAll}>
                Expand all
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={collapseAll}>
                Collapse all
              </Button>
            </div>
          )}

          {/* Results area */}
          <ScrollArea className="h-[400px] border rounded-md">
            {/* Loading state */}
            {(isSearching || isLoadingTree) ? (
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
            ) : showTree ? (
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
                    />
                  ))}
                </div>
              )
            ) : (
              // Empty state - prompt to select space or search
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FolderOpen className="h-12 w-12 mb-2 opacity-50" />
                <p>Select a space to browse pages</p>
                <p className="text-xs mt-1">or search across all spaces</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfluenceSearchModal;